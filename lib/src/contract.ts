import { relative, sep } from "node:path";
import { compactWorkItem } from "./json.js";
import type { WorkItem as KernelWorkItem } from "./items.js";
import type { WorkItem as ContractWorkItem } from "./types.js";

/**
 * Map a kernel WorkItem to the stable JSON contract shape
 * (docs/json-output.md `WorkItem`). Pure function, no I/O.
 * Shared by every command that emits `{ item }` / `{ items }`.
 *
 * Full shape by default; `list`/`create`/`update` (CLI + MCP) pass
 * `{ full: false }` for the compact ADR 0006 default, which omits optional
 * fields that are null and list fields that are empty unless `--full`.
 */
export function toContractWorkItem(
  item: KernelWorkItem,
  rootDir: string,
  opts: { full?: boolean } = {},
): ContractWorkItem {
  const full: ContractWorkItem = {
    id: item.id,
    type: item.type,
    status: item.status,
    title: item.title ?? null,
    assignee: item.assignee ?? null,
    branch: item.branch ?? null,
    parent: item.parent ?? null,
    labels: [...item.labels],
    priority: item.priority ?? null,
    created: item.created ?? null,
    updated: item.updated ?? null,
    path: relative(rootDir, item.filePath).split(sep).join("/"),
    blocked_reason: item.blockedReason ?? null,
    milestone: item.milestone ?? null,
    depends_on: [...item.dependsOn],
    claimed_at: item.claimedAt ?? null,
    worktree_path: item.worktreePath ?? null,
    issue: item.issue ?? null,
  };
  return opts.full === false ? compactWorkItem(full) : full;
}
