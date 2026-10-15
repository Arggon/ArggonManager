---
type: task
status: in_progress
id: task-foreign-writes-char-clip-truncated
title: "claim.foreignWrites: per-character clipping does not set the native `truncated` flag (takeOver already does)"
assignee: arggon-delivery-lead
branch: feat/task-foreign-writes-char-clip-truncated
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [opencode-seam, parity]
priority: p3
created: "2026-10-02"
updated: "2026-10-15"
claimed_at: "2026-10-15T12:11:33.930Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-foreign-writes-char-clip-truncated
---

<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-foreign-writes-char-clip-truncated.md
  Leaves live only under a story. id is the filename stem: task-foreign-writes-char-clip-truncated.
  CLI `arggon create task foreign-writes-char-clip-truncated` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# claim.foreignWrites: per-character clipping does not set the native `truncated` flag (takeOver already does)

## Context

Filed from the #579 review round 2 (2026-10-02, @Coordinator): PR #579 taught
the native claim mapper to fold per-CHARACTER clipping into the envelope's
`truncated` flag for the take-over receipt (`at`, `by`, `replacedIdentity`,
`replacedClaimedAt`, `replaced.*`, each `files` entry — compared against their
sources), but the pre-existing `claim.foreignWrites` path still bounds its
strings to `MAX_NATIVE_PREPARATION_VALUE_CHARS` (observed:
`opencode/plugins/arggon/index.ts:196`, 200 chars; the `foreignWrites`
bounding at `:2957-2960`) with no fold: a >200-char repo-relative path or
identity is silently shortened and reported as complete. It was deliberately
NOT fixed in #579 because doing so flips `truncated` on default receipts, and
#579's default-identity invariant pins those byte-for-byte — so this is a
decision item, not a drive-by.

## Acceptance

- [x] Decide and document: does the native `truncated` flag report character clipping for `foreignWrites` too (consistent with `takeOver`, `built`, `linked`, `missingDependencies`), accepting that a pathological path makes the default receipt carry `truncated: true` — or is the flag defined as "the kernel capped the counts" and character clipping stays silent? — decided: the flag reports CHARACTER clipping (consistent reading); `claimForeignWritesTruncated` + the json-output.md `claim` note carry the decision (2026-10-15 comment below)
- [x] Whatever the decision, make the code and the docs say the same thing (json-output.md `claim.foreignWrites` note), and pin it with a hostile long-path test (and a plain-path test proving the common case stays silent under the chosen semantics) — hostile long-path and long-owner tests set the fold with nothing dropped, plain-path control stays silent; pre-fix 3 failed | 1 passed, post-fix 4 passed
- [x] Same question answered for a long string inside a `replaced.takeovers[]` chain entry, which neither receipt folds today — same answer, same fold: `claimTakeoverTruncated` compares each entry's four strings against the source, pinned by a chain-entry test

## Notes

### 2026-10-02 @Coordinator

### 2026-10-02 @Coordinator

Filed from the #579 review round 2: PR #579 taught the native claim mapper to fold per-CHARACTER clipping into the envelope's `truncated` flag for the take-over receipt (`at`, `by`, `replacedIdentity`, `replacedClaimedAt`, `replaced.*`, each `files` entry — compared against their sources), but the pre-existing `claim.foreignWrites` path still bounds its strings to `MAX_NATIVE_PREPARATION_VALUE_CHARS` with no fold: a >200-char repo-relative path or identity is silently shortened and reported as complete. It was deliberately NOT fixed in #579 because doing so flips `truncated` on default receipts, and #579's default-identity invariant pins those byte-for-byte — so this is a decision item, not a drive-by.

## Acceptance

- [x] Decide and document: does the native `truncated` flag report character clipping for `foreignWrites` too (consistent with `takeOver`, `built`, `linked`, `missingDependencies`), accepting that a pathological path makes the default receipt carry `truncated: true` — or is the flag defined as "the kernel capped the counts" and character clipping stays silent? — decided: CHARACTER clipping folds (see the ticked acceptance above and the 2026-10-15 evidence comment)
- [x] Whatever the decision, make the code and the docs say the same thing (json-output.md `claim.foreignWrites` note), and pin it with a hostile long-path test (and a plain-path test proving the common case stays silent under the chosen semantics). — code + docs agree; tests pin both cases
- [x] Same question answered for a long string inside a `replaced.takeovers[]` chain entry, which neither receipt folds today. — answered the same way and folded, with its own test

### 2026-10-15 @Arggon

Delivered on `feat/task-foreign-writes-char-clip-truncated`, PR #838 (ready, not draft). Commits: `b5006a52` (fix + tests + docs), `5fc596f1` (bundle regen). CI was pending at comment time (cli / tasks-validate / ui-smoke).

**Decision (acceptance 1 + 3).** The shared `truncated` flag reports CHARACTER clipping for `preparation.claim.foreignWrites` too — consistent with `takeOver` / `built` / `linked` / `missingDependencies`. The alternative reading ("the flag only names kernel count caps, character clipping stays silent") was rejected: a repo-relative path or identity silently shortened to 200 chars and then reported as the whole value is exactly the failure the flag exists to name, and the kernel never caps these strings. A pathological path therefore makes the default receipt carry `truncated: true` — the honest account; the common case stays byte-identical (nothing set when nothing was clipped). The same answer applies to a long string inside a `replaced.takeovers[]` chain entry (neither receipt folded it before; the kernel caps the chain LENGTH at 5, never its strings).

**Shape.** New `claimForeignWritesTruncated(bounded, input)` compares `owner`, `claimedAt`, each `files` entry and the count against the kernel's own values; `boundedPreparation` calls it in place of the inline `total > files.length` term. `claimTakeoverTruncated` gained the per-entry chain comparison (all four strings, compared against the source). Docs: `json-output.md` `claim` row states the fold; the code comments carry the decision; `opencode2.md`'s `preparation.truncated` row already said "a clipped string" — the code now agrees.

**Evidence (commands run; expected vs observed).**

- Pre-fix (index.ts reverted to HEAD, new tests kept): `npx vitest run opencode/plugins/arggon/tools.test.ts -t task-foreign-writes-char-clip-truncated` → 3 failed | 1 passed, each failure `AssertionError: expected undefined to be true` — the long-path fold, the long-owner fold and the chain-entry fold. Control passed.
- Post-fix: focused `tools.test.ts` 146 passed; `npm test` 160 files / 3529 passed; `npm run arggon -- validate` ok (0 warnings); `npm run lint` exit 0; `npm run test:structure` 5 passed / 0 failed; `npx prettier --check` on touched files clean; `npm run check:plugin` exit 0 (bundle 573,559 B).

**Acceptance boxes.** [1] decided and documented; [2] code + docs agree, hostile long-path test plus plain-path control pin it; [3] chain-entry answer documented and folded, with its own test. No blocker.

### handoff 2026-10-15 @Arggon — next: Standards review + merge PR #838; confirm CI green on head 5fc596f1.

- branch: feat/task-foreign-writes-char-clip-truncated
- open questions: None blocking. The CLI's own claim receipt is not re-bounded, so the fold is native-only and documented as such.
