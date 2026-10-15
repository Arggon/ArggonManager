---
type: task
status: in_progress
id: task-publish-auth-hint-review-observations
title: "publish-auth-hint (PR #741) review observations: message fallback is consulted when a non-auth code exists (docstring says otherwise); spawnSync maxBuffer edge exits 2 without re-emitting npm stderr"
assignee: arggon-delivery-lead
branch: feat/task-publish-auth-hint-review-observations
parent: story-release-pipeline
labels: [release, failure-mode, review-followup]
created: "2026-10-12"
updated: "2026-10-15"
claimed_at: "2026-10-15T01:21:16.370Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-publish-auth-hint-review-observations
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-publish-auth-hint-review-observations.md
  Leaves live only under a story. id is the filename stem: task-publish-auth-hint-review-observations.
  CLI `arggon create task publish-auth-hint-review-observations` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# publish-auth-hint (PR #741) review observations: message fallback is consulted when a non-auth code exists (docstring says otherwise); spawnSync maxBuffer edge exits 2 without re-emitting npm stderr

## Context

Two non-blocking observations from the standards review of PR #741
(`bug-release-needs-auth-self-describing`, the `cli/publish-auth-hint.mjs`
wrapper), recorded so they outlive the parent item:

1. **Message fallback ordering vs the documented contract.** The module
   docstring says the message patterns are consulted "when the log carries no
   code line", but `classifyPublishFailure` falls through to `AUTH_MESSAGES`
   whenever no _auth_ code exists — including when a non-auth code (e.g.
   `E404`) is present. A log carrying `E404` plus an incidental
   "requires you to be logged in" substring would be annotated as auth. Low
   real-world risk (npm's 404 output does not usually carry those phrases), but
   the code and the docstring disagree.
2. **`spawnSync` maxBuffer edge.** npm stderr larger than the 1 MiB default
   buffer makes `spawnSync` fail; the wrapper then exits 2 via `usage()` without
   re-emitting the captured output. Pathological (npm error output is small),
   but the failure mode would hide the underlying npm error.

## Acceptance

- [ ] Either gate the message fallback on `codes.length === 0` (match the
      docstring) or amend the docstring to state the real contract — pick one
      and pin it with a test (a log with a non-auth code AND an auth-phrase
      substring must classify as `other`)
- [ ] Decide the maxBuffer edge: raise the buffer, or on `spawnSync` failure
      still re-emit whatever npm output was captured before exiting — a hidden
      npm error must not become a hidden wrapper error
- [ ] Existing behaviour pinned by `cli/publish-auth-hint.test.ts` stays green;
      `npm run test` green

## Notes

Filed 2026-10-12 by the delivery lead from the PR #741 standards review; the
parent item merged with these recorded as non-blocking.

### 2026-10-15 @arggon-maker
**Review observations resolved — decisions, evidence, gates (PR #829).**

**1. Message-fallback ordering — gated on `codes.length === 0`; the code now matches the docstring.** `classifyPublishFailure` no longer consults `AUTH_MESSAGES` when any `npm error code` line is present: the code line is authoritative, auth or not. Header bullet tightened to "the matching message text ONLY when the log carries no `code` line at all … any code line — auth or not — is authoritative".

Classify matrix (exit 1) before → after:

- `E404` + "requires you to be logged in" → `auth` (wrong hint) → `other`, evidence `npm error code E404`
- auth phrase, no code line → `auth` → `auth` (unchanged)
- no code line, no phrase → `other` → `other` (unchanged)
- `ENEEDAUTH` / `E401` → `auth` → `auth` (unchanged)

Tests: unit `classifyPublishFailure — a code line is authoritative over message text` (all three orderings) + wrapper-mode E404+phrase test (no `AUTHENTICATION` / `npm trust list` output). Adversarial check: the 3 new tests run against the pre-change module → `3 failed | 39 skipped`; with the change → `42 passed`.

**2. `spawnSync` maxBuffer edge — decision: re-emit the captured output; do not raise the buffer.** Probe (node v26.7.0, child writing 2 MiB synchronously to stderr, `stdio: ["ignore","inherit","pipe"]`, `encoding: "utf8"`): `error.code=ENOBUFS`, `status=null`, `signal=SIGTERM`, **`child.stderr` = 1085504 chars with the prefix intact** (`npm error code ENEEDAUTH\nxxx…`). So on `child.error` the wrapper now re-emits `child.stderr` (when non-empty) before the usage line and still exits 2. Rationale for not raising: the threshold only moves and the lossy path stays; re-emit is testable and preserves the head of npm's output.

Flush note: a second probe showed `process.exit` after a large pipe write drops the tail (146176 of 2 MiB arrived), so `usage()` sets `process.exitCode = 2` and its callers return (release-guard precedent) — the re-emit is flushed. Publish semantics unchanged: the non-error path is untouched (`process.exitCode = status`), the child's exit status is preserved and a passing publish prints nothing extra.

Test: wrapper-mode ENOBUFS test — fixture writes ~1.5 MiB synchronously with a marker past one 64 KiB pipe buffer; asserts exit 2, the captured prefix + marker present and ordered before `cannot run`, and `ENOBUFS` named. The parent buffer is raised (8 MiB) only to observe the full re-emit.

**Files:** `cli/publish-auth-hint.mjs`, `cli/publish-auth-hint.test.ts`, `ArggonManager/docs/playbooks/node.md` (lesson line). Commit `00f86426`; PR https://github.com/Arggon/ArggonManager/pull/829.

**Gates (worktree, all green):**

- `npm run arggon -- validate` → ok (0 warnings, convention v5)
- `npx vitest run cli/publish-auth-hint.test.ts` → 42 passed
- `npm test` (after `npm run build`) → 158 files / 3481 tests passed
- `npm run lint` → clean; `npm run test:structure` → 5 passed
- `npx prettier --check` on the three touched files → clean
