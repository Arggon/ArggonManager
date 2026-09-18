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
import { dirname, join, relative, resolve, sep } from "node:path";
import { writeFileAtomic } from "./atomic.js";
import { bundledTemplatesDir } from "./paths.js";
import {
  CONVENTION_VERSION,
  DEFAULT_BRANCH_PATTERNS,
  readGeneratedProjectName,
  readGeneratedState,
  updateGeneratedSection,
} from "./convention.js";
import {
  applyDocsPlan,
  arggonVersion,
  currentGeneratedTemplates,
  normalizeEol,
  planGenerateDocs,
  renderGeneratedDoc,
  resolveProjectName,
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
  /**
   * Force whole-file proposals (spec-propose-section-backports-007): opt back
   * OUT of the default section-level mode. Without it, destinations with
   * recoverable git history get section-level region proposals; whole-file
   * remains the automatic fallback when the as-generated baseline cannot be
   * recovered (no git history / untracked dest).
   */
  proposeWholeFile?: boolean;
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
  // Carry the recorded project name over the re-scaffold too
  // (bug-project-name-dir-derived): the plan must record the same name the
  // tree already uses, not re-derive it from the (possibly worktree) dirname.
  const carriedName = opts.force && alreadyInitialized ? readGeneratedProjectName(root) : null;
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
      prevProjectName: carriedName,
      // The scaffold write (above, in runInit) lands before docs are applied,
      // so the plan sees the convention file it will exist by then and plans
      // the pending x-generated rewrite against the scaffolded content.
      rawState: updateGeneratedSection(CONVENTION_YML, carried, carriedName),
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
 * One region of a section-level proposal (spec-propose-section-backports-007):
 * a maximal run the template ADDED (`kind: "added"`) or CHANGED relative to the
 * as-generated baseline (the dest's first committed version). Anchors quote
 * UNCHANGED surrounding baseline text so the adopting agent can locate the
 * insertion point in THEIR curated file.
 */
export type ProposalRegionDetail = {
  kind: "added" | "changed";
  added: number;
  removed: number;
  /** New-render lines of the region (what to insert). */
  content: string;
  /** Up to 3 unchanged baseline lines immediately before the region. */
  anchorBefore: string;
  /** Up to 3 unchanged baseline lines immediately after the region. */
  anchorAfter: string;
};

/** Compact per-region summary carried on the entry (and the JSON payload). */
export type ProposalRegionSummary = {
  kind: "added" | "changed";
  added: number;
  removed: number;
};

/**
 * One side-file upgrade proposal (task-init-propose-acked-updates). `basedOnVersion`
 * is the arggon version the fresh render comes from (and the proposal filename
 * suffix); `added`/`removed` carry the compact line-diff summary (human output).
 * Spec-propose-section-backports-007 adds the `mode` split: section-level
 * region proposals are the DEFAULT for destinations whose as-generated
 * baseline is recoverable from git history; whole-file remains the explicit
 * (`--propose-whole-file`) and automatic-fallback mode.
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
   * DIFFERENT (older) arggon version is still on disk: reported, never deleted;
   * `informational` — section-mode diff yielded ONLY removals (the template
   * lost content the adopter has): reported, no side file, nothing deleted.
   */
  decision: "proposed" | "absorbed" | "stale" | "informational";
  /** Source template id (x-generated style, package-root relative). */
  template: string;
  /** Arggon version of the render (and filename suffix) behind this entry. */
  basedOnVersion: string;
  /** Diff summary vs the on-disk original (proposed only; region sums in sections mode). */
  added?: number;
  removed?: number;
  /** Proposal mode (proposed only; spec-propose-section-backports-007). */
  mode?: "sections" | "whole-file";
  /** Per-region summaries (sections mode only). */
  regions?: ProposalRegionSummary[];
  /** Why nothing is proposed (informational only). */
  note?: string;
  /** Full region details for apply (sections mode; not serialized to JSON). */
  regionDetails?: ProposalRegionDetail[];
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
  // JSONC destinations take the same path as JSON (MINOR-4, PR #322 review):
  // an HTML proposal header would make the proposed config invalid JSONC.
  if (dest.endsWith(".json") || dest.endsWith(".jsonc")) return render;
  const header =
    `<!-- arggon:proposed-update dest="${dest}" version="${version}" ` +
    `generated="${(now ?? new Date()).toISOString()}"; diff against the original, ` +
    `merge what you want, then re-ack via arggon adopt --ack and delete this file -->\n`;
  return header + render;
}

/** Naive line-diff summary (LCS) for the human proposal listing. */
function diffSummary(before: string, after: string): { added: number; removed: number } {
  const regions = diffRegions(before, after);
  let a = 0;
  let r = 0;
  for (const region of regions) {
    a += region.added;
    r += region.removed;
  }
  return { added: a, removed: r };
}

/**
 * Structural line diff (spec-propose-section-backports-007): LCS backtrace
 * grouping every maximal run of non-matching lines into one region. Regions
 * carry the new-render lines plus up to 3 UNCHANGED baseline lines on each
 * side as anchors for locating the insertion point in the adopter's file.
 * A removed-only diff yields zero regions (callers report it informational —
 * adopter content is never proposed for deletion).
 */
function diffRegions(before: string, after: string): ProposalRegionDetail[] {
  const a = before.split("\n");
  const b = after.split("\n");
  // lcs[i][j] = LCS length of a[i..] and b[j..] (same core as diffSummary).
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const regions: ProposalRegionDetail[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    const startI = i;
    const addedLines: string[] = [];
    while (
      (i < a.length || j < b.length) &&
      !(i < a.length && j < b.length && a[i] === b[j])
    ) {
      if (i < a.length && (j >= b.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
        i++; // baseline line consumed (removed or replaced)
      } else {
        addedLines.push(b[j]!);
        j++;
      }
    }
    const anchor = (from: number, to: number): string =>
      a.slice(Math.max(0, from), to).join("\n");
    regions.push({
      kind: startI === i ? "added" : "changed",
      added: addedLines.length,
      removed: i - startI,
      content: addedLines.join("\n"),
      anchorBefore: anchor(Math.max(0, startI - 3), startI),
      anchorAfter: anchor(i, Math.min(a.length, i + 3)),
    });
  }
  return regions;
}

/**
 * Recover the AS-GENERATED baseline of a destination from git history
 * (spec-propose-section-backports-007): the file's FIRST committed version
 * (init auto-commits what it writes) is exactly what the old template
 * rendered. `null` when the tree is not a repo, the dest was never committed,
 * or git is absent — callers fall back to whole-file proposals.
 */
function gitFirstCommittedContent(root: string, destAbs: string): string | null {
  try {
    const toplevel = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const rel = relative(toplevel, destAbs).split(sep).join("/");
    if (rel.startsWith("..")) return null; // dest outside the repo: no history
    const hash = execFileSync(
      "git",
      ["log", "--diff-filter=A", "-n1", "--format=%H", "--", rel],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
    if (hash === "") return null;
    return execFileSync("git", ["show", `${hash}:${rel}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

/**
 * Section-level proposal side file (spec-propose-section-backports-007): ONE
 * file per dest, delimited region blocks. Each region quotes unchanged
 * surrounding text (the anchors) so the agent can locate the insertion point
 * in THEIR curated file, then the new-render lines to insert. Bodies are
 * indented (4 spaces), not fenced, so embedded backticks cannot break a block.
 */
export function sectionProposalContent(
  dest: string,
  version: string,
  regions: ProposalRegionDetail[],
  now?: Date,
): string {
  const header =
    `<!-- arggon:proposed-update dest="${dest}" version="${version}" ` +
    `generated="${(now ?? new Date()).toISOString()}" mode="sections"; the template ` +
    `changed ${regions.length} region(s) since this doc was generated — apply each ` +
    `region to YOUR file at the quoted anchors, then re-ack via arggon adopt --ack ` +
    `and delete this file -->\n`;
  const blocks = regions.map((r, idx) => {
    const parts = [
      `## region ${idx + 1} of ${regions.length} — ${r.kind} (+${r.added}/-${r.removed})`,
    ];
    if (r.anchorBefore) {
      parts.push("anchor-before (insert after the matching text in YOUR file):", indent(r.anchorBefore));
    }
    parts.push("insert:", indent(r.content));
    if (r.anchorAfter) {
      parts.push("anchor-after (insert before the matching text in YOUR file):", indent(r.anchorAfter));
    }
    return parts.join("\n\n");
  });
  return blocks.length > 0 ? `${header}\n${blocks.join("\n\n")}\n` : header;
}

/** Indent every line of a block by 4 spaces (empty lines stay empty). */
function indent(block: string): string {
  return block
    .split("\n")
    .map((line) => (line === "" ? "" : `    ${line}`))
    .join("\n");
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
 *
 * Mode selection (spec-propose-section-backports-007): by default a dest whose
 * AS-GENERATED baseline is recoverable from git history (its first committed
 * version) gets a SECTION-LEVEL proposal containing only the regions the
 * template ADDED/CHANGED since generation; a removed-only diff becomes an
 * `informational` entry (adopter content is never proposed for deletion);
 * without recoverable history (or with `wholeFile`) the dest falls back to
 * today's whole-file proposal.
 */
export function planProposals(
  root: string,
  full: boolean,
  now?: Date,
  wholeFile?: boolean,
): ProposalEntry[] {
  const version = arggonVersion();
  const out: ProposalEntry[] = [];
  // Project-name resolution once per run (bug-project-name-dir-derived):
  // recorded state, then legacy content recovery. When unrecoverable
  // (`name === null`), renderGeneratedDoc refuses name-bearing renders, so
  // those destinations get NO proposal — a divergence signal built on a
  // guessed directory basename would be a false positive.
  const nameRes = resolveProjectName(root, {
    entries: readGeneratedState(root),
    recorded: readGeneratedProjectName(root),
  });
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
      projectName: nameRes.name,
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
    // bug-crlf-provenance-breakage: every render-vs-disk compare and diff
    // below is EOL-normalized — a git-smudged CRLF working tree (`* text=auto
    // eol=crlf`) is "absorbed"/identical exactly when the LF checkout is, and
    // diff region/line counts never inflate from line endings alone. Compare
    // time only: the adopter's files are never rewritten.
    const diskN = normalizeEol(disk);
    const renderN = normalizeEol(render);
    if (diskN === renderN) {
      // Absorbed: someone merged (or the template caught up); this run's own
      // same-version leftover is removed by the real run.
      if (versions.has(version)) {
        out.push({ dest, proposalPath, decision: "absorbed", template, basedOnVersion: version });
      }
      continue;
    }
    // Section-level mode (spec-propose-section-backports-007): diff the
    // as-generated baseline (first committed version) against the current
    // render; propose only the added/changed regions. Any baseline failure
    // (no git, untracked dest) falls back to whole-file.
    if (!wholeFile) {
      const base = gitFirstCommittedContent(root, destAbs);
      if (base !== null) {
        const regionDetails = diffRegions(normalizeEol(base), renderN).filter((r) => r.added > 0);
        if (regionDetails.length === 0) {
          // Removed-only diff (or base === render): the template gained
          // nothing backportable — never propose deleting adopter content.
          out.push({
            dest,
            proposalPath,
            decision: "informational",
            template,
            basedOnVersion: version,
            note:
              "template gained nothing since this doc was generated (removed-only or no " +
              "template drift vs the as-generated baseline) — nothing to backport",
          });
          continue;
        }
        const totals = regionDetails.reduce(
          (acc, r) => ({ added: acc.added + r.added, removed: acc.removed + r.removed }),
          { added: 0, removed: 0 },
        );
        out.push({
          dest,
          proposalPath,
          decision: "proposed",
          template,
          basedOnVersion: version,
          added: totals.added,
          removed: totals.removed,
          mode: "sections",
          regions: regionDetails.map(({ kind, added, removed }) => ({ kind, added, removed })),
          regionDetails,
        });
        continue;
      }
    }
    const { added, removed } = diffSummary(diskN, renderN);
    out.push({
      dest,
      proposalPath,
      decision: "proposed",
      template,
      basedOnVersion: version,
      added,
      removed,
      mode: "whole-file",
    });
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
  // Same resolution as planProposals (bug-project-name-dir-derived): the
  // name must be identical between plan and apply.
  const nameRes = resolveProjectName(root, {
    entries: readGeneratedState(root),
    recorded: readGeneratedProjectName(root),
  });
  for (const p of proposals) {
    const abs = join(root, ...p.proposalPath.split("/"));
    if (p.decision === "stale" || p.decision === "informational") continue;
    if (p.decision === "absorbed") {
      rmSync(abs, { force: true });
      continue;
    }
    // Section-level proposal (spec-propose-section-backports-007): the plan
    // captured the region details; write only those, never the whole render.
    if (p.mode === "sections" && p.regionDetails && p.regionDetails.length > 0) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(
        abs,
        sectionProposalContent(p.dest, p.basedOnVersion, p.regionDetails, now),
        "utf8",
      );
      continue;
    }
    const render = renderGeneratedDoc({
      templatesDir: bundledTemplatesDir(),
      root,
      template: p.template,
      dest: p.dest,
      now,
      projectName: nameRes.name,
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
    const proposals = planProposals(root, Boolean(opts.full), opts.now, opts.proposeWholeFile);
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
            ? `would write ${p.proposalPath} (template render differs from disk${p.mode === "sections" ? `, ${p.regions?.length ?? 0} region(s)` : ", whole file"})`
            : p.decision === "absorbed"
              ? `destination matches upstream — would remove its ${p.basedOnVersion} proposal`
              : p.decision === "informational"
                ? (p.note ?? "nothing to backport")
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
    const proposals = planProposals(root, Boolean(opts.full), opts.now, opts.proposeWholeFile);
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
  const carriedName = opts.force && plan.alreadyInitialized ? readGeneratedProjectName(root) : null;
  // Atomic (bug-atomic-write-followups F3): a concurrent reader
  // (readConventionConfig in branch/list/view paths) must never observe the
  // truncate window of this rewrite.
  writeFileAtomic(conventionPath, updateGeneratedSection(CONVENTION_YML, carried, carriedName));
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
