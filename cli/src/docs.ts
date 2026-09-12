import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { bundledTemplatesDir, packageRoot } from "./paths.js";
import {
  readGeneratedState,
  updateGeneratedSection,
  type GeneratedEntry,
} from "./convention.js";

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
 * and {{YEAR}}. Unknown placeholders are left as-is.
 *
 * Provenance (story-adoption-state, Copier/Helm precedent): every generated
 * file carries a visible marker as its first line —
 * `<!-- arggon:generated template="<template>" -->` — and the generation state
 * is recorded in `tasks/.convention.yml` under the namespaced `x-generated`
 * section (destination path -> { template, checksum, arggonVersion,
 * generatedAt }). Re-run semantics per destination:
 *
 *   - not on disk                                   → generate (`created[]`)
 *   - on disk, state checksum matches               → untouched: regenerate
 *     silently from the current template and refresh state (`updated[]`)
 *   - on disk, checksum differs or no state entry
 *     (pre-provenance file)                         → adopter-modified: skip
 *     by default (`modified[]` + `skipped[]`); with `backup`, move the file
 *     to backup/<YYYY-MM-DD>/<dest> first, then regenerate (`backedUp[]`)
 *
 * The checksum covers the exact written bytes (marker included), so any
 * adopter edit — even one that keeps the marker — flips the file to
 * adopter-modified.
 */

export type GenerateDocsOptions = {
  root: string;
  /** Also generate the tier-2 set (ARCHITECTURE.md, docs/convention.md, ...). */
  full: boolean;
  /** Archive adopter-modified docs to backup/<date>/<dest> before regenerating. */
  backup?: boolean;
  /** Injection point for tests: generation timestamp (defaults to now). */
  now?: Date;
};

export type DocsResult = {
  /** Paths created this run (posix, relative to root). */
  created: string[];
  /** Untouched docs regenerated from the current template (state refreshed). */
  updated: string[];
  /** Adopter-modified docs: skipped, or regenerated after --backup. */
  modified: string[];
  /** Modified docs archived to backup/<date>/<dest> before regeneration. */
  backedUp: string[];
  /** Docs left untouched this run (adopter-owned, never overwritten). */
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

/** Visible provenance marker written as the first line of every generated file. */
export function generatedMarker(template: string): string {
  return `<!-- arggon:generated template="${template}" -->`;
}

/** Checksum of file content exactly as recorded in `x-generated` entries. */
export function checksumOf(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

/** ArggonManager version recorded in `x-generated` entries (package.json). */
export function arggonVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(resolve(packageRoot(), "package.json"), "utf8"),
    ) as { version?: unknown };
    return typeof pkg.version === "string" && pkg.version !== "" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

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

/**
 * Every doc arggon currently generates (tier-1 + tier-2 + skill), as
 * destination path → source template (package-root relative). Doctor uses the
 * template ids to flag stale `x-generated` entries.
 */
export function currentGeneratedTemplates(): { dest: string; template: string }[] {
  const docsSrc = resolve(bundledTemplatesDir(), "docs");
  const found: { dest: string; template: string }[] = [];
  if (existsSync(docsSrc)) {
    for (const rel of walkTemplates(docsSrc)) {
      found.push({ dest: DOC_PATH_MAP[rel] ?? rel, template: `docs/${rel}` });
    }
  }
  if (existsSync(resolve(packageRoot(), ...SKILL_SOURCE.split("/")))) {
    found.push({ dest: SKILL_DEST, template: SKILL_SOURCE });
  }
  return found.sort((a, b) => a.dest.localeCompare(b.dest));
}

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function generateDocs(opts: GenerateDocsOptions): DocsResult {
  const packageRootDir = resolve(bundledTemplatesDir(), "..");
  const skillSrc = resolve(packageRootDir, ...SKILL_SOURCE.split("/"));
  const docsSrc = resolve(bundledTemplatesDir(), "docs");
  if (!existsSync(docsSrc)) {
    throw new Error(`Bundled doc templates not found at ${docsSrc}`);
  }
  const vars = { projectName: basename(opts.root), year: new Date().getFullYear() };
  const created: string[] = [];
  const updated: string[] = [];
  const modified: string[] = [];
  const backedUp: string[] = [];
  const skipped: string[] = [];

  const now = opts.now ?? new Date();
  const version = arggonVersion();
  const generatedAt = now.toISOString();
  const statePath = join(opts.root, "tasks", ".convention.yml");
  const hasStateFile = existsSync(statePath);
  const prevState = hasStateFile ? readGeneratedState(opts.root) : {};
  const nextState: Record<string, GeneratedEntry> = { ...prevState };

  const stamp = (
    markerTemplate: string,
    stateTemplate: string,
    content: string,
  ): { content: string; entry: GeneratedEntry } => {
    const withMarker = `${generatedMarker(markerTemplate)}\n${content}`;
    return {
      content: withMarker,
      entry: {
        template: stateTemplate,
        checksum: checksumOf(withMarker),
        arggonVersion: version,
        generatedAt,
      },
    };
  };

  /**
   * Shared per-destination provenance decision (Copier/Helm semantics):
   * returns the bytes to write and the state entry when the file should be
   * (re)generated, or null when the adopter owns the file.
   */
  const decide = (
    dest: string,
    markerTemplate: string,
    stateTemplate: string,
    render: () => string,
  ): { write: string; entry: GeneratedEntry } | null => {
    const destAbs = join(opts.root, ...dest.split("/"));
    const { content, entry } = stamp(markerTemplate, stateTemplate, render());
    if (!existsSync(destAbs)) {
      created.push(dest);
      nextState[dest] = entry;
      return { write: content, entry };
    }
    const prev = prevState[dest];
    const onDisk = checksumOf(readFileSync(destAbs, "utf8"));
    if (prev?.checksum && prev.checksum === onDisk) {
      // Untouched: silently regenerate from the current template.
      updated.push(dest);
      nextState[dest] = entry;
      return { write: content, entry };
    }
    // Adopter-modified (edited, or on disk with no provenance state).
    modified.push(dest);
    if (opts.backup) {
      const backupAbs = join(opts.root, "backup", utcDate(now), ...dest.split("/"));
      mkdirSync(dirname(backupAbs), { recursive: true });
      renameSync(destAbs, backupAbs);
      backedUp.push(dest);
      nextState[dest] = entry;
      return { write: content, entry };
    }
    skipped.push(dest);
    return null;
  };

  for (const rel of walkTemplates(docsSrc)) {
    const dest = DOC_PATH_MAP[rel] ?? rel;
    if (!opts.full && TIER2_DESTS.has(dest)) continue;
    const destAbs = join(opts.root, ...dest.split("/"));
    const decision = decide(dest, rel, `docs/${rel}`, () =>
      renderDocPlaceholders(readFileSync(join(docsSrc, ...rel.split("/")), "utf8"), vars),
    );
    if (decision) {
      mkdirSync(dirname(destAbs), { recursive: true });
      writeFileSync(destAbs, decision.write, "utf8");
    }
  }

  // Bundle the arggon-cli skill from its single source (skills/ in this repo —
  // NOT a template duplicate) so agents in the adopter repo use it by default.
  if (existsSync(skillSrc)) {
    const destAbs = join(opts.root, ...SKILL_DEST.split("/"));
    const decision = decide(SKILL_DEST, SKILL_SOURCE, SKILL_SOURCE, () =>
      readFileSync(skillSrc, "utf8"),
    );
    if (decision) {
      mkdirSync(dirname(destAbs), { recursive: true });
      writeFileSync(destAbs, decision.write, "utf8");
    }
  }
  // Missing skill source (e.g. stripped packaging): skip silently — docs
  // generation must never fail because an optional bundle is absent.

  // Record the provenance state whenever the convention file exists (init
  // writes it before generating). Outside init (bare generateDocs on a dir
  // without a tasks/ tree) there is no state file to extend — markers are
  // still stamped, and those files later count as adopter-modified until a
  // run with a state file adopts them.
  if (hasStateFile) {
    writeFileSync(
      statePath,
      updateGeneratedSection(readFileSync(statePath, "utf8"), nextState),
      "utf8",
    );
  }

  return {
    created: created.sort(),
    updated: updated.sort(),
    modified: modified.sort(),
    backedUp: backedUp.sort(),
    skipped: skipped.sort(),
  };
}
