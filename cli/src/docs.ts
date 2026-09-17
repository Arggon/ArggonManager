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
  | "stale";

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
  "mcp-json": ".mcp.json",
};

/** Destination-relative paths of the tier-2 set (generated only with `full`). */
const TIER2_DESTS = new Set([
  "ARCHITECTURE.md",
  "CHANGELOG.md",
  "SUPPORT.md",
  "docs/convention.md",
  "docs/engineering.md",
  "docs/runbooks/README.md",
  "docs/deploy.md",
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

/**
 * How many files arggon currently generates with a full init (tier-1 + tier-2
 * docs, .mcp.json, and the bundled skill). Derived from the same template walk
 * generateDocs uses, so adding the next template touches only `templates/` and
 * this module — tests import this constant instead of hardcoding the count
 * (task-adopt-scan-count-constant).
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
  const skillSrc = resolve(packageRootDir, ...SKILL_SOURCE.split("/"));
  const docsSrc = resolve(bundledTemplatesDir(), "docs");
  if (!existsSync(docsSrc)) {
    throw new Error(`Bundled doc templates not found at ${docsSrc}`);
  }
  const vars = { projectName: basename(opts.root), year: new Date().getFullYear() };
  const entries: DocsPlanEntry[] = [];

  const now = opts.now ?? new Date();
  const version = arggonVersion();
  const generatedAt = now.toISOString();
  const statePath = join(opts.root, "tasks", ".convention.yml");
  const hasStateFile = opts.rawState !== undefined || existsSync(statePath);
  const prevState = opts.prev ?? (hasStateFile ? readGeneratedState(opts.root) : {});
  const nextState: Record<string, GeneratedEntry> = { ...prevState };

  const stamp = (
    markerTemplate: string,
    stateTemplate: string,
    content: string,
    dest: string,
  ): { content: string; entry: GeneratedEntry } => {
    // JSON destinations (e.g. .mcp.json) must stay valid JSON: MCP clients
    // parse the file directly, and an HTML comment as the first line would
    // break them. Skip the marker there; x-generated checksum provenance
    // still applies (checksum covers the exact bytes written).
    const withMarker = dest.endsWith(".json")
      ? content
      : `${generatedMarker(markerTemplate)}\n${content}`;
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
  ): DocsPlanEntry => {
    const destAbs = join(opts.root, ...dest.split("/"));
    const { content, entry } = stamp(markerTemplate, stateTemplate, render(), dest);
    if (!existsSync(destAbs)) {
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
    const onDisk = checksumOf(readFileSync(destAbs, "utf8"));
    if (prev?.checksum && prev.checksum === onDisk) {
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
    const dest = DOC_PATH_MAP[rel] ?? rel;
    if (!opts.full && TIER2_DESTS.has(dest)) continue;
    entries.push(
      decide(dest, rel, `docs/${rel}`, () =>
        renderDocPlaceholders(readFileSync(join(docsSrc, ...rel.split("/")), "utf8"), vars),
      ),
    );
  }

  // Bundle the arggon-cli skill from its single source (skills/ in this repo —
  // NOT a template duplicate) so agents in the adopter repo use it by default.
  if (existsSync(skillSrc)) {
    entries.push(decide(SKILL_DEST, SKILL_SOURCE, SKILL_SOURCE, () => readFileSync(skillSrc, "utf8")));
  }
  // Missing skill source (e.g. stripped packaging): skip silently — docs
  // generation must never fail because an optional bundle is absent.

  // Template removed from the bundle: the `x-generated` entry is orphaned
  // (doctor reports the same destinations as `stale`). Informational only —
  // a real run leaves the entry exactly as it is.
  const generatedDests = new Set(currentGeneratedTemplates().map((t) => t.dest));
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
    created: applied.filter((e) => e.decision === "created").map((e) => e.dest).sort(),
    updated: applied.filter((e) => e.decision === "updated").map((e) => e.dest).sort(),
    modified: entries
      .filter((e) => e.decision === "modified-skip" || e.decision === "modified-backup")
      .map((e) => e.dest)
      .sort(),
    backedUp: applied.filter((e) => e.decision === "modified-backup").map((e) => e.dest).sort(),
    skipped: entries
      .filter((e) => e.decision === "modified-skip" || e.decision === "acked-skip")
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
    writeFileSync(plan.stateWrite.path, plan.stateWrite.content, "utf8");
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
