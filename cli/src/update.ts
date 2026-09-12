import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stringifyFrontmatter } from "./frontmatter.js";
import {
  assertStatus,
  assertAssignee,
  assertClaimAndBlocked,
  isClaimed,
  type Status,
} from "./status.js";
import { assertUpdateRules } from "./rules.js";
import { formatDate, formatDateTime } from "./dates.js";
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
  /**
   * Replace the full depends_on list (comma-separated ids; v3 field).
   * Empty string clears. Unknown ids fail.
   */
  dependsOn?: string;
  /** Append one depends_on id (v3 field); no-op when already present. Unknown ids fail. */
  addDependsOn?: string;
  blockedReason?: string;
  /**
   * Set the additive `worktree_path` field (absolute path of the git worktree
   * created by `start --worktree`). Empty string clears it. Kernel-level only:
   * there is no CLI flag.
   */
  worktreePath?: string;
  /** Allow reassignment of an already-claimed item (claim steal). */
  force?: boolean;
  /**
   * Supervised takeover of a claimed item (human-only; agents are refused by
   * the playbook rules). Requires a non-empty `reason`, sets the assignee
   * (explicit `assignee` or fail), refreshes `claimed_at`, and appends a
   * dated note line with the reason to the item body.
   */
  steal?: boolean;
  /** Non-empty rationale for `steal`, recorded in the item body. */
  reason?: string;
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

function parseCsvList(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Update frontmatter fields of one work item. Only requested fields change,
 * plus convention side-effects (unclaim clears assignee, unblocking clears
 * blocked_reason, claim state drives the claimed_at lease). Returns data; the
 * CLI prints. Throws on unknown id, invalid enums, illegal transitions,
 * claim-rule violations, or claim steal (unless --force / supervised --steal).
 */
export function runUpdate(opts: UpdateOptions): UpdateResult {
  const id = opts.id.trim();
  if (!id) throw new Error("id is required");

  if (opts.status !== undefined) assertStatus(opts.status);
  if (opts.assignee !== undefined) assertAssignee(opts.assignee);
  if (opts.unassign && opts.assignee !== undefined) {
    throw new Error("pass either --assignee or --unassign, not both");
  }
  if (opts.steal && opts.force) {
    throw new Error("--steal and --force are mutually exclusive (--steal already authorizes the takeover)");
  }
  let title: string | undefined;
  if (opts.title !== undefined) {
    title = opts.title.trim();
    if (!title) throw new Error("title must not be empty");
  }
  const labels = opts.labels !== undefined ? parseCsvList(opts.labels) : undefined;
  if (labels !== undefined) assertLabels(labels);
  const depsReplace = opts.dependsOn !== undefined ? parseCsvList(opts.dependsOn) : undefined;
  let depsAdd: string | undefined;
  if (opts.addDependsOn !== undefined) {
    depsAdd = opts.addDependsOn.trim();
    if (!depsAdd) throw new Error("--add-depends-on requires a non-empty item id");
  }
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
  let worktreeRequest: string | null | undefined;
  if (opts.worktreePath !== undefined) {
    const trimmed = opts.worktreePath.trim();
    worktreeRequest = trimmed ? resolve(trimmed) : null;
  }

  const requested =
    title !== undefined ||
    opts.status !== undefined ||
    opts.assignee !== undefined ||
    branchRequest !== undefined ||
    opts.unassign === true ||
    opts.steal === true ||
    worktreeRequest !== undefined ||
    labels !== undefined ||
    depsReplace !== undefined ||
    opts.addDependsOn !== undefined ||
    opts.blockedReason !== undefined;
  if (!requested) {
    throw new Error("nothing to update (pass --title, --status, --assignee, --branch, ...)");
  }

  const tasksDir = findTasksDir(opts.cwd);
  const byId = itemsById(loadItems(tasksDir));
  const item = byId.get(id);
  if (!item) {
    throw new Error(`id '${id}' not found under tasks/`);
  }

  // depends_on (v3, ADR 0004): replace the list / append one id. Unknown ids
  // fail here so the error is actionable at edit time; validate re-checks the
  // whole graph (unknown, self, cycles) on every run.
  let newDeps: string[] | undefined;
  if (depsReplace !== undefined || depsAdd !== undefined) {
    const base = depsReplace !== undefined ? depsReplace : item.dependsOn;
    newDeps = depsAdd !== undefined && !base.includes(depsAdd) ? [...base, depsAdd] : [...base];
    for (const dep of newDeps) {
      if (!byId.has(dep)) {
        throw new Error(`depends_on id '${dep}' does not resolve to an existing item`);
      }
    }
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
      steal: opts.steal,
    },
    opts.agent ? "agent" : "human",
  );

  // Supervised steal (human-only; agent refusal happened in assertUpdateRules):
  // requires a non-empty reason (recorded in the body) and an existing claim
  // to take over, and the caller becomes the assignee.
  const stealReason = opts.steal ? (opts.reason?.trim() ?? null) : null;
  if (opts.steal) {
    if (!stealReason) {
      throw new Error(
        "--steal requires a non-empty --reason (the takeover is recorded in the item body)",
      );
    }
    if (!isClaimed(item.type, item.status, item.assignee ?? null)) {
      throw new Error(
        `'${id}' is not currently claimed -- --steal takes over an existing claim (in_progress with an assignee); check \`arggon list --stale\``,
      );
    }
    if (opts.assignee === undefined) {
      throw new Error(`--steal requires --assignee <your-login> (you become the assignee of '${id}')`);
    }
  }

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

  // claimed_at lease (reporting only — never gates a transition): set when a
  // claim starts or the claimant changes, kept while the same claim continues
  // (pre-lease claims stay without it), cleared when the item leaves the
  // claimed state.
  const now = opts.now ?? new Date();
  const wasClaimed = isClaimed(item.type, item.status, currentAssignee);
  const willBeClaimed = isClaimed(item.type, newStatus, newAssignee);
  let newClaimedAt: string | null;
  if (!willBeClaimed) {
    newClaimedAt = null;
  } else if (!opts.steal && wasClaimed && newAssignee === currentAssignee) {
    newClaimedAt = item.claimedAt ?? null;
  } else {
    newClaimedAt = formatDateTime(now);
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
  const currentWorktreePath = item.worktreePath ?? null;
  if (worktreeRequest !== undefined && worktreeRequest !== currentWorktreePath) {
    if (worktreeRequest === null) {
      delete data.worktree_path;
    } else {
      data.worktree_path = worktreeRequest;
    }
    changed.push("worktree_path");
  }
  if (labels !== undefined && labels.join("\u0000") !== item.labels.join("\u0000")) {
    data.labels = labels;
    changed.push("labels");
  }
  if (newDeps !== undefined && newDeps.join("\u0000") !== item.dependsOn.join("\u0000")) {
    data.depends_on = newDeps;
    changed.push("depends_on");
  }
  const currentReason = item.blockedReason ?? null;
  if (newReason !== currentReason) {
    data.blocked_reason = newReason;
    changed.push("blocked_reason");
  }
  const currentClaimedAt = item.claimedAt ?? null;
  if (newClaimedAt !== currentClaimedAt) {
    if (newClaimedAt === null) {
      delete data.claimed_at;
    } else {
      data.claimed_at = newClaimedAt;
    }
    changed.push("claimed_at");
  }

  data.updated = formatDate(now);

  // Supervised steal records the takeover in the item body as a dated note.
  let newBody = item.body;
  if (opts.steal && stealReason) {
    const note = `> stolen ${formatDate(now)} by ${newAssignee}: ${stealReason}`;
    newBody = `${item.body.endsWith("\n") || item.body.length === 0 ? item.body : `${item.body}\n`}${note}\n`;
  }
  writeFileSync(item.filePath, stringifyFrontmatter(data, newBody), "utf8");

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
