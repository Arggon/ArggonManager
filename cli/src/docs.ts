import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { writeFileAtomic } from "./atomic.js";
import {
  bundledTemplatesDir,
  conventionPathForLayout,
  packageRoot,
  trackerAt,
  TRACKER_DIR_NAME,
  type TrackerLayout,
} from "./paths.js";
import {
  parseGeneratedProjectName,
  readGeneratedProjectName,
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
 * Placeholders rendered at write time: {{PROJECT_NAME}} and {{YEAR}}. Unknown
 * placeholders are left as-is. {{PROJECT_NAME}} resolution is layered
 * (bug-project-name-dir-derived): the name recorded in `x-generated.projectName`
 * wins, then template-pattern recovery from existing on-disk generated docs,
 * and the target directory basename ONLY as the fresh-scaffold fallback (no
 * generated content on disk). When an existing tree's name cannot be
 * recovered, name-bearing writes are skipped (`project-name-unrecoverable`)
 * instead of contaminating the docs with the directory basename.
 *
 * Provenance (story-adoption-state, Copier/Helm precedent): every generated
 * file carries a visible marker as its first line —
 * `<!-- arggon:generated template="<template>" -->` — and the generation state
 * is recorded in `tasks/.convention.yml` under the namespaced `x-generated`
 * section (destination path -> { template, checksum, arggonVersion,
 * generatedAt }). Re-run semantics per destination:
 *
 *   - not on disk                                   → generate (`created[]`)
 *   - acknowledged (`arggon adopt --ack`, entry flag)  → adopter-owned
 *     sanctioned-diverged content: skip, never touch regardless of hash
 *     (`skipped[]`) — regenerating would destroy the sanctioned content
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
 *
 * Write convention / line endings (bug-crlf-provenance-breakage): generated
 * docs are always WRITTEN with LF bytes. Git attributes such as
 * `* text=auto eol=crlf` may smudge them to CRLF on checkout — that is
 * supported, because every provenance comparison normalizes `\r\n`/`\r` to
 * `\n` at COMPARE TIME (`normalizeEol` + `checksumMatches`): state checksums
 * stay exactly as recorded (never rewritten), files on disk are never
 * rewritten to change EOLs, and an `eol=crlf` working tree reports the same
 * buckets/proposals as the LF primary checkout. Regeneration keeps writing
 * LF, which the tolerant compares absorb, so it never re-breaks checksums.
 */

export type GenerateDocsOptions = {
  root: string;
  /** Also generate the tier-2 set (ARCHITECTURE.md, docs/convention.md, ...). */
  full: boolean;
  /** Archive adopter-modified docs to backup/<date>/<dest> before regenerating. */
  backup?: boolean;
  /** Injection point for tests: generation timestamp (defaults to now). */
  now?: Date;
  /**
   * Tracker layout the docs are generated for (ADR 0012): v5 trees get the
   * docs under `ArggonManager/docs/`, legacy `tasks/` trees keep them at
   * `<root>/docs/`. Defaults to the layout detected at `root` (v5 when the
   * tree is not initialized yet — a fresh init scaffolds the v5 layout).
   */
  layout?: TrackerLayout;
  /**
   * Provenance-state override (task-init-dry-run-plan): what init's forced
   * re-scaffold would carry over into tasks/.convention.yml. When set, the
   * plan decides against this state instead of reading the (not-yet-written)
   * state file — a force re-scaffold plans as if the carried state were
   * already on disk, exactly as the real run behaves.
   */
  prev?: Record<string, GeneratedEntry>;
  /**
   * Raw `.convention.yml` content the caller is about to scaffold (task-init-
   * dry-run-plan): with `prev`, this lets init's fresh/forced re-scaffold plan
   * the pending state rewrite against the file it will have written by apply
   * time, instead of the not-yet-existing one. When set, the state rewrite is
   * always planned (the caller guarantees the file will exist).
   */
  rawState?: string;
  /**
   * Pre-resolved project name (bug-project-name-dir-derived): what the
   * caller already read from `x-generated.projectName` (or from `rawState`).
   * When omitted, the plan resolves it itself (recorded → content extraction
   * → fresh dir-basename fallback). `null` explicitly means unrecoverable.
   */
  prevProjectName?: string | null;
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

/**
 * Per-destination plan decision (task-init-dry-run-plan): the same buckets a
 * real run emits, named so a plan maps 1:1 onto created/updated/modified/
 * backedUp/skipped.
 */
export type DocsPlanDecision =
  | "created"
  | "updated"
  | "modified-skip"
  | "modified-backup"
  | "acked-skip"
  | "present-skip"
  | "stale"
  | "project-name-unrecoverable";

export type DocsPlanEntry = {
  dest: string;
  decision: DocsPlanDecision;
  reason: string;
  /** Exact bytes a real run would write (absent on skip decisions). */
  write?: string;
  /** State entry a real run would record for this destination. */
  entry?: GeneratedEntry;
  /** Where the modified file is archived before regeneration (relative). */
  backupDest?: string;
};

/**
 * Pure plan (zero writes) of exactly what generateDocs would do: the
 * per-destination decisions, the derived buckets, and the pending
 * `x-generated` state rewrite. Applying it with `applyDocsPlan` reproduces a
 * real run byte-for-byte; `generateDocs` is exactly plan + apply.
 */
export type DocsPlan = {
  entries: DocsPlanEntry[];
  created: string[];
  updated: string[];
  modified: string[];
  backedUp: string[];
  skipped: string[];
  /** Pending provenance-state rewrite (present only when the state file exists). */
  stateWrite?: { path: string; content: string };
};

/**
 * Bundled agent skills: package-root-relative source inside this package and
 * destination in the adopter tree (task-upgrade-skill-bundled). init copies
 * each with full provenance semantics; both flow through every comparison and
 * proposal surface like any managed doc.
 *
 * task-opencode2-methodology (W5): the arggon-cli skill is an umbrella
 * (`SKILL.md` + `references/`); the references are bundled files like the
 * umbrella and are drift-tested by cli/src/skill-copy.test.ts. Exported so
 * `skills:sync` and the parity test iterate the same single source list.
 */
export const BUNDLED_SKILLS = [
  { source: "skills/arggon-cli/SKILL.md", dest: ".agents/skills/arggon-cli/SKILL.md" },
  {
    source: "skills/arggon-cli/references/json-contract.md",
    dest: ".agents/skills/arggon-cli/references/json-contract.md",
  },
  {
    source: "skills/arggon-cli/references/methodology.md",
    dest: ".agents/skills/arggon-cli/references/methodology.md",
  },
  {
    source: "skills/arggon-cli/references/orchestration.md",
    dest: ".agents/skills/arggon-cli/references/orchestration.md",
  },
  {
    source: "skills/arggon-cli/references/pitfalls.md",
    dest: ".agents/skills/arggon-cli/references/pitfalls.md",
  },
  { source: "skills/arggon-upgrade/SKILL.md", dest: ".agents/skills/arggon-upgrade/SKILL.md" },
];

/**
 * Bundled OpenCode V2 plugin (plan-opencode2-009 W2): the plugin is a
 * dependency-free TypeScript source at `opencode/plugins/arggon/`; init copies
 * it to `.opencode/plugins/arggon/`, where V2 discovers it automatically. Like
 * the skills, the copy carries a generated marker (a `//` line for TypeScript
 * destinations), flows through the provenance decision table, and is guarded
 * by a byte-parity test against this single source.
 */
const BUNDLED_PLUGINS = [
  { source: "opencode/plugins/arggon/index.ts", dest: ".opencode/plugins/arggon/index.ts" },
];

/** Everything init bundles from a package-root source into an adopter destination. */
const BUNDLED_SOURCES = [...BUNDLED_SKILLS, ...BUNDLED_PLUGINS];

/** Is this template id one of the bundled (package-root source) artifacts? */
function isBundledSource(templateRel: string): boolean {
  return BUNDLED_SOURCES.some((s) => s.source === templateRel);
}

/** Resolve a bundled source against the package templates dir (sibling `skills/`, `opencode/`). */
function bundledSourcePath(templatesDir: string, source: string): string {
  return resolve(templatesDir, "..", ...source.split("/"));
}

/**
 * Template-relative path → destination-relative path, CANONICAL v5 form
 * (ADR 0012: product docs live under `<tracker>/docs/`). Unlisted paths map
 * 1:1; `mapTemplateDest` remaps the `ArggonManager/docs/...` destinations back
 * to `<root>/docs/...` for legacy trees.
 */
const DOC_PATH_MAP: Record<string, string> = {
  editorconfig: ".editorconfig",
  "github/copilot-instructions.md": ".github/copilot-instructions.md",
  "github/CODEOWNERS": ".github/CODEOWNERS",
  "github/PULL_REQUEST_TEMPLATE.md": ".github/PULL_REQUEST_TEMPLATE.md",
  "tracking.md": `${TRACKER_DIR_NAME}/docs/tracking.md`,
  "mcp-json": ".mcp.json",
};

/**
 * Prefix mappings (opencode-seam-010): a template subtree lands under a
 * destination subtree with the same suffix — `opencode/agents/x.md` →
 * `.opencode/agents/x.md`.
 */
const DOC_PREFIX_MAP: { prefix: string; dest: string }[] = [
  { prefix: "opencode/", dest: ".opencode/" },
];

/** Canonical (v5) destination of a template-relative path. */
function canonicalTemplateDest(rel: string): string {
  const explicit = DOC_PATH_MAP[rel];
  if (explicit !== undefined) return explicit;
  for (const { prefix, dest } of DOC_PREFIX_MAP) {
    if (rel.startsWith(prefix)) return `${dest}${rel.slice(prefix.length)}`;
  }
  // `templates/docs/docs/**` mirrors the product-docs tree: the canonical
  // destination nests it under the tracker root (`ArggonManager/docs/**`).
  if (rel.startsWith("docs/")) return `${TRACKER_DIR_NAME}/${rel}`;
  return rel;
}

/** Legacy-layout destination of a canonical destination (`ArggonManager/docs/x` → `docs/x`). */
function legacyTemplateDest(dest: string): string {
  const prefix = `${TRACKER_DIR_NAME}/`;
  return dest.startsWith(prefix) ? dest.slice(prefix.length) : dest;
}

/** Resolve a template-relative path to its layout-specific destination. */
function mapTemplateDest(rel: string, layout: TrackerLayout): string {
  const canonical = canonicalTemplateDest(rel);
  return layout === "legacy" ? legacyTemplateDest(canonical) : canonical;
}

/** Destination of the generated OpenCode config seam (conditional generation). */
export const OPENCODE_CONFIG_DEST = "opencode.jsonc";

/** JSON/JSONC destinations carry no visible marker (HTML comments are invalid JSON). */
function isJsonDestination(dest: string): boolean {
  return dest.endsWith(".json") || dest.endsWith(".jsonc");
}

/**
 * TypeScript destinations (the bundled OpenCode plugin) take a `//` line
 * comment as their visible provenance marker; `//` is valid TS at any position
 * and keeps the first line syntactically inert.
 */
function isTypeScriptDestination(dest: string): boolean {
  return dest.endsWith(".ts") || dest.endsWith(".tsx");
}

/**
 * Markdown artifacts whose syntax requires YAML frontmatter on the first line
 * (OpenCode agents/commands): their visible marker is a `#` comment INSIDE the
 * frontmatter instead of a leading HTML comment.
 */
function isFrontmatterDestination(dest: string): boolean {
  return dest.startsWith(".opencode/") && dest.endsWith(".md");
}

/**
 * Visible provenance marker for a generated file (opencode-seam-010): HTML
 * comment first line by default, YAML comment inside frontmatter for OpenCode
 * Markdown artifacts, `//` line comment for TypeScript destinations, nothing
 * for JSON/JSONC destinations.
 */
export function stampGeneratedContent(
  dest: string,
  markerTemplate: string,
  content: string,
): string {
  if (isJsonDestination(dest)) return content;
  if (isTypeScriptDestination(dest)) {
    return `// arggon:generated template="${markerTemplate}"\n${content}`;
  }
  // NIT-9 (PR #322 review): tolerate a CRLF frontmatter opener so a CRLF
  // template still gets a valid frontmatter-first file; the marker line
  // matches the opener's EOL style.
  const frontmatter = /^---\r?\n/.exec(content);
  if (isFrontmatterDestination(dest) && frontmatter !== null) {
    const eol = frontmatter[0].endsWith("\r\n") ? "\r\n" : "\n";
    return (
      `${frontmatter[0]}${generatedYamlMarker(markerTemplate)}${eol}` +
      content.slice(frontmatter[0].length)
    );
  }
  return `${generatedMarker(markerTemplate)}\n${content}`;
}

/** Leading signature of the generated OpenCode config seam (stateless detection). */
const OPENCODE_CONFIG_SIGNATURE = "generated by `arggon init`";

/**
 * True when the config at `rel` is one arggon generated earlier (recognizable
 * by its signature comment even without x-generated state, e.g. a bare
 * `generateDocs` run on a directory with no `tasks/` tree, or an adopter who
 * replaced an arggon config with their own at the same path — the signature
 * decides, not the state). Adopter configs never carry the signature.
 *
 * NIT-12 (PR #322 review): the signature must sit on the file's LEADING
 * comment line (the first line whose content starts with `//`). A config that
 * merely mentions the phrase in a later comment or a string value is an
 * adopter config, not ours, and must not be claimed.
 */
function isArggonGeneratedConfig(root: string, rel: string): boolean {
  if (rel !== OPENCODE_CONFIG_DEST) return false;
  try {
    const content = readFileSync(join(root, ...rel.split("/")), "utf8");
    const leadingComment = content.split(/\r?\n/).find((line) => line.trimStart().startsWith("//"));
    return leadingComment !== undefined && leadingComment.includes(OPENCODE_CONFIG_SIGNATURE);
  } catch {
    return false;
  }
}

/**
 * OpenCode config discovery candidates (opencode-seam-010), in V2 discovery
 * order: the root and `.opencode/` JSON/JSONC shapes, both of which V2 reads.
 *
 * MINOR-3 (PR #324 review): this is the single source of truth, imported by
 * `findOpenCodeConfig` AND `doctor` (`cli/src/doctor.ts`) so the two cannot
 * drift. The use differs intentionally: `findOpenCodeConfig` returns the first
 * ADOPTER config (arggon's own generated config is skipped by signature), while
 * doctor reports every present file.
 */
export const OPENCODE_CONFIG_CANDIDATES = [
  "opencode.json",
  "opencode.jsonc",
  ".opencode/opencode.json",
  ".opencode/opencode.jsonc",
] as const;

/**
 * First existing adopter OpenCode config (opencode-seam-010), posix-relative;
 * null when the adopter has none. The check covers root and `.opencode/`
 * configurations because V2 discovers both.
 *
 * MAJOR-1 (PR #322 review): the scan skips arggon's own generated config
 * (signature comment) instead of returning it as the first existing candidate.
 * An adopter config at ANY of the four shapes always wins — before this, an
 * arggon root `opencode.jsonc` shadowed an adopter `.opencode/opencode.json(c)`
 * added after init, so generation continued and the adopter config was
 * ignored.
 */
export function findOpenCodeConfig(root: string): string | null {
  for (const rel of OPENCODE_CONFIG_CANDIDATES) {
    if (!existsSync(join(root, ...rel.split("/")))) continue;
    if (isArggonGeneratedConfig(root, rel)) continue; // ours, not an adopter config
    return rel;
  }
  return null;
}

/** Canonical (v5) destination-relative paths of the tier-2 set (generated only with `full`). */
export const TIER2_DESTS = new Set([
  "ARCHITECTURE.md",
  "CHANGELOG.md",
  "SUPPORT.md",
  `${TRACKER_DIR_NAME}/docs/convention.md`,
  `${TRACKER_DIR_NAME}/docs/engineering.md`,
  `${TRACKER_DIR_NAME}/docs/runbooks/README.md`,
  `${TRACKER_DIR_NAME}/docs/deploy.md`,
]);

/** Visible provenance marker written as the first line of every generated file. */
export function generatedMarker(template: string): string {
  return `<!-- arggon:generated template="${template}" -->`;
}

/**
 * YAML-comment provenance marker for frontmatter-first artifacts
 * (opencode-seam-010): OpenCode agents/commands must keep `---` on line one,
 * so their visible marker is the first line INSIDE the frontmatter.
 */
export function generatedYamlMarker(template: string): string {
  return `# arggon:generated template="${template}"`;
}

/** Checksum of file content exactly as recorded in `x-generated` entries. */
export function checksumOf(content: string): string {
  return `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

/**
 * Normalize line endings to LF (bug-crlf-provenance-breakage): `\r\n` and
 * lone `\r` become `\n`. COMPARE TIME only — callers use this to make
 * provenance comparisons insensitive to git's checkout smudging
 * (`* text=auto eol=crlf` in an adopter repo turns every LF doc CRLF on a
 * fresh checkout/worktree); nothing on disk or in the recorded state is ever
 * rewritten by this fix.
 */
export function normalizeEol(text: string): string {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

/**
 * EOL-tolerant provenance match (bug-crlf-provenance-breakage): does `content`
 * (the bytes on disk) match the recorded `checksum`, ignoring line-ending
 * differences? Clause matrix, all compare-time only — the recorded checksum
 * and the adopter's file are never rewritten:
 *
 *   1. exact bytes              — pre-existing behavior (mixed EOLs included);
 *                                 also covers state recorded on THIS tree's EOL.
 *   2. content normalized to LF — LF-recorded state (init/arggon write LF) on
 *                                 a CRLF working tree (`* text=auto eol=crlf`
 *                                 smudges every fresh checkout): the bug.
 *   3. content normalized to CRLF — the reverse: an ack recorded over CRLF
 *                                 bytes on a CRLF tree (adopt --ack hashes the
 *                                 current bytes) later compared from an LF
 *                                 checkout.
 */
export function checksumMatches(checksum: string, content: string): boolean {
  if (checksum === checksumOf(content)) return true;
  const lf = normalizeEol(content);
  return checksum === checksumOf(lf) || checksum === checksumOf(lf.replaceAll("\n", "\r\n"));
}

/** ArggonManager version recorded in `x-generated` entries (package.json). */
export function arggonVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(packageRoot(), "package.json"), "utf8")) as {
      version?: unknown;
    };
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
 * Recover the `{{PROJECT_NAME}}` value that was baked into a generated doc at
 * generation time (bug-project-name-dir-derived): split the CURRENT template
 * on the placeholder and match the on-disk content against the surrounding
 * text. Deterministic when the surrounding text has not changed since the
 * file was generated. `null` when the template has no placeholder, the disk
 * content no longer fits the template structure, or the extracted value is
 * empty / has an implausible charset.
 *
 * bug-crlf-provenance-breakage: both sides are EOL-normalized before the
 * anchor match, so LF-anchored template text still matches a doc that git
 * smudged to CRLF on checkout (`* text=auto eol=crlf` trees) — without the
 * normalization, projectName recovery (and with it propose/doctor's
 * name-bearing comparisons) goes inert on those trees.
 */
export function extractProjectNameFromContent(rawTemplate: string, rawDisk: string): string | null {
  const templateRaw = normalizeEol(rawTemplate);
  const disk = normalizeEol(rawDisk);
  const placeholder = "{{PROJECT_NAME}}";
  const i = templateRaw.indexOf(placeholder);
  if (i === -1) return null;
  const prefix = templateRaw.slice(0, i);
  // Anchor: the literal text between the placeholder and the NEXT template
  // placeholder — later placeholders ({{YEAR}}) were rendered at write time
  // with a value we cannot know, so only the verbatim in-between text can be
  // matched against the on-disk content.
  const suffixAnchor = templateRaw
    .slice(i + placeholder.length)
    .split("{{")[0]!
    .slice(0, 200);
  if (suffixAnchor.length === 0) return null; // no usable anchor: refuse
  const start = disk.indexOf(prefix);
  if (start === -1) return null;
  const nameStart = start + prefix.length;
  const suffixAt = disk.indexOf(suffixAnchor, nameStart);
  if (suffixAt === -1) return null;
  const name = disk.slice(nameStart, suffixAt);
  // Sane charset: repo/project directory names (letters, digits, dot, dash,
  // underscore), no whitespace or separators, bounded length.
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(name) ? name : null;
}

/** How the project name for a run was resolved (bug-project-name-dir-derived). */
export type ProjectNameResolution = {
  /** The name to render with; `null` = unrecoverable (skip name-bearing writes/compares). */
  name: string | null;
  /** "recorded" (x-generated.projectName), "content" (legacy recovery), "fresh" (dir basename, no generated content), "unrecoverable". */
  source: "recorded" | "content" | "fresh" | "unrecoverable";
};

/**
 * Layered project-name resolution for a run (bug-project-name-dir-derived),
 * in order of preference:
 *
 *   1. "recorded" — `x-generated.projectName` (state written by this fix).
 *   2. "content"  — legacy recovery: template-pattern extraction from the
 *      on-disk content of managed docs (tried in sorted destination order;
 *      the most frequent candidate wins, ties keep the first — deterministic).
 *   3. "fresh"    — no generated doc exists on disk anywhere: the tree is a
 *      fresh scaffold, where the target directory basename IS the project
 *      name.
 *   4. "unrecoverable" — generated content exists but no layer yields a
 *      name: surfaces must SKIP name-sensitive comparisons/regeneration
 *      instead of emitting false signals with a guessed name.
 */
export function resolveProjectName(
  root: string,
  opts: {
    entries: Record<string, GeneratedEntry>;
    /** Value from x-generated.projectName, when the caller already read it. */
    recorded?: string | null;
  },
): ProjectNameResolution {
  if (opts.recorded) return { name: opts.recorded, source: "recorded" };
  // Layout (ADR 0012): current-template destinations follow the tree's tracker
  // layout so the on-disk probes below hit the right docs dir.
  const layout = trackerAt(root)?.layout ?? "arggon-manager";
  // Marker prefix of any arggon-generated doc: content WITHOUT it is
  // adopter-owned, never generated — it must not count as prior generation
  // (a fresh scaffold may legitimately have an adopter AGENTS.md on disk).
  const GENERATED_PREFIX = "<!-- arggon:generated ";
  const candidates: string[] = [];
  let sawGeneratedContent = false;
  // Managed-doc candidates: every x-generated entry, plus every destination
  // arggon currently generates (covers pre-projectName trees whose state was
  // hand-migrated and marker-bearing docs with no state entry).
  const dests = new Set<string>([
    ...Object.keys(opts.entries),
    ...currentGeneratedTemplates({ layout }).map((t) => t.dest),
  ]);
  for (const dest of [...dests].sort()) {
    const templateRel =
      opts.entries[dest]?.template ??
      currentGeneratedTemplates({ layout }).find((t) => t.dest === dest)?.template;
    if (templateRel === undefined) continue;
    try {
      const templatePath = isBundledSource(templateRel)
        ? bundledSourcePath(bundledTemplatesDir(), templateRel)
        : resolve(bundledTemplatesDir(), ...templateRel.split("/"));
      if (!existsSync(templatePath)) continue;
      const disk = readFileSync(join(root, ...dest.split("/")), "utf8");
      if (disk.startsWith(GENERATED_PREFIX)) sawGeneratedContent = true;
      else continue; // adopter-owned (no provenance marker): never extract from it
      const raw = readFileSync(templatePath, "utf8");
      const name = extractProjectNameFromContent(raw, disk);
      if (name !== null) candidates.push(name);
    } catch {
      continue; // unreadable template or doc: try the next managed doc
    }
  }
  if (candidates.length > 0) {
    const counts = new Map<string, number>();
    for (const c of candidates) counts.set(c, (counts.get(c) ?? 0) + 1);
    let best = candidates[0]!;
    for (const [c, n] of counts) if (n > counts.get(best)!) best = c;
    return { name: best, source: "content" };
  }
  if (!sawGeneratedContent) return { name: basename(root), source: "fresh" };
  return { name: null, source: "unrecoverable" };
}

/**
 * Every doc arggon currently generates (tier-1 + tier-2 + bundled sources), as
 * destination path → source template (package-root relative). Doctor uses the
 * template ids to flag stale `x-generated` entries.
 */
export function currentGeneratedTemplates(opts?: {
  layout?: TrackerLayout;
}): { dest: string; template: string }[] {
  return currentGeneratedTemplatesFrom(bundledTemplatesDir(), opts?.layout);
}

/**
 * Same walk, but rooted at an explicit templates dir (task-doctor-outdated-
 * bucket injection point for tests: doctor points it at a mutable fixture
 * copy of `templates/` to simulate upstream template movement). The layout
 * must mirror the package root: `<templatesDir>/docs/**` plus the bundled
 * sources at `<templatesDir>/../skills/...` and `<templatesDir>/../opencode/...`.
 * `layout` selects the destination form (canonical v5 by default, legacy
 * `<root>/docs/...` when explicitly requested).
 */
export function currentGeneratedTemplatesFrom(
  templatesDir: string,
  layout: TrackerLayout = "arggon-manager",
): { dest: string; template: string }[] {
  const docsSrc = resolve(templatesDir, "docs");
  const found: { dest: string; template: string }[] = [];
  if (existsSync(docsSrc)) {
    for (const rel of walkTemplates(docsSrc)) {
      found.push({ dest: mapTemplateDest(rel, layout), template: `docs/${rel}` });
    }
  }
  // Bundled sources are current destinations even when the render source is
  // absent from an injected fixture layout: doctor's `templatesRoot` is only
  // overridden by tests, and a fixture copy of `templates/` (plus `skills/`)
  // may legitimately omit the sibling `opencode/` tree. Including the entry
  // unconditionally keeps their `x-generated` state out of the `stale` bucket
  // (the destination IS still current); `renderGeneratedDoc` returns null for
  // a missing source, which doctor reads as "cannot decide", never outdated.
  for (const bundled of BUNDLED_SOURCES) {
    found.push({ dest: bundled.dest, template: bundled.source });
  }
  return found.sort((a, b) => a.dest.localeCompare(b.dest));
}

/**
 * Pure render of a managed doc exactly as `generateDocs` would write it
 * (task-doctor-outdated-bucket): visible provenance marker (HTML comment, the
 * YAML `#` variant for OpenCode Markdown artifacts, or the `//` variant for
 * TypeScript; JSON/JSONC destinations get none) plus placeholder resolution —
 * {{PROJECT_NAME}} from `projectName` when given (bug-project-name-dir-derived:
 * the resolved/recorded name, consistent across the whole run; `null` means
 * unrecoverable → renders `null`, i.e. "cannot decide"), falling back to the
 * target root's dir name — and {{YEAR}}
 * from the current year. Zero writes, never throws: a missing or unreadable
 * template yields `null` (doctor treats that as "cannot decide", i.e. not
 * outdated). `template` is the `x-generated` template id (package-root
 * relative, e.g. "docs/AGENTS.md" or a bundled source path).
 */
export function renderGeneratedDoc(opts: {
  templatesDir: string;
  root: string;
  template: string;
  dest: string;
  now?: Date;
  /**
   * Resolved project name (bug-project-name-dir-derived). `null` = the name
   * could not be recovered: the render is refused (null) so name-sensitive
   * comparisons skip with `project-name-unrecoverable` semantics. Omitted =
   * legacy behavior (dir basename).
   */
  projectName?: string | null;
}): string | null {
  try {
    const path = isBundledSource(opts.template)
      ? bundledSourcePath(opts.templatesDir, opts.template)
      : resolve(opts.templatesDir, ...opts.template.split("/"));
    if (!existsSync(path)) return null;
    if (opts.projectName === null) return null; // project-name-unrecoverable
    const raw = readFileSync(path, "utf8");
    const vars = {
      projectName: opts.projectName ?? basename(opts.root),
      year: (opts.now ?? new Date()).getFullYear(),
    };
    const rendered = renderDocPlaceholders(raw, vars);
    // Mirror generateDocs' marker convention: doc templates are stamped with
    // the docs-dir-relative name ("AGENTS.md"), bundled sources (skill, plugin)
    // with their full package-root-relative path — while the x-generated state
    // template id is the "docs/"-prefixed path for docs. JSON/JSONC
    // destinations carry no marker; OpenCode Markdown artifacts take it inside
    // frontmatter; TypeScript takes a `//` line.
    const markerTemplate = isBundledSource(opts.template)
      ? opts.template
      : opts.template.replace(/^docs\//, "");
    return stampGeneratedContent(opts.dest, markerTemplate, rendered);
  } catch {
    return null;
  }
}

/**
 * How many files arggon currently generates with a full init (tier-1 + tier-2
 * docs, .mcp.json, and the bundled skills/plugin). Derived from the same
 * template walk generateDocs uses, so adding the next template touches only
 * `templates/` and this module — tests import this constant instead of
 * hardcoding the count (task-adopt-scan-count-constant).
 */
export const GENERATED_DOC_COUNT: number = currentGeneratedTemplates().length;

function utcDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Pure planner (task-init-dry-run-plan): computes the full per-destination
 * decision table WITHOUT touching the filesystem — no files, no backup dir,
 * no state mutation. Shared by `generateDocs` (plan, then apply) and init's
 * `--dry-run` preview, so there is exactly one decision implementation.
 */
export function planGenerateDocs(opts: GenerateDocsOptions): DocsPlan {
  const packageRootDir = resolve(bundledTemplatesDir(), "..");
  const bundledSources = BUNDLED_SOURCES.map((s) => ({
    ...s,
    src: resolve(packageRootDir, ...s.source.split("/")),
  }));
  const docsSrc = resolve(bundledTemplatesDir(), "docs");
  if (!existsSync(docsSrc)) {
    throw new Error(`Bundled doc templates not found at ${docsSrc}`);
  }
  const now = opts.now ?? new Date();
  const version = arggonVersion();
  const generatedAt = now.toISOString();
  // Layout (ADR 0012): explicit caller choice (init picks the tree's layout),
  // else detected at root, else the v5 default for fresh scaffolds.
  const layout: TrackerLayout = opts.layout ?? trackerAt(opts.root)?.layout ?? "arggon-manager";
  const statePath = conventionPathForLayout(opts.root, layout);
  const hasStateFile = opts.rawState !== undefined || existsSync(statePath);
  const prevState = opts.prev ?? (hasStateFile ? readGeneratedState(opts.root) : {});
  const nextState: Record<string, GeneratedEntry> = { ...prevState };

  // Project-name resolution (bug-project-name-dir-derived): recorded state
  // first, then legacy content recovery, then the dir-basename fallback for
  // fresh scaffolds. `null` = unrecoverable: name-bearing writes are skipped
  // (in `decide`) instead of baking in a guessed name.
  const recordedName =
    opts.prevProjectName !== undefined
      ? opts.prevProjectName
      : opts.rawState !== undefined
        ? parseGeneratedProjectName(opts.rawState)
        : hasStateFile
          ? readGeneratedProjectName(opts.root)
          : null;
  const nameRes = resolveProjectName(opts.root, {
    entries: prevState,
    recorded: recordedName,
  });
  const vars = {
    projectName: nameRes.name ?? basename(opts.root),
    year: new Date().getFullYear(),
  };
  const entries: DocsPlanEntry[] = [];

  const stamp = (
    markerTemplate: string,
    stateTemplate: string,
    content: string,
    dest: string,
  ): { content: string; entry: GeneratedEntry } => {
    // JSON/JSONC destinations (e.g. .mcp.json, the OpenCode config seam) must
    // stay valid JSON: no visible marker there — x-generated checksum
    // provenance still applies. OpenCode Markdown artifacts take the marker
    // inside their YAML frontmatter (opencode-seam-010).
    const withMarker = stampGeneratedContent(dest, markerTemplate, content);
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
   * Shared per-destination provenance decision (Copier/Helm semantics) — the
   * single source of truth for what a run would do with this destination.
   */
  const decide = (
    dest: string,
    markerTemplate: string,
    stateTemplate: string,
    render: () => string,
    nameBearing: boolean,
  ): DocsPlanEntry => {
    const destAbs = join(opts.root, ...dest.split("/"));
    const { content, entry } = stamp(markerTemplate, stateTemplate, render(), dest);
    // Safe degradation (bug-project-name-dir-derived): on an already-written
    // tree whose project name cannot be recovered, never write a render that
    // bakes the directory basename in. The file/state are left exactly as
    // they are — nothing degrades.
    const nameSkip = (): DocsPlanEntry => ({
      dest,
      decision: "project-name-unrecoverable",
      reason:
        "project-name-unrecoverable — existing generated docs are present but the " +
        "project name could not be recovered (no x-generated.projectName, content " +
        "extraction failed); skipped instead of rendering the directory basename in",
    });
    if (!existsSync(destAbs)) {
      if (nameBearing && nameRes.name === null) return nameSkip();
      return {
        dest,
        decision: "created",
        reason: "missing on disk — generated from the current template",
        write: content,
        entry,
      };
    }
    const prev = prevState[dest];
    if (prev?.acknowledged) {
      // Acknowledged baseline (`arggon adopt --ack`,
      // bug-ack-baseline-regen-loss): the recorded checksum equals the
      // adopter's sanctioned content, NOT the template render — regenerating
      // here destroyed adopter content. Acknowledged entries are never
      // touched; the skip reason is implicit (sanctioned-diverged baseline).
      return {
        dest,
        decision: "acked-skip",
        reason: "acknowledged baseline (arggon adopt --ack) — adopter-owned, never regenerated",
      };
    }
    const onDisk = readFileSync(destAbs, "utf8");
    // bug-crlf-provenance-breakage: EOL-tolerant match — an untouched doc on a
    // git-smudged CRLF working tree still counts as untouched (LF-recorded
    // state matches via the normalized clause), so it keeps regenerating
    // instead of degrading to adopter-modified.
    if (prev?.checksum && checksumMatches(prev.checksum, onDisk)) {
      if (nameBearing && nameRes.name === null) return nameSkip();
      // Untouched: silently regenerate from the current template.
      return {
        dest,
        decision: "updated",
        reason: "untouched since last generation — regenerated from the current template",
        write: content,
        entry,
      };
    }
    // Adopter-modified (edited, or on disk with no provenance state).
    if (opts.backup) {
      if (nameBearing && nameRes.name === null) return nameSkip();
      const backupDest = `backup/${utcDate(now)}/${dest}`;
      return {
        dest,
        decision: "modified-backup",
        reason: `adopter-modified — archived to ${backupDest}, then regenerated`,
        write: content,
        entry,
        backupDest,
      };
    }
    return {
      dest,
      decision: "modified-skip",
      reason: "adopter-modified — kept (rerun with --backup to archive and regenerate)",
    };
  };

  for (const rel of walkTemplates(docsSrc)) {
    // Tier membership is checked on the canonical destination so legacy trees
    // gate the same set; the written destination follows the tree's layout.
    if (!opts.full && TIER2_DESTS.has(canonicalTemplateDest(rel))) continue;
    const dest = mapTemplateDest(rel, layout);
    // Conditional config seam (opencode-seam-010): never write an OpenCode
    // config over an adopter's existing one — report the skip with the path
    // that was detected so `init` stays transparent. findOpenCodeConfig
    // returns only NON-arggon configs (MAJOR-1, PR #322 review), so any
    // adopter config at any of the four shapes present-skip; arggon's own file
    // falls through to the normal provenance decision (regenerate untouched,
    // skip modified).
    if (dest === OPENCODE_CONFIG_DEST) {
      const existing = findOpenCodeConfig(opts.root);
      if (existing !== null) {
        entries.push({
          dest,
          decision: "present-skip",
          reason:
            `adopter OpenCode config present at ${existing} — config seam not generated ` +
            `(add "mcp.servers.arggon" manually if wanted)`,
        });
        continue;
      }
    }
    const raw = readFileSync(join(docsSrc, ...rel.split("/")), "utf8");
    entries.push(
      decide(
        dest,
        rel,
        `docs/${rel}`,
        () => renderDocPlaceholders(raw, vars),
        raw.includes("{{PROJECT_NAME}}"),
      ),
    );
  }

  // Bundle the package-root artifacts — the agent skills (skills/) and the
  // OpenCode V2 plugin (opencode/plugins/) — from their single sources, NOT
  // template duplicates, so adopters get them by default.
  for (const bundled of bundledSources) {
    if (!existsSync(bundled.src)) continue;
    const bundledRaw = readFileSync(bundled.src, "utf8");
    entries.push(
      decide(
        bundled.dest,
        bundled.source,
        bundled.source,
        () => bundledRaw,
        bundledRaw.includes("{{PROJECT_NAME}}"),
      ),
    );
  }
  // Missing bundle source (e.g. stripped packaging): skip silently — docs
  // generation must never fail because an optional bundle is absent.

  // Template removed from the bundle: the `x-generated` entry is orphaned
  // (doctor reports the same destinations as `stale`). Informational only —
  // a real run leaves the entry exactly as it is.
  const generatedDests = new Set(currentGeneratedTemplates({ layout }).map((t) => t.dest));
  for (const dest of Object.keys(prevState)) {
    if (!generatedDests.has(dest)) {
      entries.push({
        dest,
        decision: "stale",
        reason: "template no longer generated — x-generated entry is orphaned",
      });
    }
  }

  const applied = entries.filter((e) => e.write !== undefined);
  for (const e of applied) nextState[e.dest] = e.entry!;
  const plan: DocsPlan = {
    entries: entries.sort((a, b) => a.dest.localeCompare(b.dest)),
    created: applied
      .filter((e) => e.decision === "created")
      .map((e) => e.dest)
      .sort(),
    updated: applied
      .filter((e) => e.decision === "updated")
      .map((e) => e.dest)
      .sort(),
    modified: entries
      .filter((e) => e.decision === "modified-skip" || e.decision === "modified-backup")
      .map((e) => e.dest)
      .sort(),
    backedUp: applied
      .filter((e) => e.decision === "modified-backup")
      .map((e) => e.dest)
      .sort(),
    skipped: entries
      .filter(
        (e) =>
          e.decision === "modified-skip" ||
          e.decision === "acked-skip" ||
          e.decision === "present-skip" ||
          e.decision === "project-name-unrecoverable",
      )
      .map((e) => e.dest)
      .sort(),
  };
  // Record the provenance state whenever the convention file exists (init
  // writes it before generating). Outside init (bare generateDocs on a dir
  // without a tasks/ tree) there is no state file to extend — markers are
  // still stamped, and those files later count as adopter-modified until a
  // run with a state file adopts them.
  if (hasStateFile) {
    plan.stateWrite = {
      path: statePath,
      content: updateGeneratedSection(
        opts.rawState ?? readFileSync(statePath, "utf8"),
        nextState,
        // Record the resolved project name once (bug-project-name-dir-
        // derived) so future runs — including from worktrees and renamed
        // clones — never re-derive it from the directory basename.
        nameRes.name ?? recordedName ?? undefined,
      ),
    };
  }
  return plan;
}

/**
 * Apply a pure plan (task-init-dry-run-plan): exactly the writes a real run
 * performs — archive-then-write per destination plus the pending state
 * rewrite — and nothing else. `generateDocs` = plan + apply.
 */
export function applyDocsPlan(root: string, plan: DocsPlan): DocsResult {
  for (const e of plan.entries) {
    if (e.write === undefined) continue;
    if (e.backupDest !== undefined) {
      const backupAbs = join(root, ...e.backupDest.split("/"));
      mkdirSync(dirname(backupAbs), { recursive: true });
      renameSync(join(root, ...e.dest.split("/")), backupAbs);
    }
    const destAbs = join(root, ...e.dest.split("/"));
    mkdirSync(dirname(destAbs), { recursive: true });
    writeFileSync(destAbs, e.write, "utf8");
  }
  if (plan.stateWrite) {
    // Atomic (bug-atomic-write-followups F3): readers (readConventionConfig,
    // readConventionVersion) must never observe the truncate window.
    writeFileAtomic(plan.stateWrite.path, plan.stateWrite.content);
  }
  return {
    created: plan.created,
    updated: plan.updated,
    modified: plan.modified,
    backedUp: plan.backedUp,
    skipped: plan.skipped,
  };
}

export function generateDocs(opts: GenerateDocsOptions): DocsResult {
  return applyDocsPlan(opts.root, planGenerateDocs(opts));
}
