import { itemsById, loadItems, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
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

function titleOf(item: WorkItem): string {
  return item.title ?? item.id;
}

/**
 * Aggregate leaf (task/bug) statuses up the tree for display only.
 * Grouped by epic; every story gets a row (zeros when leafless);
 * cancelled leaves have their own explicit column. Never writes.
 */
export function runReport(opts: { cwd: string }): ReportResult {
  const tasksDir = findTasksDir(opts.cwd);
  const root = repoRootFromTasks(tasksDir);
  const items = loadItems(tasksDir);
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

  return { root, groups, blocked };
}

/** Human-readable table. The --json payload mirrors these rows exactly. */
export function formatReportTable(groups: ReportGroup[]): string {
  const lines: string[] = [];
  for (const group of groups) {
    const scope = group.initiative ? ` [${group.initiative.id}]` : "";
    lines.push(`epic: ${group.epic.id} — ${group.epic.title}${scope}`);
    if (group.empty) {
      lines.push(`  (empty — no stories)`);
    }
    for (const c of group.containers) {
      lines.push(`  ${c.id}: ${formatCounts(c.counts)}${c.empty ? " (empty — no leaves)" : ""}`);
    }
    lines.push(`  totals: ${formatCounts(group.totals)}`);
  }
  return lines.length > 0 ? `${lines.join("\n")}\n` : "arggon report: no epics.\n";
}

function formatCounts(counts: StatusCounts): string {
  const parts = STATUSES.map((status) => `${status}=${counts[status]}`);
  return `${parts.join(" ")} (total ${counts.total})`;
}

/**
 * Standup markdown (task-report-markdown): per-epic progress lines plus a
 * blocked section with reasons. Completion is (done + cancelled) / total,
 * matching the story's read-only rollup definition. Pure tree data — no
 * network, no GitHub calls, never mutates frontmatter.
 */
export function formatReportMarkdown(
  result: ReportResult,
  opts: { date?: string } = {},
): string {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const lines: string[] = [`# Progress report — ${date}`, ""];

  for (const group of result.groups) {
    const scope = group.initiative ? ` (${group.initiative.id})` : "";
    lines.push(`## ${group.epic.id} — ${group.epic.title}${scope}`, "");
    if (group.empty) {
      lines.push("_Empty — no stories._", "");
      continue;
    }
    for (const c of group.containers) {
      const done = c.counts.done + c.counts.cancelled;
      const line = c.empty
        ? `- **${c.id}** — ${c.title}: empty (no leaves)`
        : `- **${c.id}** — ${c.title}: ${done}/${c.counts.total} complete (${c.counts.in_progress} in progress, ${c.counts.blocked} blocked)`;
      lines.push(line);
    }
    const totalDone = group.totals.done + group.totals.cancelled;
    lines.push("", `- **totals**: ${totalDone}/${group.totals.total} complete`, "");
  }

  lines.push("## Blocked", "");
  if (result.blocked.length === 0) {
    lines.push("_Nothing blocked._", "");
  } else {
    for (const b of result.blocked) {
      const where = [b.storyId, b.epicId].filter(Boolean).join(" ← ");
      const scope = where ? ` (${where})` : "";
      lines.push(`- **${b.id}**${scope} — ${b.blockedReason}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}
