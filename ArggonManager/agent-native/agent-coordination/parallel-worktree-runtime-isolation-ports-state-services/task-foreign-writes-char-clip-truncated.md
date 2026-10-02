---
type: task
status: todo
id: task-foreign-writes-char-clip-truncated
title: "claim.foreignWrites: per-character clipping does not set the native `truncated` flag (takeOver already does)"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam, parity]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-foreign-writes-char-clip-truncated.md
  Leaves live only under a story. id is the filename stem: task-foreign-writes-char-clip-truncated.
  CLI `arggon create task foreign-writes-char-clip-truncated` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# claim.foreignWrites: per-character clipping does not set the native `truncated` flag (takeOver already does)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Filed from the #579 review round 2: PR #579 taught the native claim mapper to fold per-CHARACTER clipping into the envelope's `truncated` flag for the take-over receipt (`at`, `by`, `replacedIdentity`, `replacedClaimedAt`, `replaced.*`, each `files` entry — compared against their sources), but the pre-existing `claim.foreignWrites` path still bounds its strings to `MAX_NATIVE_PREPARATION_VALUE_CHARS` with no fold: a >200-char repo-relative path or identity is silently shortened and reported as complete. It was deliberately NOT fixed in #579 because doing so flips `truncated` on default receipts, and #579's default-identity invariant pins those byte-for-byte — so this is a decision item, not a drive-by.

## Acceptance
- [ ] Decide and document: does the native `truncated` flag report character clipping for `foreignWrites` too (consistent with `takeOver`, `built`, `linked`, `missingDependencies`), accepting that a pathological path makes the default receipt carry `truncated: true` — or is the flag defined as "the kernel capped the counts" and character clipping stays silent?
- [ ] Whatever the decision, make the code and the docs say the same thing (json-output.md `claim.foreignWrites` note), and pin it with a hostile long-path test (and a plain-path test proving the common case stays silent under the chosen semantics).
- [ ] Same question answered for a long string inside a `replaced.takeovers[]` chain entry, which neither receipt folds today.
