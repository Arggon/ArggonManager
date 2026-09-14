import { existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { withItemLock } from "./lock.js";
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
import {
  acceptanceComplete,
  itemsById,
  loadItems,
  tryLoadItem,
  type WorkItem,
} from "./items.js";
import { findTasksDir, newItemPath, repoRootFromTasks } from "./paths.js";
import { assertParentEdge, expectedParentType } from "./relations.js";
import {
  commitTrackerMutation,
  readAutoCommitConfig,
  resolveAutoCommit,
  updateCommitMessage,
  type TrackerCommitResult,
} from "./tracker-commit.js";

export type UpdateOptions = {
  cwd: string;
  id: string;
  title?: string;
  status?: string;
  assignee?: string;
  /** Set working branch (v1); empty string clears it. */
  branch?: string;
  /**
   * Reparent the item (task-update-reparent): rewrites the `parent` frontmatter
   * field and MOVES the file/directory per the convention layout rules (a leaf
   * moves as a file into the new story's directory; a container moves its whole
   * directory, children riding along). Same value = documented no-op. Invalid
   * edges (unknown parent, wrong parent type, parent == own descendant) fail
   * before anything moves.
   */
  parent?: string;
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
  /**
   * Container TYPES auto-completed by the cascade, parallel to `autoCompleted`
   * (e.g. ["story", "epic", "initiative"]). Empty unless terminal. Lets callers
   * tell when the cascade reached epic level or above without a second lookup.
   */
  cascadeLevels: string[];
  /**
   * Ancestor containers the cascade did NOT complete because their own body
   * still has unchecked acceptance checkboxes (task-cascade-acceptance-aware).
   * Empty unless a skip happened. Additive — lets agents see why the cascade
   * stopped before the initiative.
   */
  cascadeSkipped: Array<{
    id: string;
    type: string;
    reason: "acceptance-incomplete" | "subtree-open";
    /**
     * For reason "subtree-open" (task-cascade-subtree-open-visibility): the id
     * of the direct child of the skipped container whose subtree still contains
     * a non-terminal item — the sibling that blocked the cascade.
     */
    sibling?: string;
  }>;
  /**
   * Absolute paths of EVERY item file written this run: the updated item plus
   * any cascade-completed ancestors (task-autocommit-update-import). Callers
   * use it for the tracker auto-commit — surgical staging of exactly these
   * paths. Empty only when nothing was written (never, on a successful run).
   */
  changedPaths: string[];
  /**
   * Reparent move (task-update-reparent): the absolute path of what moved —
   * the item FILE for a leaf (task/bug), the item DIRECTORY for a container
   * (story/epic/initiative). Undefined when no move happened.
   */
  movedFrom?: string;
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
  let parentRequest: string | undefined;
  if (opts.parent !== undefined) {
    parentRequest = opts.parent.trim();
    if (!parentRequest) throw new Error("--parent requires a non-empty item id");
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
    parentRequest !== undefined ||
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

  // Peek only to LOCATE the item file (bug-claim-race-no-lock): the claim is
  // a read-modify-write, so the real read → verify → write below runs under
  // the item lock — concurrent claim updates serialize instead of racing to
  // a last-write-wins on the item file.
  const peekTasksDir = findTasksDir(opts.cwd);
  const peekItem = itemsById(loadItems(peekTasksDir)).get(id);
  if (!peekItem) {
    throw new Error(`id '${id}' not found under tasks/`);
  }

  const apply = (): UpdateResult => {
  const tasksDir = findTasksDir(opts.cwd);
  const byId = itemsById(loadItems(tasksDir));
  const item = byId.get(id);
  if (!item) {
    throw new Error(`id '${id}' not found under tasks/`);
  }

  // Reparent validation (task-update-reparent): every refusal happens BEFORE
  // any filesystem mutation, so an invalid edge leaves the tree untouched.
  // Same parent is a documented no-op: no move, no `parent` change entry.
  let reparentTo: WorkItem | undefined;
  if (parentRequest !== undefined && parentRequest !== item.parent) {
    if (expectedParentType(item.type) === null) {
      throw new Error("initiative cannot have a parent");
    }
    const parentItem = byId.get(parentRequest);
    if (!parentItem) {
      throw new Error(`parent '${parentRequest}' not found under tasks/`);
    }
    // Cycle guard BEFORE the edge-type check so reparenting under one's own
    // descendant always reports the cycle, never a confusing type mismatch.
    // The new parent must not be the item itself or one of its descendants
    // (validate re-checks the whole tree on every run, but the mutation must
    // never be able to CREATE a cycle).
    const descendants = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of byId.values()) {
        if (
          candidate.parent &&
          descendants.has(candidate.parent) &&
          !descendants.has(candidate.id)
        ) {
          descendants.add(candidate.id);
          grew = true;
        }
      }
    }
    if (descendants.has(parentRequest)) {
      throw new Error(`cannot reparent '${id}' under '${parentRequest}' (own descendant — cycle)`);
    }
    assertParentEdge(item.type, parentItem.type);
    reparentTo = parentItem;
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

  // (assertStatus above verified the enum; the cast survives the closure —
  // property narrowing from the assertion does not cross the function boundary.)
  const newStatus = (opts.status as Status | undefined) ?? item.status;
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
  // Reparent move (task-update-reparent): performed LAST, right before the
  // frontmatter write, so every other validation (status transitions, claim
  // rules, steal gates) has already passed — a refused update never moves
  // anything. Leaves (task/bug) move as a FILE into the new story's
  // directory; containers move their WHOLE directory (children's frontmatter
  // is untouched — they reference the id, not a path). The old and new paths
  // all ride into the tracker auto-commit so git history follows the move and
  // the tree never ends dirty.
  let targetPath = item.filePath;
  let movedFrom: string | undefined;
  const movedOldPaths: string[] = [];
  const movedNewPaths: string[] = [];
  if (reparentTo) {
    const newPath = newItemPath({
      tasksDir,
      type: item.type,
      id,
      parentContainerDir: reparentTo.containerDir,
    });
    if (newPath !== item.filePath) {
      if (existsSync(newPath)) {
        throw new Error(`reparent target already exists: ${newPath}`);
      }
      const isLeaf = item.type === "task" || item.type === "bug";
      if (isLeaf) {
        movedOldPaths.push(item.filePath);
        movedNewPaths.push(newPath);
        mkdirSync(dirname(newPath), { recursive: true });
        renameSync(item.filePath, newPath);
      } else {
        const oldDir = item.containerDir;
        const newDir = dirname(newPath);
        for (const old of listFiles(oldDir)) {
          if (old === item.filePath) continue;
          movedOldPaths.push(old);
          movedNewPaths.push(join(newDir, old.slice(oldDir.length + 1)));
        }
        movedOldPaths.push(item.filePath);
        movedNewPaths.push(newPath);
        mkdirSync(dirname(newDir), { recursive: true });
        renameSync(oldDir, newDir);
      }
      movedFrom = isLeaf ? item.filePath : item.containerDir;
    }
    data.parent = reparentTo.id;
    if (!changed.includes("parent")) changed.push("parent");
    targetPath = newPath;
  }

  writeFileSync(targetPath, stringifyFrontmatter(data, newBody), "utf8");

  const updated = tryLoadItem(targetPath);
  if (!updated) {
    throw new Error(`Updated item is unreadable: ${targetPath}`);
  }

  // Automatic container completion (task-container-auto-done): when an item
  // reaches a terminal state and every sibling under a parent is terminal
  // too, that parent completes, cascading up the chain. Off with cascade:false.
  const { completed: completedContainers, skipped: cascadeSkipped } =
    opts.cascade === false || (newStatus !== "done" && newStatus !== "cancelled")
      ? { completed: [], skipped: [] }
      : autoCompleteAncestors(tasksDir, item, opts.now ?? new Date());

  return {
    id,
    path: targetPath,
    root: repoRootFromTasks(tasksDir),
    item: updated,
    changed,
    autoCompleted: completedContainers.map((container) => container.id),
    cascadeLevels: completedContainers.map((container) => container.type),
    cascadeSkipped,
    changedPaths: [
      targetPath,
      ...movedNewPaths,
      ...movedOldPaths,
      ...completedContainers.map((container) => container.filePath),
    ],
    movedFrom,
  };
  };

  // Hold the item lock across read → verify → write (bug-claim-race-no-lock).
  return withItemLock(peekItem.filePath, apply);
}

/**
 * Tracker auto-commit for `update` (task-autocommit-update-import): commit
 * exactly the item files written this run — the updated item plus any
 * cascade-completed ancestors, staged surgically. Message verb follows the
 * change (`done` for a terminal flip, `claimed` for a claim, `updated`
 * otherwise) with a ` (cascade: <ids>)` suffix when the cascade fired.
 * Gated on the run actually changing something (a requested field or a
 * cascade completion): a no-op write (nothing changed) skips like before.
 * `flag` is the `--no-commit` request; `undefined` defers to the
 * `x-tracker.auto-commit` config. Never throws — commit failures degrade to
 * a skip reason, never fail the update.
 */
export function maybeCommitUpdate(
  result: UpdateResult,
  flag: boolean | undefined,
): TrackerCommitResult | undefined {
  if (result.changed.length === 0 && result.autoCompleted.length === 0) return undefined;
  const statusChanged = result.changed.includes("status");
  const verb = statusChanged && (result.item.status === "done" || result.item.status === "cancelled")
    ? "done"
    : statusChanged && result.item.status === "in_progress"
      ? "claimed"
      : "updated";
  return commitTrackerMutation(result.root, result.changedPaths, {
    message: updateCommitMessage(verb, result.id, result.autoCompleted),
    commit: resolveAutoCommit(flag, readAutoCommitConfig(result.root)),
  });
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
 *
 * Acceptance-aware (task-cascade-acceptance-aware): a container whose OWN
 * body still has unchecked acceptance checkboxes is never auto-completed
 * ("done = acceptance checklist complete"). The walk simply stops there:
 * the skipped container stays non-terminal, so its parent's subtree is not
 * closed either and nothing above it completes — the conservative outcome
 * (no ancestor flips while a contract below is unfinished).
 */
function autoCompleteAncestors(
  tasksDir: string,
  from: WorkItem,
  now: Date,
): {
  completed: WorkItem[];
  skipped: Array<{
    id: string;
    type: string;
    reason: "acceptance-incomplete" | "subtree-open";
    sibling?: string;
  }>;
} {
  const completed: WorkItem[] = [];
  const skipped: Array<{
    id: string;
    type: string;
    reason: "acceptance-incomplete" | "subtree-open";
    sibling?: string;
  }> = [];
  const byId = itemsById(loadItems(tasksDir));
  let parentId = from.parent;
  const seen = new Set<string>([from.id]);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const container = byId.get(parentId);
    if (!container) break;
    const children = [...byId.values()].filter((candidate) => candidate.parent === container.id);
    const openSibling = children.find((child) => !subtreeClosed(child, byId));
    if (children.length === 0 || openSibling) {
      // Subtree-open visibility (task-cascade-subtree-open-visibility): when
      // the walk stops because a sibling subtree still holds a non-terminal
      // item, record WHICH sibling blocked it instead of stopping silently.
      if (openSibling) {
        skipped.push({
          id: container.id,
          type: container.type,
          reason: "subtree-open",
          sibling: openSibling.id,
        });
      }
      break;
    }
    if (!TERMINAL.has(container.status)) {
      // Acceptance contract check happens BEFORE the write: an unchecked box
      // in the container's own body vetoes auto-completion.
      if (!acceptanceComplete(container.body)) {
        skipped.push({ id: container.id, type: container.type, reason: "acceptance-incomplete" });
        break;
      }
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
      completed.push(container);
    }
    parentId = container.parent;
  }
  return { completed, skipped };
}

/** A subtree is closed when every child is terminal and, for containers, its own subtree is closed too. */
function subtreeClosed(item: WorkItem, byId: Map<string, WorkItem>): boolean {
  if (!TERMINAL.has(item.status)) return false;
  if (item.type === "task" || item.type === "bug") return true;
  const children = [...byId.values()].filter((candidate) => candidate.parent === item.id);
  return children.every((child) => subtreeClosed(child, byId));
}

/**
 * Every file under `dir`, recursively, dotfiles skipped (mirror of the loader
 * walk in items.ts). Used to plan the container reparent move: the auto-commit
 * stages each old path (deletion) next to its new path so history follows.
 */
function listFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}
