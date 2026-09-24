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

- [ ] `worktree:false` creates or attaches the item branch before committing, reports the real current/ref/branch state, commits on that branch, and pushes when requested or already eligible; attach/re-run creates no duplicate branch or commit, with a fail-before-mutation fallback when ownership cannot be guaranteed.
- [ ] Claim-refusal rollback removes only a start-owned symlink/link farm through the kernel ownership helper before worktree removal, observes removal/branch cleanup, and never reports “removed again” when either remains; primary-install and sibling-worktree safety regressions pass, including domain-removal failure.
- [ ] `commitTrackerMutation` rejects pathspec magic and unsupported absolute/cross-root paths, uses literal pathspecs for add/commit/check-ignore, commits only requested files, and preserves multi-file, cascade, ignored-path, and contention behavior.
- [ ] Native-start early/foreign/stale/branch/refusal failures carry consistent bounded `claimCommitted`/`claimCommit` receipts and preparation data where known; no failure is an unqualified success.
- [ ] `ArggonManager/docs/opencode2.md` is minimally updated for the native payload contract, with agents/OpenCode playbook wording matching behavior; no unrelated retired-branch docs sweep.
- [ ] Native fixtures use a tracked unique parent, disable `maintenance.auto=false` before commits, clean the full parent on teardown, and repeated focused tests leave no `/tmp` or worktree artifacts.
- [ ] Reviewer repro cases, dependency-gate/failed-retry/rollback evidence, full `npm test`, lint, build, check:plugin, validate, strict context report, schema budget, and `git diff --check` are green; unresolved platform limitations are documented.

## Notes

Review context: PR #419 provisional NO-MERGE review, 2026-09-24. This item is intentionally separate tracker bookkeeping for the blocking findings; the original P1 item remains the implementation record.
