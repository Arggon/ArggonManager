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
 * capped at `HANDOFF_FIELD_CAP` (200) UTF-16 code units, surrogate-safely (an
 * astral pair at the cut is never split), and the whole section is at most 3
 * capped lines plus the heading (< ~800 chars with a typical login).
 * Kernel failures reuse `COMMENT_FAILED` — the failure surface (unknown id,
 * unresolvable author, lock contention) is the comment kernel's.
 */

/** Per-field character cap (branch, next, open questions); longer input truncates. */
export const HANDOFF_FIELD_CAP = 200;

/**
 * Session identifier cap (task-handoff-provenance-session-identifier-in-handoff-sections):
 * a handoff may carry the caller's session id for provenance — bounded tighter
 * than the prose fields (ids like `sess_xxx` are short).
 */
export const HANDOFF_SESSION_CAP = 64;

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
  /**
   * Optional session identifier for provenance (explicit flag only: the CLI
   * cannot reliably know the caller's session id — callers pass what they
   * have). Rendered in the heading; omitted cleanly when absent.
   */
  session?: string;
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
    session?: string;
  };
};

/** The truncation marker; counts against the cap. */
const MARKER = "…";

/**
 * Unicode code point class `Cs` under the `u` flag matches only lone/unpaired
 * surrogates — a valid pair is a single astral code point and never matches.
 */
const LONE_SURROGATE = /\p{Cs}/gu;

/**
 * Bound one non-empty token to `cap` UTF-16 code units, marker included.
 * Shared by every handoff field (`capField`) and the session identifier
 * (`capSession`).
 *
 * Surrogate-safety (task-handoff-explicit-session-surrogate, extended to all
 * fields by task-handoff-field-cap-surrogate): field values are caller-supplied
 * UTF-16 that may be malformed, while the handoff body is written as UTF-8 — a
 * lone surrogate cannot round-trip (the write emits U+FFFD instead of the
 * surrogate). Two guards keep the rendered token clean without touching the
 * ordinary path:
 *
 * 1. Lone surrogates anywhere in the token are dropped before capping. The
 *    value is caller-controlled, so there is no delimiter cut to remove them;
 *    dropping them (rather than cutting at the first one) keeps every valid
 *    code point the caller sent. A token left empty by the drop counts as
 *    absent, like `normalizeSessionID`'s normalize-to-empty.
 * 2. When the cut would land between the halves of a valid pair, it backs off
 *    one unit and drops the pair whole (same pattern as `normalizeSessionID`),
 *    so the cut itself never manufactures a lone surrogate. The marker counts
 *    against the cap: the rendered token is at most `cap` code units.
 */
function capUnits(token: string, cap: number): string {
  const clean = token.replace(LONE_SURROGATE, "");
  if (clean.length <= cap) return clean;
  let end = cap - MARKER.length;
  const last = clean.charCodeAt(end - 1);
  // High surrogate at the cut: the low half is its pair (lone surrogates
  // were dropped above), so back off one unit to drop both.
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return clean.slice(0, end) + MARKER;
}

/**
 * Trim and cap one field; returns undefined for empty input (or input left
 * empty by dropping lone surrogates).
 */
function capField(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return capUnits(trimmed, HANDOFF_FIELD_CAP) || undefined;
}

/**
 * Cap the session identifier at HANDOFF_SESSION_CAP; undefined when empty.
 * Shares `capUnits` with `capField`, so the two stay on one truncation policy.
 */
function capSession(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return capUnits(trimmed, HANDOFF_SESSION_CAP) || undefined;
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
  const session = capSession(opts.session);

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
    heading: (date, author) =>
      `### handoff ${date} @${author}${session ? ` (session: ${session})` : ""} — next: ${next}`,
  });

  return {
    ...result,
    handoff: {
      branch,
      next,
      ...(openQuestions ? { openQuestions } : {}),
      ...(session ? { session } : {}),
    },
  };
}
