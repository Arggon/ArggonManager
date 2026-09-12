import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { bundledTemplatesDir } from "./paths.js";

/**
 * Governing-document generator: renders master templates from `templates/docs/`
 * into the target repo. This is its own render step (separate from the tasks/
 * tree scaffolding in init.ts) — doc templates mirror the destination layout,
 * with renames so no template file itself is hidden:
 *
 *   templates/docs/editorconfig               → <root>/.editorconfig
 *   templates/docs/github/<file>              → <root>/.github/<file>
 *   anything else (relative path)             → <root>/<relative path>
 *
 * Placeholders rendered at write time: {{PROJECT_NAME}} (repo root dir name)
 * and {{YEAR}}. Unknown placeholders are left as-is. Existing files are NEVER
 * overwritten (not even with init --force) — governing docs are adopter-owned
 * the moment they exist.
 */

export type GenerateDocsOptions = {
  root: string;
  /** Also generate the tier-2 set (ARCHITECTURE.md, docs/convention.md, ...). */
  full: boolean;
};

export type DocsResult = {
  /** Paths created this run (posix, relative to root). */
  created: string[];
  /** Paths that already existed and were left untouched (posix, relative to root). */
  skipped: string[];
};

/** Source (package-root relative) and destination of the bundled agent skill. */
const SKILL_SOURCE = "skills/arggon-cli/SKILL.md";
const SKILL_DEST = ".agents/skills/arggon-cli/SKILL.md";

/** Template-relative path → destination-relative path. Unlisted paths map 1:1. */
const DOC_PATH_MAP: Record<string, string> = {
  editorconfig: ".editorconfig",
  "github/copilot-instructions.md": ".github/copilot-instructions.md",
  "github/CODEOWNERS": ".github/CODEOWNERS",
  "github/PULL_REQUEST_TEMPLATE.md": ".github/PULL_REQUEST_TEMPLATE.md",
  "tracking.md": "docs/tracking.md",
};

/** Destination-relative paths of the tier-2 set (generated only with `full`). */
const TIER2_DESTS = new Set([
  "ARCHITECTURE.md",
  "CHANGELOG.md",
  "SUPPORT.md",
  "docs/convention.md",
  "docs/engineering.md",
  "docs/runbooks/README.md",
]);

/** Convert an OS path (native separators) to posix separators. */
function toPosix(p: string): string {
  return p.split(sep).join("/");
}

/** Recursively collect template files under dir, as sorted posix relative paths. */
function walkTemplates(dir: string, base = dir): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkTemplates(abs, base));
    } else if (entry.isFile()) {
      found.push(toPosix(relative(base, abs)));
    }
  }
  return found.sort();
}

/** Render the known placeholders; unknown ones are left untouched. */
export function renderDocPlaceholders(
  content: string,
  vars: { projectName: string; year: number },
): string {
  return content
    .replaceAll("{{PROJECT_NAME}}", vars.projectName)
    .replaceAll("{{YEAR}}", String(vars.year));
}

export function generateDocs(opts: GenerateDocsOptions): DocsResult {
  const packageRoot = resolve(bundledTemplatesDir(), "..");
  const skillSrc = resolve(packageRoot, ...SKILL_SOURCE.split("/"));
  const docsSrc = resolve(bundledTemplatesDir(), "docs");
  if (!existsSync(docsSrc)) {
    throw new Error(`Bundled doc templates not found at ${docsSrc}`);
  }
  const vars = { projectName: basename(opts.root), year: new Date().getFullYear() };
  const created: string[] = [];
  const skipped: string[] = [];

  for (const rel of walkTemplates(docsSrc)) {
    const dest = DOC_PATH_MAP[rel] ?? rel;
    if (!opts.full && TIER2_DESTS.has(dest)) continue;
    const destAbs = join(opts.root, ...dest.split("/"));
    if (existsSync(destAbs)) {
      skipped.push(dest);
      continue;
    }
    mkdirSync(dirname(destAbs), { recursive: true });
    const template = readFileSync(join(docsSrc, ...rel.split("/")), "utf8");
    writeFileSync(destAbs, renderDocPlaceholders(template, vars), "utf8");
    created.push(dest);
  }

  // Bundle the arggon-cli skill from its single source (skills/ in this repo —
  // NOT a template duplicate) so agents in the adopter repo use it by default.
  if (existsSync(skillSrc)) {
    const destAbs = join(opts.root, ...SKILL_DEST.split("/"));
    if (existsSync(destAbs)) {
      skipped.push(SKILL_DEST);
    } else {
      mkdirSync(dirname(destAbs), { recursive: true });
      writeFileSync(destAbs, readFileSync(skillSrc, "utf8"), "utf8");
      created.push(SKILL_DEST);
    }
  }
  // Missing skill source (e.g. stripped packaging): skip silently — docs
  // generation must never fail because an optional bundle is absent.

  return { created: created.sort(), skipped: skipped.sort() };
}
