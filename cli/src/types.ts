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
  /** Working branch name (v1 field, additive); null when unset. */
  branch: string | null;
  parent: string | null;
  labels: string[];
  created: string | null;
  updated: string | null;
  path: string;
  blocked_reason: string | null;
  /**
   * Milestone target date (prototype per ADR 0003; official field in
   * convention v3). Additive within schemaVersion 1, like `branch` in v1.
   */
  milestone: string | null;
  /**
   * Ids this item waits for (convention v3 per ADR 0004). Additive within
   * schemaVersion 1; empty list = no dependencies. `blocked_by` is the
   * computed inverse and is never stored.
   */
  depends_on: string[];
  /**
   * Soft lease on a claim (ISO date-time): set when a claimable item is
   * claimed (in_progress + assignee), cleared when the claim is released.
   * Additive within schemaVersion 1; reporting only, never gates transitions.
   */
  claimed_at: string | null;
};

/** One validate finding. `path` is posix, repo-relative (file or directory). */
export type Issue = {
  path: string;
  message: string;
  code: string;
};
