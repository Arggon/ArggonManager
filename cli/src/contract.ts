import { relative, sep } from "node:path";
import type { WorkItem as KernelWorkItem } from "./items.js";
import type { WorkItem as ContractWorkItem } from "./types.js";

/**
 * Map a kernel WorkItem to the stable JSON contract shape
 * (docs/json-output.md `WorkItem`). Pure function, no I/O.
 * Shared by every command that emits `{ item }` / `{ items }`.
 */
export function toContractWorkItem(item: KernelWorkItem, rootDir: string): ContractWorkItem {
  return {
    id: item.id,
    type: item.type,
    status: item.status,
    title: item.title ?? null,
    assignee: item.assignee ?? null,
    parent: item.parent ?? null,
    labels: [...item.labels],
    created: item.created ?? null,
    updated: item.updated ?? null,
    path: relative(rootDir, item.filePath).split(sep).join("/"),
    blocked_reason: item.blockedReason ?? null,
  };
}
