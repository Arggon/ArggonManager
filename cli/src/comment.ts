import { readFileSync, writeFileSync } from "node:fs";
import { stringifyFrontmatter } from "./frontmatter.js";
import { formatDate } from "./dates.js";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { findTasksDir, repoRootFromTasks } from "./paths.js";
import { resolveCurrentLogin } from "./list.js";
import {
  commitTrackerMutation,
  readAutoCommitConfig,
  resolveAutoCommit,
  trackerCommitMessage,
  type TrackerCommitResult,
} from "./tracker-commit.js";

export type CommentOptions = {
  cwd: string;
  /** Work item id (filename stem). */
  id: string;
  /** Comment text; may span multiple lines (each line lands under the heading). */
  text: string;
  /**
   * Read the comment text from this path instead of `text`; `-` reads stdin.
   * CLI-only ergonomics (task-comment-stdin-file): the text is taken verbatim
   * from the file, outside the shell, so backticks, quotes and `$` land in the
   * body unmangled. The MCP `arggon_comment` tool keeps taking `text` directly.
   */
  file?: string;
  /** Explicit author login; when omitted, resolved like `list --assignee @me`. */
  author?: string;
  /**
   * Auto-commit the commented item file (tracker hygiene). `undefined`
   * resolves via `x-tracker.auto-commit` config, default ON.
   */
  commit?: boolean;
  /** Clock override for deterministic output/tests; defaults to now. */
  now?: Date;
  /** Author-resolution environment (tests inject one; defaults to process.env). */
  env?: NodeJS.ProcessEnv;
  /** Author-resolution override (tests); defaults to resolveCurrentLogin(env). */
  resolveMe?: () => string | undefined;
};

export type CommentResult = {
  id: string;
  /** Absolute path of the commented item file. */
  path: string;
  /** Repo root (parent of tasks/). */
  root: string;
  /** The comment as appended to the body. */
  comment: {
    author: string;
    /** YYYY-MM-DD (UTC calendar day) rendered in the section heading. */
    date: string;
    /** Comment text lines as appended under the heading. */
    lines: string[];
  };
  /** Tracker auto-commit outcome (task-auto-commit-tracker). */
  commit?: TrackerCommitResult;
};

/**
 * Append a timestamped, author-attributed comment section to an item's BODY:
 *
 *   ### 2026-09-11 @<author>
 *   <text lines>
 *
 * This is a body-only write path — the frontmatter is re-serialized from the
 * parsed data unchanged. In particular `updated` is NOT touched: a comment is
 * history, not a status change (agents may comment on done/cancelled items;
 * this is not a reopen). Mirrors the `--steal --reason` body-append precedent
 * (cli/src/update.ts) as its own command.
 */
export function runComment(opts: CommentOptions): CommentResult {
  const id = opts.id.trim();
  if (!id) throw new Error("id is required");
  if (opts.file !== undefined && opts.text.trim() !== "") {
    throw new Error("pass either the comment text or --file <path>, not both");
  }
  const source = opts.file !== undefined ? readCommentSource(opts.file) : opts.text;
  const text = source.replace(/\r\n/g, "\n").replace(/\s+$/g, "").replace(/^\n+/, "");
  if (!text.trim()) {
    throw new Error("comment text must not be empty");
  }

  const author = opts.author?.trim() || resolveAuthor(opts);
  if (!author) {
    throw new Error(
      "could not resolve comment author (pass --author <login>, or set GITHUB_USER or GITHUB_ACTOR, or authenticate gh: gh api user)",
    );
  }

  const tasksDir = findTasksDir(opts.cwd);
  const byId = itemsById(loadItems(tasksDir));
  const item: WorkItem | undefined = byId.get(id);
  if (!item) {
    throw new Error(`id '${id}' not found under tasks/`);
  }

  const now = opts.now ?? new Date();
  const date = formatDate(now);
  const lines = text.split("\n");
  const heading = `### ${date} @${author}`;

  // Blank line before the section; section itself ends with a newline.
  const base = item.body.endsWith("\n") || item.body.length === 0 ? item.body : `${item.body}\n`;
  const newBody = `${base}\n${heading}\n${lines.join("\n")}\n`;

  // Body-only write: frontmatter data round-trips unchanged (no `updated` bump).
  writeFileSync(item.filePath, stringifyFrontmatter(item.data, newBody), "utf8");

  const root = repoRootFromTasks(tasksDir);
  const commit = commitTrackerMutation(root, [item.filePath], {
    message: trackerCommitMessage("commented", [id]),
    commit: resolveAutoCommit(opts.commit, readAutoCommitConfig(root)),
  });

  return {
    id,
    path: item.filePath,
    root,
    comment: { author, date, lines },
    commit,
  };
}

/** Explicit `author` is handled by the caller; this resolves the @me fallback. */
function resolveAuthor(opts: CommentOptions): string | undefined {
  if (opts.resolveMe) return opts.resolveMe();
  return resolveCurrentLogin(opts.env ?? process.env);
}

/**
 * Read the `--file <path>` comment source as verbatim UTF-8 (`-` = stdin).
 * This path exists to bypass the shell (task-comment-stdin-file): backticks,
 * double quotes and `$` must reach the body exactly as written.
 */
function readCommentSource(file: string): string {
  if (file === "-") {
    try {
      return readFileSync(0, "utf8");
    } catch {
      throw new Error("--file -: could not read stdin (pipe the comment text in)");
    }
  }
  try {
    return readFileSync(file, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    const codeText = typeof code === "string" ? code : "unknown";
    if (codeText === "ENOENT") {
      throw new Error(`--file '${file}': file not found (pass a readable UTF-8 file, or - for stdin)`);
    }
    if (codeText === "EISDIR") {
      throw new Error(`--file '${file}': is a directory (pass a UTF-8 file, or - for stdin)`);
    }
    throw new Error(`--file '${file}': could not read file (${codeText})`);
  }
}
