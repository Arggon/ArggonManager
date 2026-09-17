import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { bundledTemplatesDir } from "./paths.js";
import {
  CONVENTION_VERSION,
  DEFAULT_BRANCH_PATTERNS,
  readGeneratedState,
  updateGeneratedSection,
} from "./convention.js";
import {
  applyDocsPlan,
  arggonVersion,
  currentGeneratedTemplates,
  planGenerateDocs,
  renderGeneratedDoc,
  TIER2_DESTS,
  type DocsPlan,
} from "./docs.js";
import type { ItemType } from "./ids.js";
import {
  commitTrackerMutation,
  readAutoCommitConfig,
  resolveAutoCommit,
  trackerCommitMessage,
  type TrackerCommitResult,
} from "./tracker-commit.js";

const CONVENTION_YML =
  `version: ${CONVENTION_VERSION}\n` +
  `branch_patterns:\n` +
  (Object.keys(DEFAULT_BRANCH_PATTERNS) as ItemType[])
    .map((type) => `  ${type}: "${DEFAULT_BRANCH_PATTERNS[type]}"\n`)
    .join("");

export type InitOptions = {
  dir: string;
  force: boolean;
  /** Also generate the tier-2 doc set (ARCHITECTURE.md, docs/convention.md, ...). */
  full?: boolean;
  /** Archive adopter-modified docs to backup/<date>/<dest> before regenerating. */
  backup?: boolean;
  /** Injection point for tests: generation timestamp (defaults to now). */
  now?: Date;
  /**
   * Auto-commit the files this run wrote (tracker hygiene,
   * bug-init-leaves-docs-untracked-start-blocks-on-clean-tree): a fresh init
   * must not leave ~20 untracked docs behind, or `start`'s clean-tree
   * precondition blocks the very next step. Surgical staging — exactly the
   * written paths, never `git add -A`. `undefined` resolves via
   * `x-tracker.auto-commit` config, default ON; best effort (non-git trees
   * and git-absent machines skip with a reason, command stays ok).
   */
  commit?: boolean;
  /**
   * Proposal mode (task-init-propose-acked-updates): instead of the normal
   * regenerate/skip buckets, write fresh template renders for every acked OR
   * adopter-modified destination whose CURRENT render differs from disk to
   * SIDE FILES (`<dest>.proposed-<arggonVersion>`); originals are never
   * touched and the x-generated state is never mutated. The adopting agent
   * diffs/merges as normal work, re-acks via `arggon adopt --ack`, and
   * deletes the proposal. Never auto-commits anything.
   */
  propose?: boolean;
};

export type InitResult = {
  root: string;
  alreadyInitialized: boolean;
  force: boolean;
  created: string[];
  /** Untouched docs regenerated from the current template (state refreshed). */
  updated: string[];
  /** Adopter-modified docs (skipped, or regenerated after --backup). */
  modified: string[];
  /** Modified docs archived to backup/<date>/<dest> before regeneration. */
  backedUp: string[];
  /** Doc files left untouched (never overwritten). */
  skipped: string[];
  restored: string[];
  conventionPath: string;
  /** Side-file upgrade proposals (--propose, task-init-propose-acked-updates, additive). */
  proposals?: ProposalEntry[];
  /** Tracker auto-commit outcome for the files written this run. */
  commit?: TrackerCommitResult;
  /**
   * Present only when the target tree is NOT a git repository
   * (bug-init-git-doctor-blindspot): branch/worktree/push/PR flows and the
   * pre-commit validate hook are unavailable until the adopter runs
   * `git init`. Surfaced as a stderr warning (human output) and this additive
   * JSON field; auto-commit skipping stays the expected, quiet default.
   * Never auto-`git init` — explicitly out of scope.
   */
  warning?: string;
};

function ensureTemplates(root: string, force: boolean): string[] {  const templatesDest = join(root, "templates");
  const templatesSrc = bundledTemplatesDir();
  if (!existsSync(templatesSrc)) {
    throw new Error(`Bundled templates not found at ${templatesSrc}`);
  }
  mkdirSync(templatesDest, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(templatesSrc)) {
    if (!name.endsWith(".md")) continue;
    const dest = join(templatesDest, name);
    if (existsSync(dest) && !force) continue;
    copyFileSync(join(templatesSrc, name), dest);
    copied.push(name);
  }
  return copied;
}

/**
 * Tracker hygiene (bug-init-leaves-docs-untracked-start-blocks-on-clean-tree):
 * commit exactly the files this run wrote — docs, templates, tasks/ tree and
 * tasks/.convention.yml (its x-generated state must ride along so the first
 * commit is self-consistent). Surgical staging (`git add -- <path>`), never
 * `git add -A`; best effort — non-git trees and git-absent machines skip with
 * a reason and the command stays ok. A re-run that rewrote nothing (identical
 * bytes) hits the quiet "nothing to commit" skip, keeping HEAD untouched.
 */
function commitGeneratedDocs(
  root: string,
  writtenPaths: string[],
  commitFlag: boolean | undefined,
): TrackerCommitResult {
  const paths = [...new Set(writtenPaths)].sort();
  return commitTrackerMutation(root, paths, {
    message: trackerCommitMessage("generated", [`init docs (${paths.length} files)`]),
    commit: resolveAutoCommit(commitFlag, readAutoCommitConfig(root)),
  });
}

const NOT_A_REPO_WARNING =
  "not a git repository — branch/worktree/push/PR flows and the pre-commit " +
  "validate hook will be unavailable until you run `git init`";

/**
 * bug-init-git-doctor-blindspot: is the target tree inside a git repository?
 * Best-effort probe (`git rev-parse --git-dir`), false when git is absent.
 */
function isGitRepo(root: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * One planned scaffold action (tasks/.convention.yml, templates/) — the doc
 * destinations carry the richer DocsPlanEntry shape.
 */
export type InitPlanEntry = {
  dest: string;
  decision: string;
  reason: string;
  /** Archive target for modified-backup decisions (relative to root). */
  backupDest?: string;
};

/**
 * Pure plan of a full init run (task-init-dry-run-plan): scaffold decisions +
 * the per-destination doc plan, computed with ZERO writes. Shared by runInit
 * (plan, then apply) and the `--dry-run` preview, so there is exactly one
 * decision implementation.
 */
export type InitPlan = {
  root: string;
  alreadyInitialized: boolean;
  force: boolean;
  full: boolean;
  backup: boolean;
  /** tasks/.convention.yml + templates/ decisions (doc dests live in `docs`). */
  scaffold: InitPlanEntry[];
  /** Per-destination doc plan (pure; includes bytes a real run would write). */
  docs: DocsPlan;
  /** Fatal precondition, identical to the error runInit would throw. */
  error?: string;
};

/**
 * Pure planner: exactly what init would do, without touching the target tree
 * — no scaffold writes, no template copies, no doc generation, no backup dir,
 * no auto-commit. Mirrors runInit's branch structure one-to-one.
 */
export function planInit(opts: InitOptions): InitPlan {
  const root = resolve(opts.dir);
  const tasksDir = join(root, "tasks");
  const conventionPath = join(tasksDir, ".convention.yml");
  const alreadyInitialized = existsSync(conventionPath);
  const base = {
    root,
    alreadyInitialized,
    force: opts.force,
    full: Boolean(opts.full),
    backup: Boolean(opts.backup),
  };

  if (alreadyInitialized && !opts.force) {
    // Idempotent upgrade path: only missing templates are restored.
    const scaffold: InitPlanEntry[] = listBundledTemplates()
      .filter((name) => !existsSync(join(root, "templates", name)))
      .map((name) => ({
        dest: `templates/${name}`,
        decision: "created",
        reason: "template missing — restored from the bundle",
      }));
    return {
      ...base,
      scaffold,
      docs: planGenerateDocs({ root, full: Boolean(opts.full), backup: opts.backup, now: opts.now }),
    };
  }

  if (existsSync(tasksDir) && !alreadyInitialized && !opts.force) {
    return {
      ...base,
      scaffold: [],
      docs: { entries: [], created: [], updated: [], modified: [], backedUp: [], skipped: [] },
      error: `tasks/ exists but is missing .convention.yml. Re-run with --force to scaffold, or fix manually.`,
    };
  }

  // Fresh scaffold, or a forced re-scaffold (x-generated provenance carried
  // over so untouched docs keep regenerating instead of degrading to
  // adopter-modified — the doc plan must see the carried state).
  const carried = opts.force && alreadyInitialized ? readGeneratedState(root) : {};
  const scaffold: InitPlanEntry[] = [
    alreadyInitialized
      ? {
          dest: "tasks/.convention.yml",
          decision: "overwritten",
          reason: "force re-scaffold — x-generated provenance carried over",
        }
      : { dest: "tasks/.convention.yml", decision: "created", reason: "convention scaffold" },
  ];
  for (const name of listBundledTemplates()) {
    scaffold.push(
      existsSync(join(root, "templates", name))
        ? {
            dest: `templates/${name}`,
            decision: "overwritten",
            reason: "exists — --force recopies it from the bundle",
          }
        : { dest: `templates/${name}`, decision: "created", reason: "copied from the bundled templates" },
    );
  }
  return {
    ...base,
    scaffold,
    docs: planGenerateDocs({
      root,
      full: Boolean(opts.full),
      backup: opts.backup,
      now: opts.now,
      prev: carried,
      // The scaffold write (above, in runInit) lands before docs are applied,
      // so the plan sees the convention file it will exist by then and plans
      // the pending x-generated rewrite against the scaffolded content.
      rawState: updateGeneratedSection(CONVENTION_YML, carried),
    }),
  };
}

/**
 * Template .md file names in the bundled templates dir (best effort).
 */
function listBundledTemplates(): string[] {
  const templatesSrc = bundledTemplatesDir();
  if (!existsSync(templatesSrc)) return [];
  return readdirSync(templatesSrc).filter((name) => name.endsWith(".md"));
}

/**
 * One side-file upgrade proposal (task-init-propose-acked-updates). `basedOnVersion`
 * is the arggon version the fresh render comes from (and the proposal filename
 * suffix); `added`/`removed` carry the compact line-diff summary (human output).
 */
export type ProposalEntry = {
  /** Destination the proposal upgrades (posix, relative to root). */
  dest: string;
  /** Side-file path (posix, relative to root): `<dest>.proposed-<version>`. */
  proposalPath: string;
  /**
   * `proposed` — fresh render differs from disk, side file written/overwritten;
   * `absorbed` — the destination now matches the render, so this run's own
   * same-version stale side file was removed; `stale` — a side file from a
   * DIFFERENT (older) arggon version is still on disk: reported, never deleted.
   */
  decision: "proposed" | "absorbed" | "stale";
  /** Source template id (x-generated style, package-root relative). */
  template: string;
  /** Arggon version of the render (and filename suffix) behind this entry. */
  basedOnVersion: string;
  /** Diff summary vs the on-disk original (proposed only). */
  added?: number;
  removed?: number;
};

/**
 * Distinguishing header ABOVE the standard generated marker (task-init-propose-
 * acked-updates): an agent reading only the proposal file must know what to do.
 * JSON destinations stay header-less (and marker-less, like normal generation)
 * so the proposal remains parseable.
 */
export function proposalContent(
  dest: string,
  version: string,
  render: string,
  now?: Date,
): string {
  if (dest.endsWith(".json")) return render;
  const header =
    `<!-- arggon:proposed-update dest="${dest}" version="${version}" ` +
    `generated="${(now ?? new Date()).toISOString()}"; diff against the original, ` +
    `merge what you want, then re-ack via arggon adopt --ack and delete this file -->\n`;
  return header + render;
}

/** Naive line-diff summary (LCS) for the human proposal listing. */
function diffSummary(before: string, after: string): { added: number; removed: number } {
  const a = before.split("\n");
  const b = after.split("\n");
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  return { added: b.length - lcs[0][0], removed: a.length - lcs[0][0] };
}

/** Proposal side files already on disk for a dest: version -> present. */
function existingProposals(destAbs: string): Map<string, boolean> {
  const dir = dirname(destAbs);
  const base = destAbs.split("/").pop()!;
  const found = new Map<string, boolean>();
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(`${base}.proposed-`)) continue;
    found.set(name.slice(`${base}.proposed-`.length), true);
  }
  return found;
}

/**
 * Pure plan (task-init-propose-acked-updates) of exactly what `init --propose`
 * would write/remove, computed with ZERO writes: for every generated
 * destination (acked OR adopter-modified — unchanged untouched docs are
 * regenerated by a plain init anyway) whose CURRENT template render differs
 * from disk, a `proposed` side-file entry; a destination that now matches its
 * render reports its own same-version leftover as `absorbed` (removed on
 * apply); older-version side files are reported `stale` and left alone.
 * Requires an initialized tree (x-generated state reader).
 */
export function planProposals(root: string, full: boolean, now?: Date): ProposalEntry[] {
  const version = arggonVersion();
  const out: ProposalEntry[] = [];
  for (const { dest, template } of currentGeneratedTemplates()) {
    if (!full && TIER2_DESTS.has(dest)) continue;
    const destAbs = join(root, ...dest.split("/"));
    if (!existsSync(destAbs)) continue; // a plain init generates it; nothing to propose
    let disk: string;
    try {
      disk = readFileSync(destAbs, "utf8");
    } catch {
      continue;
    }
    const render = renderGeneratedDoc({
      templatesDir: bundledTemplatesDir(),
      root,
      template,
      dest,
      now,
    });
    if (render === null) continue; // template absent/unreadable: cannot decide
    const proposalPath = `${dest}.proposed-${version}`;
    const versions = existingProposals(destAbs);
    // Older-version side files: reported as stale, never silently deleted.
    for (const v of [...versions.keys()].filter((v) => v !== version).sort()) {
      out.push({
        dest,
        proposalPath: `${dest}.proposed-${v}`,
        decision: "stale",
        template,
        basedOnVersion: v,
      });
    }
    if (disk === render) {
      // Absorbed: someone merged (or the template caught up); this run's own
      // same-version leftover is removed by the real run.
      if (versions.has(version)) {
        out.push({ dest, proposalPath, decision: "absorbed", template, basedOnVersion: version });
      }
      continue;
    }
    const { added, removed } = diffSummary(disk, render);
    out.push({ dest, proposalPath, decision: "proposed", template, basedOnVersion: version, added, removed });
  }
  return out.sort((a, b) => a.proposalPath.localeCompare(b.proposalPath));
}

/**
 * Apply a proposal plan (task-init-propose-acked-updates): write/overwrite the
 * `proposed` side files, remove the `absorbed` same-version leftovers, and
 * touch NOTHING else — originals stay byte-identical, x-generated state is
 * never mutated, nothing is committed (proposals are untracked working files).
 */
export function applyProposals(root: string, proposals: ProposalEntry[], now?: Date): void {
  for (const p of proposals) {
    const abs = join(root, ...p.proposalPath.split("/"));
    if (p.decision === "stale") continue;
    if (p.decision === "absorbed") {
      rmSync(abs, { force: true });
      continue;
    }
    const render = renderGeneratedDoc({
      templatesDir: bundledTemplatesDir(),
      root,
      template: p.template,
      dest: p.dest,
      now,
    });
    if (render === null) continue; // vanished between plan and apply: skip
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, proposalContent(p.dest, p.basedOnVersion, render, now), "utf8");
  }
}

/** Preconditions shared by the propose paths of runInit and dryRunInit. */
function proposePreconditions(opts: InitOptions): string | undefined {
  if (opts.force) return "init --propose does not combine with --force (proposals never touch originals; drop --force)";
  if (opts.backup) return "init --propose does not combine with --backup (proposals never regenerate; drop --backup)";
  return undefined;
}

const NOT_INITIALIZED_PROPOSE_ERROR =
  "not an arggon-managed tree — run `arggon init` first (--propose upgrades already-generated docs)";

/**
 * Pure-read dry run (task-init-dry-run-plan): the full init plan per
 * destination with ZERO writes — no files, no backup dir, no auto-commit, no
 * state mutation; even the git repo is untouched. The derived bucket arrays
 * match what a real run with the same flags would emit, 1:1.
 */
export type InitDryRunResult = {
  root: string;
  alreadyInitialized: boolean;
  force: boolean;
  full: boolean;
  backup: boolean;
  conventionPath: string;
  /** Every planned action: scaffold decisions first, then docs by dest. */
  plan: InitPlanEntry[];
  /** Buckets exactly as a real run with the same flags would report them. */
  created: string[];
  updated: string[];
  modified: string[];
  backedUp: string[];
  skipped: string[];
  restored: string[];
  /** Proposal plan with --propose (task-init-propose-acked-updates, additive). */
  proposals?: ProposalEntry[];
  /** Same not-a-git-repo warning a real run would surface. */
  warning?: string;
};

export function dryRunInit(opts: InitOptions): InitDryRunResult {
  const proposeError = opts.propose ? proposePreconditions(opts) : undefined;
  if (proposeError) throw new Error(proposeError);
  const plan = planInit(opts);
  if (plan.error) throw new Error(plan.error);
  const root = plan.root;
  const conventionPath = join(root, "tasks", ".convention.yml");
  const warning = isGitRepo(root) ? undefined : NOT_A_REPO_WARNING;

  // Propose dry run: list the proposal writes/removals, write nothing.
  if (opts.propose) {
    if (!existsSync(conventionPath)) throw new Error(NOT_INITIALIZED_PROPOSE_ERROR);
    const proposals = planProposals(root, Boolean(opts.full), opts.now);
    return {
      root,
      alreadyInitialized: true,
      force: false,
      full: Boolean(opts.full),
      backup: false,
      conventionPath,
      plan: proposals.map((p) => ({
        dest: p.dest,
        decision: p.decision,
        reason:
          p.decision === "proposed"
            ? `would write ${p.proposalPath} (template render differs from disk)`
            : p.decision === "absorbed"
              ? `destination matches upstream — would remove its ${p.basedOnVersion} proposal`
              : `older-version proposal left on disk — reported, not removed`,
      })),
      created: [],
      updated: [],
      modified: [],
      backedUp: [],
      skipped: [],
      restored: [],
      proposals,
      warning,
    };
  }

  const docEntries: InitPlanEntry[] = plan.docs.entries.map((e) => ({
    dest: e.dest,
    decision: e.decision,
    reason: e.reason,
    ...(e.backupDest !== undefined ? { backupDest: e.backupDest } : {}),
  }));
  if (plan.alreadyInitialized && !opts.force) {
    return {
      root,
      alreadyInitialized: true,
      force: false,
      full: plan.full,
      backup: plan.backup,
      conventionPath,
      plan: [...plan.scaffold, ...docEntries],
      created: plan.docs.created,
      updated: plan.docs.updated,
      modified: plan.docs.modified,
      backedUp: plan.docs.backedUp,
      skipped: plan.docs.skipped,
      restored: plan.scaffold.map((e) => e.dest).sort(),
      warning,
    };
  }
  const scaffoldWritten = plan.scaffold
    .filter((e) => e.decision === "created" || e.decision === "overwritten")
    .map((e) => e.dest);
  return {
    root,
    alreadyInitialized: plan.alreadyInitialized,
    force: opts.force,
    full: plan.full,
    backup: plan.backup,
    conventionPath,
    plan: [...plan.scaffold, ...docEntries],
    created: [...scaffoldWritten, ...plan.docs.created].sort(),
    updated: plan.docs.updated,
    modified: plan.docs.modified,
    backedUp: plan.docs.backedUp,
    skipped: plan.docs.skipped,
    restored: [],
    warning,
  };
}

export function runInit(opts: InitOptions): InitResult {
  // Propose mode (task-init-propose-acked-updates): side-file upgrade
  // proposals only — originals untouched, state unmutated, nothing committed.
  if (opts.propose) {
    const proposeError = proposePreconditions(opts);
    if (proposeError) throw new Error(proposeError);
    const root = resolve(opts.dir);
    const conventionPath = join(root, "tasks", ".convention.yml");
    if (!existsSync(conventionPath)) throw new Error(NOT_INITIALIZED_PROPOSE_ERROR);
    const proposals = planProposals(root, Boolean(opts.full), opts.now);
    applyProposals(root, proposals, opts.now);
    return {
      root,
      alreadyInitialized: true,
      force: false,
      created: [],
      updated: [],
      modified: [],
      backedUp: [],
      skipped: [],
      restored: [],
      conventionPath,
      proposals,
      warning: isGitRepo(root) ? undefined : NOT_A_REPO_WARNING,
    };
  }
  // Plan first (task-init-dry-run-plan): the shared pure planner computes
  // every per-destination decision; runInit then applies it. No duplicated
  // decision code between the real run and `--dry-run`.
  const plan = planInit(opts);
  if (plan.error) throw new Error(plan.error);
  const root = plan.root;
  const tasksDir = join(root, "tasks");
  const conventionPath = join(tasksDir, ".convention.yml");
  // Compute once up front; attached to every result shape below.
  const gitWarning = isGitRepo(root) ? undefined : NOT_A_REPO_WARNING;

  if (plan.alreadyInitialized && !opts.force) {
    const restored = ensureTemplates(root, false)
      .map((name) => `templates/${name}`)
      .sort();
    const docs = applyDocsPlan(root, plan.docs);
    const written = [...restored, ...docs.created, ...docs.updated, "tasks/.convention.yml"];
    return {
      root,
      alreadyInitialized: true,
      force: false,
      created: docs.created,
      updated: docs.updated,
      modified: docs.modified,
      backedUp: docs.backedUp,
      skipped: docs.skipped,
      restored,
      conventionPath,
      commit: commitGeneratedDocs(root, written, opts.commit),
      warning: gitWarning,
    };
  }

  mkdirSync(tasksDir, { recursive: true });
  // A forced re-scaffold carries the x-generated provenance section over so
  // untouched docs keep regenerating instead of degrading to adopter-modified.
  const carried = opts.force && plan.alreadyInitialized ? readGeneratedState(root) : {};
  writeFileSync(conventionPath, updateGeneratedSection(CONVENTION_YML, carried), "utf8");
  const copiedTemplates = ensureTemplates(root, opts.force).map((name) => `templates/${name}`);
  const docs = applyDocsPlan(root, plan.docs);
  const created = ["tasks/.convention.yml", ...copiedTemplates, ...docs.created].sort();
  const written = [...created, ...docs.updated];

  return {
    root,
    alreadyInitialized: plan.alreadyInitialized,
    force: opts.force,
    created,
    updated: docs.updated,
    modified: docs.modified,
    backedUp: docs.backedUp,
    skipped: docs.skipped,
    restored: [],
    conventionPath,
    commit: commitGeneratedDocs(root, written, opts.commit),
    warning: gitWarning,
  };
}
