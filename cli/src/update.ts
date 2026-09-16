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
import { closeLinkedIssue, type IssueRoundtripResult } from "./issue-roundtrip.js";
import { readConventionConfig } from "./convention.js";

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
  /**
   * Convert the item's type in place (task-promote-task-to-story). v1 supports
   * exactly one direction: `--type story` promotes a TASK to a story. The file
   * moves to the story layout under the task's grandparent epic, the id gains
   * the `story-` prefix (a container id must not start with `task-`/`bug-` —
   * validate would reject the tree otherwise), `depends_on` references to the
   * old id are rewritten tree-wide, and `issue`/labels/body ride along
   * untouched (a promoted task keeps its GitHub round-trip link). The promoted
   * story starts empty of children. Demotion (story → task) is refused; bugs
   * are refused (tasks only in v1); an already-story item is refused; a
   * missing/invalid target epic is refused — all before any mutation.
   */
  type?: string;
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
  /**
   * Set the additive `issue` frontmatter field (task-issue-field-cli): the
   * GitHub issue number (positive integer). `0` clears it. Same validation as
   * the create kernel — a malformed value fails before anything is written.
   */
  issue?: number;
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
  /**
   * Issue round-trip (task-issue-roundtrip) gh executor; tests inject a mock.
   * Only used when the item flips to done, carries an `issue` frontmatter
   * number, and `x-github.issue-roundtrip` is enabled.
   */
  execGh?: typeof import("node:child_process").execFileSync;
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
    reason: "acceptance-incomplete" | "subtree-open" | "lock-timeout";
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
  /**
   * Promotion id rename (task-promote-task-to-story): the OLD id when the
   * promotion renamed it (task-x -> story-x, since a container id must not
   * start with task-/bug-). Undefined when no rename happened.
   */
  renamedFrom?: string;
  /**
   * Issue round-trip outcome (task-issue-roundtrip): present only when the
   * update flipped the item to done, the item carries an `issue` frontmatter
   * number, and `x-github.issue-roundtrip` is enabled. Never blocks the flip.
   */
  issueRoundtrip?: IssueRoundtripResult;
};

/** Shared CSV split (trim parts, drop empties) — also used by create --labels. */
export function parseCsvList(raw: string): string[] {
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
  let typeRequest: string | undefined;
  if (opts.type !== undefined) {
    const trimmed = opts.type.trim();
    if (!trimmed) throw new Error("--type requires a type");
    if (trimmed !== "story") {
      throw new Error(
        "--type only supports 'story' in v1 (task → story promotion); demoting a story to a task is not supported",
      );
    }
    if (parentRequest !== undefined) {
      throw new Error("pass either --type or --parent, not both (promotion derives the parent from the grandparent epic)");
    }
    typeRequest = trimmed;
  }
  let issueRequest: number | null | undefined;
  if (opts.issue !== undefined) {
    if (!Number.isInteger(opts.issue) || opts.issue < 0) {
      throw new Error("issue must be a positive integer (the GitHub issue number), or 0 to clear it");
    }
    issueRequest = opts.issue > 0 ? opts.issue : null;
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
    typeRequest !== undefined ||
    opts.unassign === true ||
    opts.steal === true ||
    worktreeRequest !== undefined ||
    labels !== undefined ||
    depsReplace !== undefined ||
    opts.addDependsOn !== undefined ||
    issueRequest !== undefined ||
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

  // Promotion validation (task-promote-task-to-story): every refusal happens
  // BEFORE any filesystem mutation. v1 supports exactly one conversion —
  // task → story (--type story). The parse step already refused every other
  // requested type; here we refuse the items it cannot apply to.
  let promoteEpic: WorkItem | undefined;
  let promoteNewPath: string | undefined;
  let promoteNewId: string | undefined;
  if (typeRequest !== undefined) {
    if (item.type === "story") {
      throw new Error(`cannot convert '${id}': it is already a story`);
    }
    if (item.type !== "task") {
      throw new Error(
        `--type story promotes tasks only (v1); '${id}' is a ${item.type} — refusing (create the story and move the work instead)`,
      );
    }
    const parentStory = item.parent ? byId.get(item.parent) : undefined;
    if (!parentStory || parentStory.type !== "story") {
      throw new Error(
        `task '${id}' has no parent story to derive the target epic from — create the epic first (arggon create epic <title> --parent <initiative-id>) and reparent '${id}' under a story below it`,
      );
    }
    const epic = parentStory.parent ? byId.get(parentStory.parent) : undefined;
    if (!epic) {
      throw new Error(
        `parent story '${parentStory.id}' has no parent epic — create the epic first and reparent '${parentStory.id}' under it (a story lives under an epic)`,
      );
    }
    try {
      assertParentEdge("story", epic.type);
    } catch {
      throw new Error(
        `promoting '${id}' needs an epic target, but its grandparent '${epic.id}' is a ${epic.type} — create the epic first (arggon create epic <title> --parent <initiative-id>)`,
      );
    }
    // A promoted story is a CONTAINER, and container ids must not start with
    // task- or bug- (validate would reject the tree). Promoting therefore also
    // renames the id: task-x -> story-x (ids without the task- prefix keep
    // their id). References ride along: every depends_on entry pointing at the
    // old id is rewritten tree-wide.
    promoteNewId = id.startsWith("task-") ? `story-${id.slice("task-".length)}` : id;
    if (promoteNewId !== id && byId.has(promoteNewId)) {
      throw new Error(`cannot promote '${id}': target id '${promoteNewId}' is already taken`);
    }
    promoteEpic = epic;
    promoteNewPath = newItemPath({
      tasksDir,
      type: "story",
      id: promoteNewId,
      parentContainerDir: epic.containerDir,
    });
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
  // issue (task-issue-field-cli): positive integer sets the field, 0 clears.
  const currentIssue = item.issue ?? null;
  if (issueRequest !== undefined && issueRequest !== currentIssue) {
    if (issueRequest === null) {
      delete data.issue;
    } else {
      data.issue = issueRequest;
    }
    changed.push("issue");
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
  let renamedFrom: string | undefined;
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

  // Promotion move (task-promote-task-to-story): performed LAST like the
  // reparent move, after every other validation has passed. The task file
  // moves to the story layout under the grandparent epic
  // (<epic>/<story-id>/<story-id>.md, exactly where `create story` places
  // it), the type and parent flip, and the promoted story starts EMPTY of
  // children. issue/labels/body ride along untouched in the same file.
  if (promoteNewPath && promoteEpic && promoteNewId) {
    if (existsSync(promoteNewPath)) {
      throw new Error(`promotion target already exists: ${promoteNewPath}`);
    }
    mkdirSync(dirname(promoteNewPath), { recursive: true });
    renameSync(item.filePath, promoteNewPath);
    movedOldPaths.push(item.filePath);
    movedNewPaths.push(promoteNewPath);
    movedFrom = item.filePath;
    data.type = "story";
    changed.push("type");
    data.parent = promoteEpic.id;
    if (!changed.includes("parent")) changed.push("parent");
    if (promoteNewId !== id) {
      data.id = promoteNewId;
      changed.push("id");
      renamedFrom = id;
      // Rewrite depends_on references to the old id tree-wide so the graph
      // stays resolvable (validate re-checks on every run). These files ride
      // into the auto-commit via movedNewPaths staging.
      for (const other of byId.values()) {
        if (other.id === id || !other.dependsOn.includes(id)) continue;
        writeFileSync(
          other.filePath,
          stringifyFrontmatter(
            {
              ...other.data,
              depends_on: other.dependsOn.map((dep) => (dep === id ? promoteNewId : dep)),
              updated: formatDate(now),
            },
            other.body,
          ),
          "utf8",
        );
        movedNewPaths.push(other.filePath);
      }
    }
    targetPath = promoteNewPath;
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

  // Issue round-trip (task-issue-roundtrip): when the update FLIPS the item to
  // done and it carries the additive `issue` frontmatter number (written by
  // `import-issues`), close the linked GitHub issue — opt-in, gated tree-wide
  // by `x-github.issue-roundtrip` (default OFF, flips happen through bots too;
  // a malformed config must never fail the flip, so the gate reads tolerantly
  // like the tracker auto-commit). Best effort like the tracker commit: gh
  // absent, unauthenticated, or failing degrade to a reported skip — reported
  // in the payload AND as a stderr warning when enabled, never silent, never
  // fatal. The flip flows through every caller (CLI, MCP) that uses runUpdate.
  const root = repoRootFromTasks(tasksDir);
  let issueRoundtrip: IssueRoundtripResult | undefined;
  const issueNumber = updated.issue ?? null;
  if (
    changed.includes("status") &&
    newStatus === "done" &&
    issueNumber !== null &&
    issueRoundtripEnabled(root)
  ) {
    issueRoundtrip = closeLinkedIssue(root, id, issueNumber, opts.execGh);
    if (!issueRoundtrip.closed) {
      process.stderr.write(
        `arggon: warning: issue round-trip skipped: ${issueRoundtrip.skipped}\n`,
      );
    }
  }

  return {
    id: updated.id,
    path: targetPath,
    root,
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
    ...(renamedFrom ? { renamedFrom } : {}),
    ...(issueRoundtrip ? { issueRoundtrip } : {}),
  };
  };

  // Hold the item lock across read → verify → write (bug-claim-race-no-lock).
  return withItemLock(peekItem.filePath, apply);
}

/**
 * Tolerant read of the `x-github.issue-roundtrip` gate (task-issue-roundtrip):
 * true only when explicitly enabled; a missing/malformed config yields the
 * documented default (OFF). Malformed config must never fail a done flip —
 * same contract as readAutoCommitConfig.
 */
function issueRoundtripEnabled(root: string): boolean {
  try {
    return readConventionConfig(root).github.issueRoundtrip === true;
  } catch {
    return false;
  }
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
 *
 * Lock-guarded (bug-cascade-lost-update): each ancestor's read-decide-write
 * runs under THAT ancestor's item lock (withItemLock), with a FRESH re-read
 * of the container file inside the lock. Without the guard, the cascade
 * writes ancestor files while holding only the CHILD's item lock, so a
 * concurrent direct update of the container (holding the container's lock)
 * or a sibling cascade could interleave with this write — last-write-wins
 * on the container file loses one side's change. LOCK ORDERING: locks are
 * acquired strictly CHILD -> ANCESTORS upward (leaf-first), one ancestor at
 * a time; every other lock site (update/start item lock, comment item lock)
 * takes exactly one item lock and the tracker git lock (tracker-commit.ts)
 * is a different lock family acquired only after the item locks are
 * released — no code path acquires an ancestor before its descendant, so
 * the ordering is deadlock-free. A lock timeout is a REPORTED skip
 * (`reason: "lock-timeout"` in cascadeSkipped, walk stops there): the child
 * write has already landed, so failing the whole update would misreport a
 * succeeded mutation; the next terminal update retriggers the cascade.
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
    reason: "acceptance-incomplete" | "subtree-open" | "lock-timeout";
    sibling?: string;
  }>;
} {
  const completed: WorkItem[] = [];
  const skipped: Array<{
    id: string;
    type: string;
    reason: "acceptance-incomplete" | "subtree-open" | "lock-timeout";
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
      // Guarded write (bug-cascade-lost-update): hold the ANCESTOR's item
      // lock across a fresh re-read + the write, so a concurrent direct
      // update of this container (serialized by the same lock) can never
      // interleave with the cascade's read-modify-write. Lock ordering is
      // strictly child -> ancestors upward (see the function comment).
      let stop = false;
      try {
        withItemLock(container.filePath, () => {
          const fresh = tryLoadItem(container.filePath);
          if (!fresh) {
            throw new Error(`Cascade ancestor unreadable: ${container.filePath}`);
          }
          if (TERMINAL.has(fresh.status)) {
            // Another writer completed it between our snapshot and the lock:
            // keep the in-memory copy fresh for the ancestors check below.
            container.status = fresh.status;
            return;
          }
          // Acceptance contract check happens BEFORE the write (on the FRESH
          // body): an unchecked box in the container's own body vetoes
          // auto-completion.
          if (!acceptanceComplete(fresh.body)) {
            skipped.push({ id: fresh.id, type: fresh.type, reason: "acceptance-incomplete" });
            stop = true;
            return;
          }
          writeFileSync(
            fresh.filePath,
            stringifyFrontmatter(
              { ...fresh.data, status: "done", updated: formatDate(now) },
              fresh.body,
            ),
            "utf8",
          );
          // Keep the in-memory copy fresh: the next ancestor's children check
          // must see this container as terminal.
          container.status = "done";
          completed.push(fresh);
        });
      } catch (err) {
        // Reported-skip semantics (bug-cascade-lost-update): the lock family
        // convention throws after LOCK_TIMEOUT_MS; here the timeout degrades
        // to a reported skip instead of failing the update — the child write
        // already landed, and the next terminal update retriggers the cascade.
        if (err instanceof Error && /failed to acquire lock/.test(err.message)) {
          skipped.push({ id: container.id, type: container.type, reason: "lock-timeout" });
          stop = true;
        } else {
          throw err;
        }
      }
      if (stop) break;
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
