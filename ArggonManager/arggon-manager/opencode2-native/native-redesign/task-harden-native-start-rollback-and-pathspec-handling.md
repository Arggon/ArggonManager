---
type: task
status: in_progress
id: task-harden-native-start-rollback-and-pathspec-handling
title: Harden native start rollback and pathspec handling
assignee: Arggon
parent: native-redesign
labels: [opencode-seam, worktree, review]
priority: p1
created: "2026-09-24"
updated: "2026-09-24"
claimed_at: "2026-09-24T20:25:56.742Z"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-harden-native-start-rollback-and-pathspec-handling.md
  Leaves live only under a story. id is the filename stem: task-harden-native-start-rollback-and-pathspec-handling.
  CLI `arggon create task harden-native-start-rollback-and-pathspec-handling` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Harden native start rollback and pathspec handling

## Context

PR #419 (`fix/bug-native-start-worktree-no-install`) received a provisional NO-MERGE review on 2026-09-24. The shared dependency-preparation and native receipt work is sound, but the review identified blocking correctness and hygiene gaps that must be addressed in the same worktree before coordinator review can continue:

1. `worktree:false` does not create/attach the item branch before the explicit claim commit and does not report/push with CLI plain-start truthfulness.
2. A claim refusal can occur after native preparation created an owned node_modules symlink/link farm; rollback must remove only that preparation, observe worktree/branch removal, and never claim cleanup that failed.
3. `commitTrackerMutation` must use literal pathspec semantics for `git add`/`git commit`/`check-ignore`, reject Git pathspec magic and unsupported cross-root/absolute forms, and preserve cascade/ignored/concurrency behavior.
4. Every native-start failure after invocation must report `claimCommitted:false`, `claimCommit.status:"not-attempted"` (or a precise failed commit state), bounded reason, and preparation when known; no early failure may look successful.
5. The payload contract in `ArggonManager/docs/opencode2.md` is stale even though it is still cited; update it minimally alongside the agent/OpenCode playbooks without absorbing the broader retired-branch documentation cleanup.
6. Tests must eliminate raw shared `/tmp/outside.md`, disable Git maintenance in every fixture before commits, keep sibling worktrees under a tracked unique parent, and tear down the whole parent; repeated focused runs must leave no artifacts.

The current PR branch/worktree is `fix/bug-native-start-worktree-no-install`; this follow-up is claimed by Arggon for coordinator post-merge completion and must not be marked done by the worker.

## Acceptance

- [x] `worktree:false` creates or attaches the item branch before committing, reports the real current/ref/branch state, commits on that branch, and pushes when requested or already eligible; attach/re-run creates no duplicate branch or commit, with a fail-before-mutation fallback when ownership cannot be guaranteed.
- [x] Claim-refusal rollback removes only a start-owned symlink/link farm through the kernel ownership helper before worktree removal, observes removal/branch cleanup, and never reports “removed again” when either remains; primary-install and sibling-worktree safety regressions pass, including domain-removal failure.
- [x] `commitTrackerMutation` rejects pathspec magic and unsupported absolute/cross-root paths, uses literal pathspecs for add/commit/check-ignore, commits only requested files, and preserves multi-file, cascade, ignored-path, and contention behavior.
- [x] Native-start early/foreign/stale/branch/refusal failures carry consistent bounded `claimCommitted`/`claimCommit` receipts and preparation data where known; no failure is an unqualified success.
- [x] `ArggonManager/docs/opencode2.md` is minimally updated for the native payload contract, with agents/OpenCode playbook wording matching behavior; no unrelated retired-branch docs sweep.
- [x] Native fixtures use a tracked unique parent, disable `maintenance.auto=false` before commits, clean the full parent on teardown, and repeated focused tests leave no `/tmp` or worktree artifacts.
- [x] Reviewer repro cases, dependency-gate/failed-retry/rollback evidence, full `npm test`, lint, build, check:plugin, validate, strict context report, schema budget, and `git diff --check` are green; unresolved platform limitations are documented.

## Notes

Review context: PR #419 provisional NO-MERGE review, 2026-09-24. This item is intentionally separate tracker bookkeeping for the blocking findings; the original P1 item remains the implementation record.

### 2026-09-24 @ses_f2b1605beffe4ketLzfuVHnIWN
Review-fix evidence for PR #419 is complete in this worktree. All seven acceptance lines are checked after evidence: branch-only start has current/ref/branch/commit/push and attach assertions; rollback removes only owned preparation and observes domain/git removal (including failure); pathspec magic/cross-root guards and literal staging preserve ignored/exotic/cascade/contention behavior; early/foreign/stale/branch/refusal receipts are bounded and consistent; opencode2.md is minimally updated; fixtures use unique parents, maintenance.auto=false, and repeat cleanup; full gates and reviewer repros are green. The item remains intentionally in_progress for coordinator post-merge completion; do not mark done in this worktree.

### handoff 2026-09-24 @ses_f2b1605beffe4ketLzfuVHnIWN (session: ses_f2b1605beffe4ketLzfuVHnIWN) — next: Coordinator: re-review PR #419's blocking fixes, run the required review smoke, and complete this follow-up after merge verification.
- branch: fix/bug-native-start-worktree-no-install
- open questions: Standalone cold-start/model smoke remains in task-native-start-cold-smoke; Windows drive/junction paths were not executable on this Linux host.

### 2026-09-28 @ses_f2b1605beffe4ketLzfuVHnIWN
Re-review round 2 (`ea530234`): the two lines this re-review invalidated — `worktree:false` ordering/ownership and consistent claim receipts — were un-ticked before the fix and re-ticked only after the new evidence. Ordering now settles branch ownership (preflight → create/attach/switch) before the claim write, with an owned-branch-only rollback (`rollback { branchDeleted, restoredBranch }`, `null` when unowned); unexpected failures carry the observed `NativeStartProgress`, so a landed claim commit reports `claimCommitted: true` with committed status/hash instead of `not-attempted`. Three new regressions prove it (divergent recorded branch leaves the item byte-identical; refused claim after branch creation rolls back and restores the checkout; `successEnvelope` throw after a real commit stays truthful). Gates: `npm test` 97/1633, lint, build, check:plugin, context-strict (11,821 B ≤ 12,288 B), both validates, diff check, focused repros, no leftovers. Native cleanup untouched — finding 3 is `bug-native-cleanup-unverified-worktree-removal` (depends on this P1). PR body updated, no comment posted. Status intentionally remains in_progress.

### handoff 2026-09-28 @ses_f2b1605beffe4ketLzfuVHnIWN (session: ses_f2b1605beffe4ketLzfuVHnIWN) — next: Coordinator: re-review PR #419 for the ordering + post-claim receipt fixes, then complete this follow-up after merge verification.
- branch: fix/bug-native-start-worktree-no-install
- open questions: Native cleanup untouched: bug-native-cleanup-unverified-worktree-removal depends on this P1; cold-start/model smoke remains separate.

### 2026-09-28 @Arggon-coordinator
## FINAL REVIEW VERDICT — APPROVE

Final in-scope review of PR #419: **APPROVE**.

**Provisional findings resolved.** Plain-start branch ownership is settled before the claim mutation, with truthful owned-branch rollback; landed claim commits survive late/unexpected failures as committed; worktree dependency preparation, bounded receipts, link-farm rollback, literal path handling, docs, and fixture hygiene were independently re-verified. Every acceptance line on this follow-up was un-ticked when a re-review invalidated it and re-ticked only against recorded evidence.

**Engineering review bar: pass** across architecture/boundaries, conventions, quality/security/scalability, scope, tests, docs, and acceptance honesty.

**Gates run in the final in-scope review:** full test / lint / build / check:plugin / validate / context-strict, plus the schema budget (11,821 B ≤ 12,288 B).

**Scope boundary held.** The separate native cleanup defect is correctly tracked as `bug-native-cleanup-unverified-worktree-removal` and is not absorbed into this PR.

**Post-merge integration:** preserved all tracker history and changed no code beyond the reviewed head.

This verdict records approval only. The item remains `in_progress`; completion remains the coordinator's post-merge step and is not performed by this comment.
