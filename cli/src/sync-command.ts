import { execFileSync } from "node:child_process";
import { loadItems } from "./items.js";
import { findTasksDir } from "./paths.js";
import { getOpenPRs } from "./get-open-prs.js";
import { matchItem, toSyncResult, type SyncFilled, type SyncResult } from "./sync-types.js";
import { runUpdate } from "./update.js";

/**
 * Reconcile tasks/ with the repo's open GitHub PRs. Check mode (the default)
 * only reports; write mode additionally fills empty `branch` fields via the
 * same matching. Never overwrites a set branch, never guesses an ambiguous
 * match, and never touches status (merge != acceptance). Returns data; the
 * CLI prints. Throws on conflicting flags (--check + --write).
 */
export function runSync(
  opts: {
    check?: boolean;
    write?: boolean;
    repo?: string;
    cwd?: string;
  },
  execGh: typeof execFileSync = execFileSync
): SyncResult {
  if (opts.check && opts.write) {
    throw new Error("pass either --check or --write, not both");
  }
  const mode: "check" | "write" = opts.write ? "write" : "check";
  const cwd = opts.cwd || process.cwd();

  let items;
  let prs;
  try {
    const tasksDir = findTasksDir(cwd);
    items = loadItems(tasksDir);
    prs = getOpenPRs(opts.repo || null, cwd, execGh);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return toSyncResult([], mode, null, [msg]);
  }

  // Items with a branch reconcile regardless of type (matched / no PR /
  // ambiguous). Fill suggestions are leaves only (task/bug): a PR targets
  // concrete work, and container ids (epic "auth") match unrelated branches
  // too easily. Branchless items with no candidate PR are not reported —
  // there is nothing to reconcile.
  const byId = new Map(items.map((i) => [i.id, i]));
  const reported = items
    .map((item) => matchItem({ id: item.id, branch: item.branch ?? null }, prs))
    .filter((m) => {
      const item = byId.get(m.itemId)!;
      if (item.branch) return true;
      if (m.status === "no_pr") return false;
      return item.type === "task" || item.type === "bug";
    });

  let filled: SyncFilled | null = null;
  const updateErrors: string[] = [];
  if (mode === "write") {
    for (const match of reported) {
      if (match.status !== "fillable") continue;
      try {
        runUpdate({ cwd, id: match.itemId, branch: match.branch });
        if (!filled) filled = {};
        filled[match.itemId] = match.branch;
      } catch (err) {
        updateErrors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  return toSyncResult(reported, mode, filled, updateErrors);
}
