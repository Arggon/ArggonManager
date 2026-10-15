import { classifyAcceptance, type AcceptanceState } from "./acceptance.js";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { sanitizeHumanTextUncapped } from "./sanitize.js";
import { STATUSES, type Status } from "./status.js";

export type StatusCounts = Record<Status, number> & { total: number };

export function emptyCounts(): StatusCounts {
  return { todo: 0, in_progress: 0, blocked: 0, done: 0, cancelled: 0, total: 0 };
}

export type ReportContainer = {
  id: string;
  title: string;
  type: string;
  counts: StatusCounts;
  /** True when the story has no task/bug leaves. */
  empty: boolean;
  /**
   * Report-only product-acceptance state of the container, from the `accept:`
   * header convention (ADR 0021 §4, `classifyAcceptance`):
   * `accepted｜changes-noted｜none｜self-accepted` — one bounded enum token,
   * additive within `schemaVersion: 1`.
   *
   * UNCONDITIONAL, unlike the `spec analyze` detector: this is a pure read of
   * the container's own body (`none` for every project that never adopted the
   * convention), while arming `x-tracker.product-acceptance: true` is what
   * turns a missing record into a REPORTED one. Keeping the field ungated is
   * what makes the ratio behind the spec's deferred-gate metric computable.
   *
   * NOT rendered in the human table: a project reads it from `--json` (and the
   * MCP/native `report` envelope, same payload) with no change to the text
   * surface it already reads.
   */
  acceptance: AcceptanceState;
};

export type ReportGroup = {
  epic: { id: string; title: string };
  initiative: { id: string; title: string } | null;
  /** One entry per story under the epic (possibly empty). */
  containers: ReportContainer[];
  /** Sums over the epic's stories. */
  totals: StatusCounts;
  /** True when the epic has no stories. */
  empty: boolean;
};

export type ReportResult = {
  root: string;
  groups: ReportGroup[];
  /** Blocked leaves across the tree, with their story and epic chain (for the standup markdown). */
  blocked: ReportBlocked[];
  /** Report-only container hygiene (task-container-hygiene-check); see `containerHygiene`. */
  hygiene: ReportHygiene;
};

/** A blocked leaf: reason is never empty (convention requires blocked_reason). */
export type ReportBlocked = {
  id: string;
  type: "task" | "bug";
  title: string;
  storyId: string | null;
  epicId: string | null;
  blockedReason: string;
};

/**
 * A non-terminal container found in an offender's subtree — an unfinished
 * workstream (story/epic; initiatives are roots and can never nest).
 */
export type ReportHygieneOpenContainer = {
  id: string;
  type: "story" | "epic";
  status: "todo" | "in_progress" | "blocked";
};

/** A terminal container holding at least one non-terminal container below it. */
export type ReportHygieneOffender = {
  id: string;
  type: "initiative" | "epic" | "story";
  status: "done" | "cancelled";
  /** Non-terminal containers in the subtree, sorted by id, capped at `MAX_HYGIENE_OPEN_CONTAINERS`. */
  openContainers: ReportHygieneOpenContainer[];
  /** Full open-container count before the cap (equals `openContainers.length` when nothing was dropped). */
  openContainersTotal: number;
};

/** The `report` command's additive hygiene section (schemaVersion 1, display only). */
export type ReportHygiene = {
  /** Containers examined (initiative/epic/story), terminal or not. */
  checked: number;
  /** Offenders, sorted by id, capped at `MAX_HYGIENE_OFFENDERS`. */
  offenders: ReportHygieneOffender[];
  /** Full offender count before the cap (equals `offenders.length` when nothing was dropped). */
  offendersTotal: number;
};

/**
 * Caps for the bounded hygiene section — the same bounded-report discipline as
 * `MAX_MISSING_DEPENDENCIES` / `MAX_DETAIL_ACCEPTANCE_ROWS` (the report itself
 * had no caps): enough rows to name the offenders, with the totals carrying
 * the full counts so nothing is silently lost.
 */
export const MAX_HYGIENE_OFFENDERS = 10;
export const MAX_HYGIENE_OPEN_CONTAINERS = 5;

/** Container types (the items that can hold work); leaves are excluded. */
const CONTAINER_TYPES: ReadonlySet<string> = new Set(["initiative", "epic", "story"]);
/** Container types an open workstream can have: initiatives are roots, so only story/epic nest. */
const OPEN_CONTAINER_TYPES: ReadonlySet<string> = new Set(["story", "epic"]);
/** Terminal statuses (ADR 0004): the same done/cancelled rule the rest of the tracker uses. */
const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["done", "cancelled"]);

function titleOf(item: WorkItem): string {
  return item.title ?? item.id;
}

/**
 * Aggregate leaf (task/bug) statuses up the tree for display only, from
 * ALREADY-LOADED items. Grouped by epic; every story gets a row (zeros when
 * leafless); cancelled leaves have their own explicit column. Pure: no reads,
 * no writes. Exported so surfaces that already hold the item list (the web
 * board's summary header, task-board-progress-header) reuse the exact report
 * aggregation instead of re-walking the tracker or copying its rules;
 * `runReport` is this plus the disk walk.
 */
export function aggregateReport(items: WorkItem[]): {
  groups: ReportGroup[];
  blocked: ReportBlocked[];
  hygiene: ReportHygiene;
} {
  const byId = itemsById(items);

  const children = new Map<string, WorkItem[]>();
  for (const item of items) {
    if (!item.parent) continue;
    const list = children.get(item.parent) ?? [];
    list.push(item);
    children.set(item.parent, list);
  }

  const groups: ReportGroup[] = items
    .filter((item) => item.type === "epic")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((epic) => {
      const stories = (children.get(epic.id) ?? [])
        .filter((child) => child.type === "story")
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const containers: ReportContainer[] = stories.map((story) => {
        const counts = emptyCounts();
        const leaves = (children.get(story.id) ?? []).filter(
          (child) => child.type === "task" || child.type === "bug",
        );
        for (const leaf of leaves) {
          counts[leaf.status] += 1;
          counts.total += 1;
        }
        return {
          id: story.id,
          title: titleOf(story),
          type: story.type,
          counts,
          empty: leaves.length === 0,
          // The container's OWN body, never a reader-derived string: this is the
          // same `accept:` question `show --json` answers, read through the one
          // kernel classifier (no adapter grammar). Bodies are already in memory
          // from `loadItems`, so the report pays no extra I/O.
          acceptance: classifyAcceptance(story.body, story.assignee),
        };
      });
      const totals = emptyCounts();
      for (const c of containers) {
        for (const status of STATUSES) totals[status] += c.counts[status];
        totals.total += c.counts.total;
      }
      const initiative = epic.parent ? (byId.get(epic.parent) ?? null) : null;
      return {
        epic: { id: epic.id, title: titleOf(epic) },
        initiative: initiative ? { id: initiative.id, title: titleOf(initiative) } : null,
        containers,
        totals,
        empty: stories.length === 0,
      };
    });

  const blocked: ReportBlocked[] = items
    .filter(
      (item) =>
        (item.type === "task" || item.type === "bug") &&
        item.status === "blocked" &&
        Boolean(item.blockedReason),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((leaf) => {
      const story = leaf.parent ? byId.get(leaf.parent) : undefined;
      const epic = story?.parent ? byId.get(story.parent) : undefined;
      return {
        id: leaf.id,
        type: leaf.type as "task" | "bug",
        title: titleOf(leaf),
        storyId: story?.id ?? null,
        epicId: epic?.id ?? null,
        blockedReason: leaf.blockedReason!,
      };
    });

  return { groups, blocked, hygiene: containerHygiene(items) };
}

/**
 * Report-only container hygiene (task-container-hygiene-check, the 2026-10-14
 * reopen decision): a terminal container (`done`/`cancelled`) whose subtree
 * still holds a non-terminal CONTAINER (story/epic at any depth) is flagged —
 * the mismatch that used to accumulate silently until the product owner saw it
 * on the board.
 *
 * Leaves are deliberately NOT flagged: an open task/bug under a closed story is
 * the documented follow-up pattern (the container stays closed, the board shows
 * its `N open` disclosure). Only an open _container_ makes a terminal container
 * an offender, and every terminal container on the open item's ancestor chain
 * is one (the flag is per-container, not only the deepest one).
 *
 * Pure: reads already-loaded items, never writes, and never gates anything —
 * `report` stays exit 0 and `validate` is unchanged. The walk is O(items ×
 * depth) over the fixed four-level tree (initiative > epic > story > leaf).
 */
export function containerHygiene(items: WorkItem[]): ReportHygiene {
  const byId = itemsById(items);
  const openByOffender = new Map<string, WorkItem[]>();

  for (const item of items) {
    if (!OPEN_CONTAINER_TYPES.has(item.type) || TERMINAL_STATUSES.has(item.status)) continue;
    // Walk the open container's ancestor chain once: every terminal container
    // above it holds this open workstream, at any depth.
    let parentId = item.parent;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      if (CONTAINER_TYPES.has(parent.type) && TERMINAL_STATUSES.has(parent.status)) {
        const list = openByOffender.get(parent.id) ?? [];
        list.push(item);
        openByOffender.set(parent.id, list);
      }
      parentId = parent.parent;
    }
  }

  const offenders: ReportHygieneOffender[] = [...openByOffender.entries()]
    .map(([id, open]) => {
      const container = byId.get(id)!;
      const sorted = [...open].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return {
        id,
        type: container.type as ReportHygieneOffender["type"],
        status: container.status as ReportHygieneOffender["status"],
        openContainers: sorted.slice(0, MAX_HYGIENE_OPEN_CONTAINERS).map((c) => ({
          id: c.id,
          type: c.type as ReportHygieneOpenContainer["type"],
          status: c.status as ReportHygieneOpenContainer["status"],
        })),
        openContainersTotal: sorted.length,
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    checked: items.filter((item) => CONTAINER_TYPES.has(item.type)).length,
    offenders: offenders.slice(0, MAX_HYGIENE_OFFENDERS),
    offendersTotal: offenders.length,
  };
}

/**
 * Aggregate leaf (task/bug) statuses up the tree for display only.
 * Grouped by epic; every story gets a row (zeros when leafless);
 * cancelled leaves have their own explicit column. Never writes.
 */
export function runReport(opts: { cwd: string }): ReportResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const { groups, blocked, hygiene } = aggregateReport(loadItems(tasksDir));
  return { root, groups, blocked, hygiene };
}

/**
 * Completed leaves for one report counts row: `done + cancelled` — the
 * report's completion definition (`formatReportMarkdown`'s `N/M complete`).
 * Exported as the single source so the board's summary header and story
 * fractions quote the same rule instead of restating it
 * (task-board-progress-header). Pure.
 */
export function completedOf(counts: Record<Status, number>): number {
  return counts.done + counts.cancelled;
}

/** Human-readable table. The --json payload mirrors these rows exactly. */
export function formatReportTable(groups: ReportGroup[]): string {
  const lines: string[] = [];
  for (const group of groups) {
    // Ids/titles are repo-controlled (frontmatter + filename-derived ids):
    // escape them in place before interpolation (task-row-table-stdout-sanitize).
    const scope = group.initiative ? ` [${sanitizeHumanTextUncapped(group.initiative.id)}]` : "";
    lines.push(
      `epic: ${sanitizeHumanTextUncapped(group.epic.id)} — ${sanitizeHumanTextUncapped(group.epic.title)}${scope}`,
    );
    if (group.empty) {
      lines.push(`  (empty — no stories)`);
    }
    for (const c of group.containers) {
      lines.push(
        `  ${sanitizeHumanTextUncapped(c.id)}: ${formatCounts(c.counts)}${c.empty ? " (empty — no leaves)" : ""}`,
      );
    }
    lines.push(`  totals: ${formatCounts(group.totals)}`);
  }
  return lines.length > 0 ? `${lines.join("\n")}\n` : "arggon report: no epics.\n";
}

function formatCounts(counts: StatusCounts): string {
  const parts = STATUSES.map((status) => `${status}=${counts[status]}`);
  return `${parts.join(" ")} (total ${counts.total})`;
}

/** The open-container list of one offender, bounded with an explicit overflow marker. */
function formatHygieneOpenContainers(offender: ReportHygieneOffender): string {
  const open = offender.openContainers
    .map((c) => `${sanitizeHumanTextUncapped(c.id)} (${c.status})`)
    .join(", ");
  const dropped = offender.openContainersTotal - offender.openContainers.length;
  return dropped > 0 ? `${open} (+${dropped} more)` : open;
}

/**
 * The table's additive hygiene block (task-container-hygiene-check): one
 * summary line, one line per offender, bounded at `MAX_HYGIENE_OFFENDERS` /
 * `MAX_HYGIENE_OPEN_CONTAINERS`. Report-only display — the block never gates
 * and the command still exits 0. Appended after the groups table by the CLI.
 */
export function formatReportHygiene(hygiene: ReportHygiene): string {
  const checked = `${hygiene.checked} containers checked`;
  if (hygiene.offendersTotal === 0) {
    return `hygiene: clean — no terminal container holds an open container (${checked})\n`;
  }
  const noun = hygiene.offendersTotal === 1 ? "offender" : "offenders";
  const lines = [`hygiene: ${hygiene.offendersTotal} ${noun} (${checked})`];
  for (const offender of hygiene.offenders) {
    lines.push(
      `  ${sanitizeHumanTextUncapped(offender.id)} (${offender.status}) — open containers: ${formatHygieneOpenContainers(offender)}`,
    );
  }
  const dropped = hygiene.offendersTotal - hygiene.offenders.length;
  if (dropped > 0) lines.push(`  … and ${dropped} more`);
  return `${lines.join("\n")}\n`;
}

/**
 * Standup markdown (task-report-markdown): per-epic progress lines plus a
 * blocked section with reasons. Completion is (done + cancelled) / total,
 * matching the story's read-only rollup definition. Pure tree data — no
 * network, no GitHub calls, never mutates frontmatter.
 */
export function formatReportMarkdown(result: ReportResult, opts: { date?: string } = {}): string {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const lines: string[] = [`# Progress report — ${date}`, ""];

  for (const group of result.groups) {
    // Repo-controlled ids/titles: escaped in place (task-row-table-stdout-sanitize);
    // ordinary markdown stays byte-identical (escape-only, no cap).
    const scope = group.initiative ? ` (${sanitizeHumanTextUncapped(group.initiative.id)})` : "";
    lines.push(
      `## ${sanitizeHumanTextUncapped(group.epic.id)} — ${sanitizeHumanTextUncapped(group.epic.title)}${scope}`,
      "",
    );
    if (group.empty) {
      lines.push("_Empty — no stories._", "");
      continue;
    }
    for (const c of group.containers) {
      const done = completedOf(c.counts);
      const id = sanitizeHumanTextUncapped(c.id);
      const title = sanitizeHumanTextUncapped(c.title);
      const line = c.empty
        ? `- **${id}** — ${title}: empty (no leaves)`
        : `- **${id}** — ${title}: ${done}/${c.counts.total} complete (${c.counts.in_progress} in progress, ${c.counts.blocked} blocked)`;
      lines.push(line);
    }
    const totalDone = completedOf(group.totals);
    lines.push("", `- **totals**: ${totalDone}/${group.totals.total} complete`, "");
  }

  lines.push("## Blocked", "");
  if (result.blocked.length === 0) {
    lines.push("_Nothing blocked._", "");
  } else {
    for (const b of result.blocked) {
      const where = [b.storyId, b.epicId]
        .filter((part): part is string => Boolean(part))
        .map((part) => sanitizeHumanTextUncapped(part))
        .join(" ← ");
      const scope = where ? ` (${where})` : "";
      lines.push(
        `- **${sanitizeHumanTextUncapped(b.id)}**${scope} — ${sanitizeHumanTextUncapped(b.blockedReason)}`,
      );
    }
    lines.push("");
  }

  // Additive hygiene section (task-container-hygiene-check): the same bounded
  // offenders the `--json` payload carries, in the standup export.
  lines.push("## Hygiene", "");
  const checked = `${result.hygiene.checked} containers checked`;
  if (result.hygiene.offendersTotal === 0) {
    lines.push(`_No terminal container holds an open container (${checked})._`, "");
  } else {
    const noun = result.hygiene.offendersTotal === 1 ? "offender" : "offenders";
    lines.push(`- ${result.hygiene.offendersTotal} ${noun} (${checked})`);
    for (const offender of result.hygiene.offenders) {
      lines.push(
        `- **${sanitizeHumanTextUncapped(offender.id)}** (${offender.status}) — open containers: ${formatHygieneOpenContainers(offender)}`,
      );
    }
    const dropped = result.hygiene.offendersTotal - result.hygiene.offenders.length;
    if (dropped > 0) lines.push(`- … and ${dropped} more`);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
