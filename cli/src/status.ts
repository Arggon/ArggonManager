import type { ItemType } from "./ids.js";

export const STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];

export const CLAIMABLE_TYPES = new Set<ItemType>(["story", "task", "bug"]);

export const ASSIGNEE_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** Allowed next statuses. Create does not use this; update/validate will. */
export const TRANSITIONS: Record<Status, readonly Status[]> = {
  todo: ["in_progress", "cancelled"],
  in_progress: ["blocked", "done", "cancelled", "todo"],
  blocked: ["in_progress", "cancelled"],
  done: ["todo"],
  cancelled: ["todo"],
};

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value);
}

export function assertStatus(value: string): asserts value is Status {
  if (!isStatus(value)) {
    throw new Error(`Invalid status '${value}'. Expected: ${STATUSES.join(", ")}`);
  }
}

export function assertAssignee(assignee: string): void {
  if (assignee === "") {
    throw new Error("assignee must not be an empty string (omit it when unassigned)");
  }
  if (!ASSIGNEE_PATTERN.test(assignee)) {
    throw new Error(`Invalid assignee '${assignee}' (GitHub login or agent id)`);
  }
}

export function assertClaimAndBlocked(opts: {
  type: ItemType;
  status: Status;
  assignee?: string | null;
  blockedReason?: string | null;
}): void {
  const assignee = opts.assignee?.trim() ? opts.assignee : null;
  const reason = opts.blockedReason?.trim() ? opts.blockedReason.trim() : null;

  if (opts.status === "in_progress" && CLAIMABLE_TYPES.has(opts.type) && !assignee) {
    throw new Error(`${opts.type} with status in_progress requires --assignee`);
  }
  if (opts.status === "blocked" && !reason) {
    throw new Error("status blocked requires --blocked-reason");
  }
  if (opts.status !== "blocked" && reason) {
    throw new Error("blocked_reason is only valid when status is blocked");
  }
}

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}
