import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { itemsById, loadItems } from "./items.js";
import { sanitizeHumanTextUncapped } from "./sanitize.js";
import type { WorkItem } from "./items.js";

/**
 * Progressive-disclosure read path (ADR 0006, spec show-item-003): the whole
 * file is on disk anyway, but agents should not PAY for the whole file on
 * every read — comment tails grow ~226 B per comment, forever. `show` returns
 * the item's frontmatter plus a bounded comment tail by default; the full
 * body is an explicit `--body` opt-in.
 *
 * Pure read: no lock, no writes, no tracker commit. Ever.
 */

/** Default comment-tail size for the compact (no-flag) view. */
export const DEFAULT_TAIL_COMMENTS = 3;

export type ShowComment = {
  /** YYYY-MM-DD from the `### <date> @<author>` heading. */
  date: string;
  /** Author login from the heading. */
  author: string;
  /** Text lines under the heading (heading excluded). */
  lines: string[];
};

export type ShowOptions = {
  cwd: string;
  /** Work item id (filename stem). */
  id: string;
  /** Frontmatter only — no body, no comments (highest precedence). */
  meta?: boolean;
  /** Full body including ALL comments (explicit unbounded opt-in). */
  body?: boolean;
  /** Compact-view tail size; overrides DEFAULT_TAIL_COMMENTS. */
  tailComments?: number;
};

export type ShowResult = {
  id: string;
  /** Absolute path of the item file. */
  path: string;
  /** Repo root (parent of tasks/). */
  root: string;
  item: WorkItem;
  /** Prose body (everything before the first comment heading). */
  prose: string;
  /** ALL comments in the body, in document order. */
  allComments: ShowComment[];
  /**
   * The comments INCLUDED by this view: all of them under `--body`, the last
   * `tailComments` under the compact view, empty under `--meta`.
   */
  comments: ShowComment[];
  /** Whether the full body text is included (compact views render prose + tail). */
  includeBody: boolean;
};

/**
 * Split an item body into prose and `arggon comment` sections. A comment is
 * exactly what `arggon comment` appends: a `### YYYY-MM-DD @<author>` heading
 * followed by text lines until the next such heading or end of body.
 */
export function parseComments(body: string): { prose: string; comments: ShowComment[] } {
  const headingRe = /^### (\d{4}-\d{2}-\d{2}) @(\S+)\s*$/gm;
  const comments: ShowComment[] = [];
  const marks: Array<{ index: number; date: string; author: string }> = [];
  for (const match of body.matchAll(headingRe)) {
    marks.push({ index: match.index, date: match[1], author: match[2] });
  }
  if (marks.length === 0) {
    return { prose: body, comments };
  }
  const prose = body.slice(0, marks[0].index).replace(/\n+$/, "\n");
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].index + body.slice(marks[i].index).indexOf("\n") + 1;
    const end = i + 1 < marks.length ? marks[i + 1].index : body.length;
    const lines = body
      .slice(start, end)
      .replace(/\n+$/, "")
      .split("\n")
      .filter((line, idx, arr) => !(idx === arr.length - 1 && line.trim() === ""));
    comments.push({ date: marks[i].date, author: marks[i].author, lines });
  }
  return { prose, comments };
}

export function runShow(opts: ShowOptions): ShowResult {
  const id = opts.id.trim();
  if (!id) throw new Error("id is required");

  const tasksDir = findTasksDir(opts.cwd);
  const item = itemsById(loadItems(tasksDir)).get(id);
  if (!item) {
    throw new Error(`id '${id}' not found under tasks/`);
  }

  const { prose, comments } = parseComments(item.body);
  const meta = opts.meta === true;
  const full = !meta && opts.body === true;
  const tail = opts.tailComments ?? DEFAULT_TAIL_COMMENTS;
  const included = meta
    ? []
    : full
      ? comments
      : comments.slice(Math.max(0, comments.length - tail));

  return {
    id,
    path: item.filePath,
    root: repoRootFromTasks(tasksDir),
    item,
    prose,
    allComments: comments,
    comments: included,
    includeBody: !meta,
  };
}

/** Render the human (non-JSON) view for a ShowResult. */
export function renderShowText(result: ShowResult): string[] {
  const item = result.item;
  const lines: string[] = [];
  // Field lines are a line-oriented status channel: every repo-controlled
  // value is escaped in place (task-row-table-stdout-sanitize). The prose and
  // comment BLOCKS below are the verbatim content view and stay raw by design
  // (same `cat`-like contract as `show --body` / `arggon instructions`); see
  // the boundary note before the prose push.
  lines.push(
    `arggon show: ${sanitizeHumanTextUncapped(item.id)} — ${sanitizeHumanTextUncapped(item.title ?? item.id)}`,
  );
  lines.push(
    `  type: ${item.type} · status: ${item.status} · parent: ${sanitizeHumanTextUncapped(item.parent ?? "(none)")}`,
  );
  if (item.assignee) lines.push(`  assignee: ${sanitizeHumanTextUncapped(item.assignee)}`);
  if (item.branch) lines.push(`  branch: ${sanitizeHumanTextUncapped(item.branch)}`);
  if (item.labels.length > 0)
    lines.push(`  labels: ${sanitizeHumanTextUncapped(item.labels.join(", "))}`);
  if (item.priority) lines.push(`  priority: ${sanitizeHumanTextUncapped(item.priority)}`);
  if (item.dependsOn.length > 0)
    lines.push(`  depends_on: ${sanitizeHumanTextUncapped(item.dependsOn.join(", "))}`);
  if (item.blockedReason)
    lines.push(`  blocked_reason: ${sanitizeHumanTextUncapped(item.blockedReason)}`);
  if (item.milestone) lines.push(`  milestone: ${sanitizeHumanTextUncapped(item.milestone)}`);
  if (item.claimedAt) lines.push(`  claimed_at: ${sanitizeHumanTextUncapped(item.claimedAt)}`);
  if (item.worktreePath) lines.push(`  worktree: ${sanitizeHumanTextUncapped(item.worktreePath)}`);
  if (item.issue !== null) lines.push(`  issue: #${item.issue}`);
  lines.push(`  path: ${sanitizeHumanTextUncapped(result.path)}`);
  if (!result.includeBody) return lines;

  // Verbatim content boundary (task-row-table-stdout-sanitize decision): prose
  // and comment text are the item's content, not a status row — a `show` of a
  // hostile item body is the same trust question as `cat`-ing the file (and
  // `--body` / `arggon instructions` expose it explicitly). They stay raw by
  // design; only the reconstructed comment heading (CLI-composed structure:
  // `### <date> @<author>`) has its repo-controlled author escaped.
  const prose = result.prose.trim();
  if (prose) {
    lines.push("");
    lines.push(prose);
  }
  const comments = result.comments;
  if (comments.length > 0) {
    const hidden = result.allComments.length - comments.length;
    if (hidden > 0) {
      lines.push("");
      lines.push(`  … ${hidden} earlier comment(s) omitted (use --body for the full history)`);
    }
    for (const comment of comments) {
      lines.push("");
      lines.push(`### ${comment.date} @${sanitizeHumanTextUncapped(comment.author)}`);
      lines.push(...comment.lines);
    }
  }
  return lines;
}
