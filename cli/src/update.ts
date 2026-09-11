import { writeFileSync } from "node:fs";
import { stringifyFrontmatter } from "./frontmatter.js";
import {
  assertStatus,
  assertAssignee,
  assertClaimAndBlocked,
  type Status,
} from "./status.js";
import { assertUpdateRules } from "./rules.js";
import { formatDate } from "./dates.js";
import { assertBranchName, assertLabels } from "./ids.js";
import { itemsById, loadItems, tryLoadItem, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";

export type UpdateOptions = {
  cwd: string;
  id: string;
  title?: string;
  status?: string;
  assignee?: string;
  /** Set working branch (v1); empty string clears it. */
  branch?: string;
  /** Clear assignee (subject to the claim rule for the resulting status). */
  unassign?: boolean;
  /** Replace the full labels list (comma-separated). */
  labels?: string;
  blockedReason?: string;
  /** Allow reassignment of an already-claimed item (claim steal). */
  force?: boolean;
  /**
   * Agent-flagged caller (the MCP layer always sets this): playbook
   * restrictions apply — no reopening done/cancelled, no claim steal.
   */
  agent?: boolean;
  /**
   * Automatic container completion (default true): when this update reaches
   * a terminal state (done/cancelled) and every sibling under a parent is
   * terminal, ancestors complete as done, recursively.
   */
  cascade?: boolean;
  now?: Date;
};

export type UpdateResult = {
  id: string;
  path: string;
  /** Repo root (parent of tasks/). */
  root: string;
  /** The updated item, reloaded from disk. */
  item: WorkItem;
  /** Requested fields that changed (plus convention side-effects). */
  changed: string[];
  /** Ancestor containers auto-completed by the cascade (empty unless terminal). */
  autoCompleted: string[];
};

function parseLabels(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Update frontmatter fields of one work item. Only requested fields change,
 * plus convention side-effects (unclaim clears assignee, unblocking clears
 * blocked_reason). Returns data; the CLI prints. Throws on unknown id,
 * invalid enums, illegal transitions, claim-rule violations, or claim steal (unless --force).
 */
export function runUpdate(opts: UpdateOptions): UpdateResult {
  const id = opts.id.trim();
  if (!id) throw new Error("id is required");

  if (opts.status !== undefined) assertStatus(opts.status);
  if (opts.assignee !== undefined) assertAssignee(opts.assignee);
  if (opts.unassign && opts.assignee !== undefined) {
    throw new Error("pass either --assignee or --unassign, not both");
  }
  let title: string | undefined;
  if (opts.title !== undefined) {
    title = opts.title.trim();
    if (!title) throw new Error("title must not be empty");
  }
  const labels = opts.labels !== undefined ? parseLabels(opts.labels) : undefined;
  if (labels !== undefined) assertLabels(labels);
  let branchRequest: string | null | undefined;
  if (opts.branch !== undefined) {
    const trimmed = opts.branch.trim();
    if (trimmed) {
      assertBranchName(trimmed);
      branchRequest = trimmed;
    } else {
      branchRequest = null;
    }
  }

  const requested =
    title !== undefined ||
    opts.status !== undefined ||
    opts.assignee !== undefined ||
    branchRequest !== undefined ||
    opts.unassign === true ||
    labels !== undefined ||
    opts.blockedReason !== undefined;
  if (!requested) {
    throw new Error("nothing to update (pass --title, --status, --assignee, --branch, ...)");
  }

  const tasksDir = findTasksDir(opts.cwd);
  const item = itemsById(loadItems(tasksDir)).get(id);
  if (!item) {
    throw new Error(`id '${id}' not found under tasks/`);
  }

  const newStatus = opts.status ?? item.status;
  assertUpdateRules(
    {
      id,
      type: item.type,
      currentStatus: item.status,
      currentAssignee: item.assignee ?? null,
      requestedStatus: opts.status as Status | undefined,
      requestedAssignee: opts.assignee,
      force: opts.force,
    },
    opts.agent ? "agent" : "human",
  );

  // Assignee: explicit > unassign > unclaim default (in_progress -> todo) > keep.
  const currentAssignee = item.assignee ?? null;
  let newAssignee: string | null;
  if (opts.assignee !== undefined) {
    newAssignee = opts.assignee;
  } else if (opts.unassign) {
    newAssignee = null;
  } else if (newStatus === "todo" && item.status === "in_progress") {
    newAssignee = null;
  } else {
    newAssignee = currentAssignee;
  }

  // Branch: explicit > unclaim default (in_progress -> todo) > keep.
  const currentBranch = item.branch ?? null;
  let newBranch: string | null;
  if (branchRequest !== undefined) {
    newBranch = branchRequest;
  } else if (newStatus === "todo" && item.status === "in_progress") {
    newBranch = null;
  } else {
    newBranch = currentBranch;
  }

  // blocked_reason: required when blocked, forbidden otherwise.
  let newReason: string | null;
  if (newStatus === "blocked") {
    const explicit = opts.blockedReason?.trim() ? opts.blockedReason.trim() : null;
    newReason = explicit ?? item.blockedReason ?? null;
    if (!newReason) {
      throw new Error("status blocked requires --blocked-reason");
    }
  } else {
    if (opts.blockedReason !== undefined) {
      throw new Error("blocked_reason is only valid when status is blocked");
    }
    newReason = null;
  }

  assertClaimAndBlocked({
    type: item.type,
    status: newStatus,
    assignee: newAssignee,
    blockedReason: newReason,
  });

  const data = { ...item.data };
  const changed: string[] = [];
  if (title !== undefined && title !== item.title) {
    data.title = title;
    changed.push("title");
  }
  if (opts.status !== undefined && newStatus !== item.status) {
    data.status = newStatus;
    changed.push("status");
  }
  if (newAssignee !== currentAssignee) {
    data.assignee = newAssignee;
    changed.push("assignee");
  }
  if (newBranch !== currentBranch) {
    data.branch = newBranch;
    changed.push("branch");
  }
  if (labels !== undefined && labels.join("\u0000") !== item.labels.join("\u0000")) {
    data.labels = labels;
    changed.push("labels");
  }
  const currentReason = item.blockedReason ?? null;
  if (newReason !== currentReason) {
    data.blocked_reason = newReason;
    changed.push("blocked_reason");
  }

  data.updated = formatDate(opts.now ?? new Date());
  writeFileSync(item.filePath, stringifyFrontmatter(data, item.body), "utf8");

  const updated = tryLoadItem(item.filePath);
  if (!updated) {
    throw new Error(`Updated item is unreadable: ${item.filePath}`);
  }

  // Automatic container completion (task-container-auto-done): when an item
  // reaches a terminal state and every sibling under a parent is terminal
  // too, that parent completes, cascading up the chain. Off with cascade:false.
  const autoCompleted: string[] =
    opts.cascade === false || (newStatus !== "done" && newStatus !== "cancelled")
      ? []
      : autoCompleteAncestors(tasksDir, item, opts.now ?? new Date());

  return {
    id,
    path: item.filePath,
    root: repoRootFromTasks(tasksDir),
    item: updated,
    changed,
    autoCompleted,
  };
}

const TERMINAL: ReadonlySet<string> = new Set(["done", "cancelled"]);

/**
 * Walk up from the just-updated item: every ancestor whose ENTIRE subtree
 * (all descendants, any depth) is terminal completes as `done`,
 * recursively. Containers stuck in `todo` or `blocked` complete directly
 * (chaining through `in_progress` would be meaningless for unattended
 * automation and would violate the claim rule on claimable types).
 * Already-terminal containers keep their status (an explicit `cancelled`
 * is never overwritten) but do not stop the walk: their ancestors may
 * still complete.
 */
function autoCompleteAncestors(
  tasksDir: string,
  from: WorkItem,
  now: Date,
): string[] {
  const completed: string[] = [];
  const byId = itemsById(loadItems(tasksDir));
  let parentId = from.parent;
  const seen = new Set<string>([from.id]);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const container = byId.get(parentId);
    if (!container) break;
    const children = [...byId.values()].filter((candidate) => candidate.parent === container.id);
    if (children.length === 0 || !children.every((child) => subtreeClosed(child, byId))) break;
    if (!TERMINAL.has(container.status)) {
      writeFileSync(
        container.filePath,
        stringifyFrontmatter(
          { ...container.data, status: "done", updated: formatDate(now) },
          container.body,
        ),
        "utf8",
      );
      // Keep the in-memory copy fresh: the next ancestor's children check
      // must see this container as terminal.
      container.status = "done";
      completed.push(container.id);
    }
    parentId = container.parent;
  }
  return completed;
}

/** A subtree is closed when every child is terminal and, for containers, its own subtree is closed too. */
function subtreeClosed(item: WorkItem, byId: Map<string, WorkItem>): boolean {
  if (!TERMINAL.has(item.status)) return false;
  if (item.type === "task" || item.type === "bug") return true;
  const children = [...byId.values()].filter((candidate) => candidate.parent === item.id);
  return children.every((child) => subtreeClosed(child, byId));
}
