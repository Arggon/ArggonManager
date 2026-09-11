import { execFileSync } from "node:child_process";
import { readConventionConfig } from "./convention.js";
import {
  buildBlockedByIndex,
  parseFilter,
  matchesPredicate,
  type FilterPredicate,
} from "./filter.js";
import { isItemType, ITEM_TYPES } from "./ids.js";
import { loadItems, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { isStatus, isClaimed, STATUSES } from "./status.js";

export type ListOptions = {
  /** Start dir; tasks/ is located with walk-up (same as create). */
  cwd: string;
  status?: string;
  type?: string;
  assignee?: string;
  /** Compact expression (`status:todo !label:security`); ANDs with the flags above. */
  filter?: string;
  /** Saved view name (`x-views` in tasks/.convention.yml); ANDs with the flags and --filter. */
  view?: string;
  /** Limit to claimed items whose claimed_at is older than `olderThan` (or missing). */
  stale?: boolean;
  /** Stale threshold: `<number><d|h|m>` (e.g. 7d, 12h, 30m); required with --stale. */
  olderThan?: string;
  /** Clock override for deterministic reporting/tests; defaults to now. */
  now?: Date;
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

/** Stale-threshold durations: number + unit (d/h/m), e.g. 7d, 12h, 30m. */
const OLDER_THAN_PATTERN = /^(\d+)([dhm])$/;
const UNIT_MS: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000 };

/** Parse an `--older-than` duration into milliseconds; invalid input fails with an actionable error. */
export function parseOlderThan(raw: string): number {
  const match = OLDER_THAN_PATTERN.exec(raw.trim());
  if (!match) {
    throw new Error(
      `invalid --older-than duration "${raw}" (expected <number><d|h|m>, e.g. 7d, 12h, 30m)`,
    );
  }
  return Number(match[1]) * UNIT_MS[match[2]];
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
  let staleMs: number | undefined;
  if (opts.stale === true || opts.olderThan !== undefined) {
    if (opts.stale !== true) {
      throw new Error("--older-than requires --stale (list stale claims)");
    }
    if (opts.olderThan === undefined) {
      throw new Error('--stale requires --older-than <duration> (e.g. "7d", "12h", "30m")');
    }
    staleMs = parseOlderThan(opts.olderThan);
  }

  const env = deps.env ?? process.env;
  const resolveMe = deps.resolveMe ?? (() => resolveCurrentLogin(env));
  let assigneeFilter = opts.assignee;
  if (assigneeFilter === "@me") {
    const login = resolveMe();
    if (!login) {
      throw new Error(
        "could not resolve @me (set GITHUB_USER or GITHUB_ACTOR, or authenticate gh: gh api user)",
      );
    }
    assigneeFilter = login;
  }

  // Expression filters use the same predicates (and the same errors) as the flags.
  // Saved views (`x-views`) are named expressions resolved here, ANDed with --filter.
  const validatePredicates = (preds: FilterPredicate[]): FilterPredicate[] => {
    for (const pred of preds) {
      if (pred.field === "type" && !isItemType(pred.value)) {
        throw new Error(`unknown type "${pred.value}". Allowed: ${ITEM_TYPES.join(", ")}`);
      }
      if (pred.field === "status" && !isStatus(pred.value)) {
        throw new Error(`unknown status "${pred.value}". Allowed: ${STATUSES.join(", ")}`);
      }
      if (pred.field === "assignee" && pred.value === "@me") {
        const login = resolveMe();
        if (!login) {
          throw new Error(
            "could not resolve @me (set GITHUB_USER or GITHUB_ACTOR, or authenticate gh: gh api user)",
          );
        }
        pred.value = login;
      }
    }
    return preds;
  };

  const tasksDir = findTasksDir(opts.cwd);
  const repoRoot = repoRootFromTasks(tasksDir);
  const predicates: FilterPredicate[] = [];
  if (opts.view !== undefined) {
    const { views } = readConventionConfig(repoRoot);
    const expr = views[opts.view];
    if (expr === undefined) {
      const known = Object.keys(views);
      throw new Error(
        known.length === 0
          ? `unknown view "${opts.view}" (no saved views defined in tasks/.convention.yml x-views)`
          : `unknown view "${opts.view}". Known views: ${known.join(", ")}`,
      );
    }
    predicates.push(...validatePredicates(parseFilter(expr)));
  }
  if (opts.filter !== undefined) {
    predicates.push(...validatePredicates(parseFilter(opts.filter)));
  }

  // The blocked-by: predicate is a computed inverse view over the whole
  // tree, so it needs the full (unfiltered) item set as its index.
  const allItems = loadItems(tasksDir);
  const blockedByIndex = buildBlockedByIndex(allItems);
  const nowMs = (opts.now ?? new Date()).getTime();
  const items = allItems
    .filter((item) => {
      if (opts.type !== undefined && item.type !== opts.type) return false;
      if (opts.status !== undefined && item.status !== opts.status) return false;
      if (assigneeFilter !== undefined && (item.assignee ?? null) !== assigneeFilter) return false;
      // Stale claims: claimed items whose soft lease started before the
      // threshold. Items claimed before claimed_at existed count as stale.
      if (staleMs !== undefined) {
        if (!isClaimed(item.type, item.status, item.assignee)) return false;
        const claimedMs = item.claimedAt ? Date.parse(item.claimedAt) : Number.NaN;
        const isStale = Number.isNaN(claimedMs) || nowMs - claimedMs > staleMs;
        if (!isStale) return false;
      }
      for (const pred of predicates) {
        if (!matchesPredicate(item, pred, blockedByIndex)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { root: repoRoot, items };
}

/** Human-readable table for CLI stdout. Missing titles fall back to id. */
export function formatListTable(items: WorkItem[]): string {
  const headers = ["id", "type", "status", "assignee", "branch", "title"] as const;
  const rows = items.map((item) => [
    item.id,
    item.type,
    item.status,
    item.assignee ?? "-",
    item.branch ?? "-",
    item.title ?? item.id,
  ]);
  const all = [headers.map((h) => h), ...rows];
  const widths = headers.map((_, col) => Math.max(...all.map((row) => row[col].length)));
  const lines = all.map((row) =>
    row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i]))).join("  "),
  );
  return `${lines.join("\n")}\n`;
}
