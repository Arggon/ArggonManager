---
type: bug
status: in_progress
id: bug-native-cleanup-unverified-worktree-removal
title: "Native cleanup prune can report a worktree removed while the worktree, branch, and worktree_path record remain"
assignee: Arggon
branch: fix/bug-native-cleanup-unverified-worktree-removal
parent: native-redesign
labels: [opencode-seam, worktree, review-followup]
priority: p1
created: "2026-09-28"
updated: "2026-09-28"
claimed_at: "2026-09-28T20:07:44.061Z"
depends_on: [bug-native-start-worktree-no-install]
worktree_path: /home/arggon/Projects/ArggonManager-bug-native-cleanup-unverified-worktree-removal
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-native-cleanup-unverified-worktree-removal.md
  Leaves live only under a story. id is the filename stem: bug-native-cleanup-unverified-worktree-removal.
  CLI `arggon create bug native-cleanup-unverified-worktree-removal` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native cleanup prune can report a worktree removed while the worktree, branch, and worktree_path record remain

## Context

Lead-architect re-review of [PR #419](https://github.com/Arggon/ArggonManager/pull/419) on 2026-09-28 found that native `tools.arggon.cleanup({ prune: true })` trusts a successful `ctx.worktree.remove` call without observing the result. A domain that resolves while leaving the worktree in place produces `pruned: [{ action: "removed worktree <path>" }, { action: "failed", leftoverBranch }, { action: "cleared worktree_path" }]` with no top-level failure: the worktree and branch still exist but the canonical record is cleared, so the state becomes unrecoverable through the normal cleanup path.

This is a pre-existing native cleanup defect, not part of the P1 start-readiness change. It is tracked separately so PR #419 stays scoped; the fix depends on that P1 merge to avoid concurrent edits to the vendored plugin.

## Acceptance

- [ ] Verify worktree removal physically and through `git worktree list` after the domain call; fall back to a literal `git worktree remove --force` when the domain resolves without removing it.
- [ ] Never emit `removed worktree`, delete a branch, or clear `worktree_path` unless removal is observably complete.
- [ ] A failed removal reports a bounded per-candidate failure with the remaining path and `leftoverBranch`, preserves the record, and keeps the rest of the cleanup run honest.
- [ ] Reuse one shared removal/observation implementation with native start rollback; do not duplicate the rules.
- [ ] Add deterministic tests for a lying/failing domain, git fallback success, both domain+git failure, foreign `node_modules` ownership, and record/branch preservation.
- [ ] Update the native cleanup payload contract and `npm test`, lint, build, `check:plugin`, validate, and review smoke are green.

## Notes

Review verdict: PR #419 re-review, 2026-09-28, finding 3.
