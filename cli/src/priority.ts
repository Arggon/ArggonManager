/**
 * Convention v4 `priority` field (spec-priority-field-008): the shared enum,
 * its assertion helper, and the `arggon priority migrate` kernel.
 *
 * The field is optional on ALL five item types; absent = unprioritized (never
 * defaulted). The migrate kernel moves the legacy `pN` LABEL convention into
 * the field (highest priority = lowest number wins), strips every pN label,
 * and writes atomically WITHOUT committing — a bulk rewrite is a planning act
 * the caller reviews (`git diff`) and lands as ONE explicit commit, mirroring
 * `adopt --ack` semantics.
 */
import { formatDate } from "./dates.js";
import { stringifyFrontmatter } from "./frontmatter.js";
import { writeFileAtomic } from "./atomic.js";
import { loadItems, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { relative, sep } from "node:path";

/** The v4 priority enum (lowercase, exact). p0 = drop everything … p3 = lowest. */
export const PRIORITIES = ["p0", "p1", "p2", "p3"] as const;

export type Priority = (typeof PRIORITIES)[number];

/** The legacy label convention this module migrates: exactly one digit. */
export const PRIORITY_LABEL_PATTERN = /^p[0-9]$/;

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

/** Kernel-boundary assertion; the message doubles as the docs wording. */
export function assertPriority(value: string): asserts value is Priority {
  if (!isPriority(value)) {
    throw new Error(`invalid priority '${value}' (expected one of: ${PRIORITIES.join(", ")})`);
  }
}

/** Ordinal of a valid priority (p0 = 0 … p3 = 3); callers validate first. */
export function priorityRank(priority: Priority): number {
  return PRIORITIES.indexOf(priority);
}

export type PriorityMigrateOptions = {
  cwd: string;
  /** Plan only: compute and report the per-item changes, write NOTHING. */
  dryRun?: boolean;
  /** Clock override for deterministic tests; defaults to now. */
  now?: Date;
};

export type PriorityMigrateEntry = {
  id: string;
  type: WorkItem["type"];
  /** Posix path relative to the repo root. */
  path: string;
  /** The item's priority AFTER the run (always set: participants carry a pN label or a field). */
  priority: Priority | null;
  /** Every pN label removed from the label list, lexicographic. */
  labelsRemoved: string[];
  /**
   * Where the reported `priority` came from: `label` (field was absent and
   * was written from the highest-priority label) or `kept-explicit` (the
   * field was already set — an explicit value wins over the legacy label).
   */
  prioritySource: "label" | "kept-explicit";
  /** Present only for `kept-explicit` items whose field differs from the label-derived value. */
  conflictLabel?: Priority;
};

export type PriorityMigrateResult = {
  /** Repo root (parent of tasks/). */
  root: string;
  dryRun: boolean;
  /** Items scanned under tasks/. */
  scanned: number;
  /** Items this run wrote (or would write under --dry-run). */
  changed: number;
  /** Per-item plan/changes, lexicographic by id. */
  entries: PriorityMigrateEntry[];
};

/**
 * Move the legacy `pN` label convention into the v4 `priority` field across
 * every item under tasks/. An item participates when its labels contain a
 * token matching `^p[0-9]$` (`p10`, `p2x`, `P2` are left alone). All pN
 * labels are removed; non-priority labels ride along untouched. The field
 * destination is the HIGHEST priority among the labels (lowest number);
 * an item that already carries an explicit `priority` KEEPS it (labels are
 * still removed, the conflict is reported) so a deliberate value is never
 * clobbered by stale labels.
 *
 * Writes are atomic per item and bump `updated` like every frontmatter
 * mutation. The kernel NEVER commits — the caller reviews and commits once.
 * Idempotent: after a run no item carries a pN label, so a second run is a
 * zero-change scan.
 */
export function runPriorityMigrate(opts: PriorityMigrateOptions): PriorityMigrateResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const items = loadItems(tasksDir).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const entries: PriorityMigrateEntry[] = [];
  for (const item of items) {
    const pLabels = item.labels.filter((label) => PRIORITY_LABEL_PATTERN.test(label));
    if (pLabels.length === 0) continue;

    // Highest priority = lowest number among the labels (p0 < p1 < p2 < p3).
    const labelPriority = pLabels.reduce<Priority>(
      (best, label) => (priorityRank(label as Priority) < priorityRank(best) ? (label as Priority) : best),
      pLabels[0]! as Priority,
    );

    const explicit = (item.priority ?? null) as Priority | null;
    const keptExplicit = explicit !== null;
    const finalPriority = keptExplicit ? explicit : labelPriority;

    const entry: PriorityMigrateEntry = {
      id: item.id,
      type: item.type,
      path: relative(root, item.filePath).split(sep).join("/"),
      priority: finalPriority,
      labelsRemoved: [...pLabels].sort(),
      prioritySource: keptExplicit ? "kept-explicit" : "label",
      ...(keptExplicit && explicit !== labelPriority ? { conflictLabel: labelPriority } : {}),
    };
    entries.push(entry);

    if (opts.dryRun) continue;

    const data = { ...item.data };
    if (!keptExplicit) data.priority = finalPriority;
    data.labels = item.labels.filter((label) => !PRIORITY_LABEL_PATTERN.test(label));
    data.updated = formatDate(opts.now ?? new Date());
    writeFileAtomic(item.filePath, stringifyFrontmatter(data, item.body));
  }

  return {
    root,
    dryRun: opts.dryRun === true,
    scanned: items.length,
    changed: entries.length,
    entries,
  };
}
