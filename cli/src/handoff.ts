import { execFileSync } from "node:child_process";
import { runComment, type CommentResult } from "./comment.js";

/**
 * Structured, bounded session-end handoff (task-handoff-command):
 *
 *   ### handoff 2026-09-15 @<author> — next: <step>
 *   - branch: <branch>
 *   - open questions: <q1; q2>
 *
 * This is `comment` with structure: the section is appended through the same
 * body-only machinery (item lock, @me author resolution, frontmatter never
 * touched, tracker auto-commit), so a handoff is history like a comment — it
 * works on done/cancelled items and is not a reopen. Bounded by construction
 * (token-context principle: structured + bounded beats prose): every field is
 * capped at `HANDOFF_FIELD_CAP` (200) characters and the whole section is at
 * most 3 capped lines plus the heading (< ~800 chars with a typical login).
 * Kernel failures reuse `COMMENT_FAILED` — the failure surface (unknown id,
 * unresolvable author, lock contention) is the comment kernel's.
 */

/** Per-field character cap (branch, next, open questions); longer input truncates. */
export const HANDOFF_FIELD_CAP = 200;

export type HandoffOptions = {
  cwd: string;
  /** Work item id (filename stem). */
  id: string;
  /** The next concrete step for the resuming agent (required). */
  next: string;
  /** Working branch; auto-detected from git when omitted. */
  branch?: string;
  /** Optional open questions, semicolon-separated by convention. */
  openQuestions?: string;
  author?: string;
  commit?: boolean;
  /** Clock override for deterministic output/tests; defaults to now. */
  now?: Date;
  env?: NodeJS.ProcessEnv;
  resolveMe?: () => string | undefined;
};

export type HandoffResult = CommentResult & {
  /** The structured fields as rendered (post-cap). */
  handoff: {
    branch: string;
    next: string;
    openQuestions?: string;
  };
};

/** Trim and cap one field; returns undefined for empty input. */
function capField(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > HANDOFF_FIELD_CAP) {
    const marker = "…";
    // The marker counts against the cap: the rendered field is never longer
    // than HANDOFF_FIELD_CAP characters.
    return trimmed.slice(0, HANDOFF_FIELD_CAP - marker.length) + marker;
  }
  return trimmed;
}

/**
 * Auto-detect the current git branch. Non-git trees (a first-class arggon
 * deployment) degrade to the literal `unknown` rather than failing — a
 * handoff must never be blocked on git.
 */
function detectBranch(cwd: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

export function runHandoff(opts: HandoffOptions): HandoffResult {
  const next = capField(opts.next);
  if (!next) {
    throw new Error('handoff requires --next "<next step>" (the first thing the resuming agent should do)');
  }
  const branch = capField(opts.branch) ?? detectBranch(opts.cwd);
  const openQuestions = capField(opts.openQuestions);

  const lines = [`- branch: ${branch}`];
  if (openQuestions) lines.push(`- open questions: ${openQuestions}`);

  const result = runComment({
    cwd: opts.cwd,
    id: opts.id,
    text: lines.join("\n"),
    author: opts.author,
    commit: opts.commit,
    now: opts.now,
    env: opts.env,
    resolveMe: opts.resolveMe,
    heading: (date, author) => `### handoff ${date} @${author} — next: ${next}`,
  });

  return {
    ...result,
    handoff: openQuestions ? { branch, next, openQuestions } : { branch, next },
  };
}
