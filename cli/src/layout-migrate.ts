import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { CONVENTION_VERSION, parseConventionConfig, updateGeneratedSection } from "./convention.js";
import { writeFileAtomic } from "./atomic.js";
import { findTrackerLocation, LEGACY_TRACKER_DIR_NAME, TRACKER_DIR_NAME } from "./paths.js";

/**
 * `arggon migrate --layout` (ADR 0012): move a legacy `tasks/` tracker (and
 * its product docs at `<root>/docs/`) to the v5 layout — tracker root
 * `ArggonManager/`, product docs under `ArggonManager/docs/` — and bump the
 * convention version. Convergent and idempotent: it performs whichever of the
 * steps are still pending (tracker move, docs move, x-generated path rewrite,
 * version bump) and reports "already migrated" when none are.
 *
 * Provenance-safe: the moved files keep their bytes; only the machine-written
 * `x-generated` destination keys (and the `version:` line) are rewritten.
 * Never auto-commits — the migration is a reviewable change; commit it once.
 */
export type LayoutMigrateOptions = {
  cwd: string;
  /** Plan only: report the actions and write NOTHING. */
  dryRun?: boolean;
};

export type LayoutMigrateMove = { from: string; to: string };

export type LayoutMigrateResult = {
  /** Repo root (parent of the tracker dir). */
  root: string;
  dryRun: boolean;
  /** True when the tree already uses the v5 layout and no state needed rewriting. */
  alreadyMigrated: boolean;
  /** `tasks/` → `ArggonManager/` when the tracker dir moved. */
  trackerMove: LayoutMigrateMove | null;
  /** `<root>/docs/` → `<root>/ArggonManager/docs/` when the docs moved. */
  docsMove: LayoutMigrateMove | null;
  /** Version bump applied to `.convention.yml` (null when already current). */
  versionBump: { from: number; to: number } | null;
  /** `x-generated` destination keys rewritten to the v5 layout. */
  rewrittenGeneratedPaths: LayoutMigrateMove[];
  /** True when at least one action was (or, on dry-run, would be) applied. */
  changed: boolean;
  /** Absolute tracker dir after the migration. */
  trackerDir: string;
  /** Absolute product-docs dir after the migration. */
  docsDir: string;
};

/** Layout paths relative to the repo root, for human/JSON reporting. */
function rel(root: string, abs: string): string {
  return abs.startsWith(root) ? abs.slice(root.length + 1) : abs;
}

export function runLayoutMigrate(opts: LayoutMigrateOptions): LayoutMigrateResult {
  const dryRun = Boolean(opts.dryRun);
  const loc = findTrackerLocation(opts.cwd);
  const root = loc.repoRoot;

  // Ambiguity guard: two trackers at the same root cannot be migrated
  // mechanically — the user must pick one (never guess, never merge silently).
  const bothExist =
    existsSync(join(root, TRACKER_DIR_NAME, ".convention.yml")) &&
    existsSync(join(root, LEGACY_TRACKER_DIR_NAME, ".convention.yml"));
  if (bothExist) {
    throw new Error(
      `both ${TRACKER_DIR_NAME}/ and legacy ${LEGACY_TRACKER_DIR_NAME}/ carry a .convention.yml — ` +
        `refusing to guess which tracker is authoritative; remove or merge one, then re-run`,
    );
  }

  const trackerMove: LayoutMigrateMove | null = loc.legacy
    ? { from: join(root, LEGACY_TRACKER_DIR_NAME), to: join(root, TRACKER_DIR_NAME) }
    : null;
  if (trackerMove !== null && existsSync(trackerMove.to)) {
    throw new Error(
      `${rel(root, trackerMove.to)}/ already exists — refusing to overwrite it while moving ` +
        `${rel(root, trackerMove.from)}/; move its contents aside (or merge them) manually, then re-run`,
    );
  }

  const trackerDir = trackerMove !== null ? trackerMove.to : loc.dir;
  const docsDir = join(trackerDir, "docs");
  const legacyDocsDir = join(root, "docs");
  // Docs move only when the legacy docs dir exists OUTSIDE the (new) tracker
  // dir and the destination does not. A v5 tree with docs already inside is a
  // no-op; both existing is ambiguous (never merge silently).
  let docsMove: LayoutMigrateMove | null = null;
  if (trackerDir !== legacyDocsDir && existsSync(legacyDocsDir)) {
    if (existsSync(docsDir)) {
      throw new Error(
        `both ${rel(root, legacyDocsDir)}/ and ${rel(root, docsDir)}/ exist — refusing to ` +
          `merge them automatically; reconcile the two docs trees manually, then re-run`,
      );
    }
    docsMove = { from: legacyDocsDir, to: docsDir };
  }

  // .convention.yml rewrite plan: version bump + x-generated dest keys that
  // still point at the legacy `<root>/docs/...` locations. Read from the
  // CURRENT tracker dir; write to the post-move path below.
  const currentConventionPath = join(loc.dir, ".convention.yml");
  const conventionPath = join(trackerDir, ".convention.yml");
  const raw = readFileSync(currentConventionPath, "utf8");
  const config = parseConventionConfig(raw, conventionPath);
  const rewrittenGeneratedPaths: LayoutMigrateMove[] = [];
  const nextGenerated: typeof config.generated = {};
  for (const [dest, entry] of Object.entries(config.generated)) {
    const mapped = dest.startsWith("docs/") ? `${TRACKER_DIR_NAME}/${dest}` : dest;
    if (mapped !== dest) {
      rewrittenGeneratedPaths.push({ from: dest, to: mapped });
    }
    nextGenerated[mapped] = entry;
  }
  const versionBump =
    config.version < CONVENTION_VERSION ? { from: config.version, to: CONVENTION_VERSION } : null;

  const changed =
    trackerMove !== null ||
    docsMove !== null ||
    versionBump !== null ||
    rewrittenGeneratedPaths.length > 0;

  if (!dryRun && changed) {
    if (trackerMove !== null) renameSync(trackerMove.from, trackerMove.to);
    if (docsMove !== null) {
      // The destination tracker dir exists (it was just moved, or already was
      // the v5 root); rename creates `<tracker>/docs` inside it.
      renameSync(docsMove.from, docsMove.to);
    }
    if (versionBump !== null || rewrittenGeneratedPaths.length > 0) {
      let base = raw;
      if (!/^version\s*:/m.test(base)) {
        base = `version: ${CONVENTION_VERSION}\n${base}`;
      } else if (versionBump !== null) {
        base = base.replace(/^version\s*:\s*\d+.*$/m, `version: ${CONVENTION_VERSION}`);
      }
      const next = updateGeneratedSection(base, nextGenerated, config.generatedProjectName);
      // Atomic (F3): readers must never observe a torn .convention.yml.
      writeFileAtomic(conventionPath, next);
    }
  }

  return {
    root,
    dryRun,
    alreadyMigrated: !changed,
    trackerMove,
    docsMove,
    versionBump,
    rewrittenGeneratedPaths,
    changed,
    trackerDir,
    docsDir,
  };
}

/** Human-readable summary of a migration result (CLI prints it). */
export function formatLayoutMigrateHuman(result: LayoutMigrateResult): string {
  const lines: string[] = [];
  if (result.alreadyMigrated) {
    lines.push(
      `arggon migrate --layout: already on the ${TRACKER_DIR_NAME}/ layout (nothing to do)`,
    );
    return lines.join("\n");
  }
  lines.push(`arggon migrate --layout${result.dryRun ? " (dry run)" : ""}:`);
  if (result.trackerMove) {
    lines.push(
      `  move tracker: ${rel(result.root, result.trackerMove.from)}/ → ${rel(result.root, result.trackerMove.to)}/`,
    );
  }
  if (result.docsMove) {
    lines.push(
      `  move docs: ${rel(result.root, result.docsMove.from)}/ → ${rel(result.root, result.docsMove.to)}/`,
    );
  }
  if (result.versionBump) {
    lines.push(`  convention version: ${result.versionBump.from} → ${result.versionBump.to}`);
  }
  for (const p of result.rewrittenGeneratedPaths) {
    lines.push(`  x-generated: ${p.from} → ${p.to}`);
  }
  if (result.dryRun) {
    lines.push("nothing was written (dry run)");
  } else {
    lines.push(
      "migrate never auto-commits — review the changes and commit the migration as one change.",
    );
  }
  return lines.join("\n");
}
