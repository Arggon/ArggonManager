import { execFileSync } from "node:child_process";
import { isItemType, ITEM_TYPES } from "./ids.js";
import { loadItems, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { isStatus, STATUSES } from "./status.js";

export type ListOptions = {
  /** Start dir; tasks/ is located with walk-up (same as create). */
  cwd: string;
  status?: string;
  type?: string;
  assignee?: string;
};

export type ListDeps = {
  env?: NodeJS.ProcessEnv;
  resolveMe?: () => string | undefined;
};

export type ListResult = {
  /** Repo root (parent of tasks/). */
  root: string;
  /** Kernel items, lexicographic by id. */
  items: WorkItem[];
};

export function resolveCurrentLogin(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const user = env.GITHUB_USER?.trim();
  if (user) return user;
  const actor = env.GITHUB_ACTOR?.trim();
  if (actor) return actor;
  try {
    const out = execFileSync("gh", ["api", "user", "-q", ".login"], {
      encoding: "utf8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "ignore"],
      env: process.env,
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Load work items from the shared kernel and apply AND filters.
 * Pure data: no console output (the CLI prints). Throws on bad
 * filters, unresolvable @me, missing tasks/, or unreadable items.
 */
export function runList(opts: ListOptions, deps: ListDeps = {}): ListResult {
  if (opts.type !== undefined && !isItemType(opts.type)) {
    throw new Error(`unknown type "${opts.type}". Allowed: ${ITEM_TYPES.join(", ")}`);
  }
  if (opts.status !== undefined && !isStatus(opts.status)) {
    throw new Error(`unknown status "${opts.status}". Allowed: ${STATUSES.join(", ")}`);
  }

  const env = deps.env ?? process.env;
  let assigneeFilter = opts.assignee;
  if (assigneeFilter === "@me") {
    const login = (deps.resolveMe ?? (() => resolveCurrentLogin(env)))();
    if (!login) {
      throw new Error(
        "could not resolve @me (set GITHUB_USER or GITHUB_ACTOR, or authenticate gh: gh api user)",
      );
    }
    assigneeFilter = login;
  }

  const tasksDir = findTasksDir(opts.cwd);
  const items = loadItems(tasksDir)
    .filter((item) => {
      if (opts.type !== undefined && item.type !== opts.type) return false;
      if (opts.status !== undefined && item.status !== opts.status) return false;
      if (assigneeFilter !== undefined && (item.assignee ?? null) !== assigneeFilter) return false;
      return true;
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { root: repoRootFromTasks(tasksDir), items };
}

/** Human-readable table for CLI stdout. Missing titles fall back to id. */
export function formatListTable(items: WorkItem[]): string {
  const headers = ["id", "type", "status", "assignee", "title"] as const;
  const rows = items.map((item) => [
    item.id,
    item.type,
    item.status,
    item.assignee ?? "-",
    item.title ?? item.id,
  ]);
  const all = [headers.map((h) => h), ...rows];
  const widths = headers.map((_, col) => Math.max(...all.map((row) => row[col].length)));
  const lines = all.map((row) =>
    row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i]))).join("  "),
  );
  return `${lines.join("\n")}\n`;
}
