import { readFileSync } from "node:fs";
import { writeFileAtomic } from "./atomic.js";
import { stringifyFrontmatter } from "./frontmatter.js";
import { formatDate } from "./dates.js";
import { itemsById, loadItems, type WorkItem } from "./items.js";
import { withItemLock } from "./lock.js";
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
  /**
   * Heading override (task-handoff-command): `(date, author) => heading line`.
   * Default is the plain comment heading ``### <date> @<author>``; `runHandoff`
   * uses this to render its structured heading while reusing the rest of this
   * machinery (lock, author resolution, body-only append, tracker commit).
   */
  heading?: (date: string, author: string) => string;
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
  // Peek only to LOCATE the item file so its lock can be taken: the
  // authoritative read below runs under withItemLock (bug-comment-torn-read).
  // The peek retries a transient miss a bounded number of times so a live item
  // can never look absent to a contender (see locateItem).
  const item: WorkItem = locateItem(tasksDir, id);

  const now = opts.now ?? new Date();
  const date = formatDate(now);
  const lines = text.split("\n");
  const heading = opts.heading ? opts.heading(date, author) : `### ${date} @${author}`;

  // Blank line before the section; section itself ends with a newline.
  // The read-modify-write is serialized with withItemLock (bug-comment-race-no-lock):
  // without it, two concurrent `arggon comment` processes on the SAME item both
  // read the original body and full-file-write — last-write-wins silently drops
  // one comment. The body is re-read INSIDE the lock so each process appends to
  // the other's result, not to a stale snapshot. Same lock family as the claim
  // path (bug-claim-race-no-lock, PR #134) and runUpdate.
  let filePath = item.filePath;
  withItemLock(item.filePath, () => {
    const fresh: WorkItem | undefined = itemsById(loadItems(tasksDir)).get(id);
    if (!fresh) {
      throw new Error(`id '${id}' not found under the tracker`);
    }
    filePath = fresh.filePath;
    const base =
      fresh.body.endsWith("\n") || fresh.body.length === 0 ? fresh.body : `${fresh.body}\n`;
    const newBody = `${base}\n${heading}\n${lines.join("\n")}\n`;

    // Body-only write: frontmatter data round-trips unchanged (no `updated`
    // bump). Atomic (temp file + rename, bug-comment-torn-read): non-locking
    // readers (list, validate, MCP tools) can never observe a truncated item
    // in the old open+truncate window — rename(2) makes the swap invisible.
    writeFileAtomic(fresh.filePath, stringifyFrontmatter(fresh.data, newBody));
  });

  const root = repoRootFromTasks(tasksDir);
  const commit = commitTrackerMutation(root, [filePath], {
    message: trackerCommitMessage("commented", [id]),
    commit: resolveAutoCommit(opts.commit, readAutoCommitConfig(root)),
  });

  return {
    id,
    path: filePath,
    root,
    comment: { author, date, lines },
    commit,
  };
}

/**
 * Bounded retry for the initial item locate (bug-comment-torn-read).
 *
 * The locate step only needs the item's FILE PATH so the lock can be taken;
 * the authoritative read runs inside `withItemLock`. Historically this first
 * `loadItems` ran while a contender was inside its in-place `writeFileSync`
 * truncate->write window: the scan read an empty file, `softTryLoadItem`
 * skipped it, and the live item looked absent — the process then failed with
 * `id '<id>' not found under the tracker` (COMMENT_FAILED) while the file existed
 * the whole time. The write is atomic now (`writeFileAtomic`), so a same-path
 * rewrite can never transiently hide the item; the bounded retry is the
 * belt-and-braces guard for any residual rename window (the lookup happens
 * outside the lock because the lock needs the path the lookup produces).
 * A genuinely missing id pays at most LOCATE_ATTEMPTS scans + sleeps and then
 * gets the exact same error as before.
 */
const LOCATE_ATTEMPTS = 5;
const LOCATE_RETRY_MS = 20;

function locateItem(tasksDir: string, id: string): WorkItem {
  for (let attempt = 1; ; attempt++) {
    const item = itemsById(loadItems(tasksDir)).get(id);
    if (item) return item;
    if (attempt >= LOCATE_ATTEMPTS) {
      throw new Error(`id '${id}' not found under the tracker`);
    }
    sleepSync(LOCATE_RETRY_MS);
  }
}

/** Synchronous sleep between bounded retries (mirrors the lock waiter in lock.ts). */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
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
