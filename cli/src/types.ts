/** Shared domain types for work items and validate issues. No I/O. */

/** v0 work-item types from docs/convention.md */
export type ItemType = "initiative" | "epic" | "story" | "task" | "bug";

/** v0 statuses from docs/convention.md */
export type Status = "todo" | "in_progress" | "blocked" | "done" | "cancelled";

/**
 * Normalized work item used by list/create/update JSON output.
 * Optional frontmatter fields are `null` here so the JSON shape is stable.
 * `path` is the posix repo-relative file path (not a frontmatter field).
 */
export type WorkItem = {
  id: string;
  type: ItemType;
  status: Status;
  title: string | null;
  assignee: string | null;
  parent: string | null;
  labels: string[];
  created: string | null;
  updated: string | null;
  path: string;
  blocked_reason: string | null;
};

/** One validate finding. `path` is posix, repo-relative (file or directory). */
export type Issue = {
  path: string;
  message: string;
  code: string;
};
