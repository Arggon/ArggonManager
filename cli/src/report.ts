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

  return { root, groups };
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
