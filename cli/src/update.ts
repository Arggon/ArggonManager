import { writeFileSync } from "node:fs";
import { stringifyFrontmatter } from "./frontmatter.js";
import {
  assertStatus,
  assertAssignee,
  assertClaimAndBlocked,
  canTransition,
  isClaimed,
  TRANSITIONS,
} from "./status.js";
import { formatDate } from "./create.js";
import { itemsById, loadItems, tryLoadItem, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";

export type UpdateOptions = {
  cwd: string;
  id: string;
  title?: string;
  status?: string;
  assignee?: string;
  /** Clear assignee (subject to the claim rule for the resulting status). */
  unassign?: boolean;
  /** Replace the full labels list (comma-separated). */
  labels?: string;
  blockedReason?: string;
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
 * invalid enums, illegal transitions, claim-rule violations, or claim steal.
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

  const requested =
    title !== undefined ||
    opts.status !== undefined ||
    opts.assignee !== undefined ||
    opts.unassign === true ||
    labels !== undefined ||
    opts.blockedReason !== undefined;
  if (!requested) {
    throw new Error("nothing to update (pass --title, --status, --assignee, --labels, ...)");
  }

  const tasksDir = findTasksDir(opts.cwd);
  const item = itemsById(loadItems(tasksDir)).get(id);
  if (!item) {
    throw new Error(`id '${id}' not found under tasks/`);
  }

  const newStatus = opts.status ?? item.status;
  if (opts.status !== undefined && opts.status !== item.status) {
    const allowed = TRANSITIONS[item.status];
    if (!canTransition(item.status, newStatus)) {
      throw new Error(
        `cannot transition status ${item.status} -> ${newStatus} (allowed: ${allowed.join(", ")})`,
      );
    }
  }

  // Claim steal guard (#16 owns full concurrency; update refuses silent stomps).
  const currentAssignee = item.assignee ?? null;
  if (
    isClaimed(item.type, item.status, currentAssignee) &&
    opts.assignee !== undefined &&
    opts.assignee !== currentAssignee
  ) {
    throw new Error(
      `claim conflict: '${id}' is claimed by '${currentAssignee}' (status in_progress). ` +
        `Unclaim first (\`arggon update ${id} --status todo\`) or coordinate (see #16).`,
    );
  }

  // Assignee: explicit > unassign > unclaim default (in_progress -> todo) > keep.
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
  return { id, path: item.filePath, root: repoRootFromTasks(tasksDir), item: updated, changed };
}
