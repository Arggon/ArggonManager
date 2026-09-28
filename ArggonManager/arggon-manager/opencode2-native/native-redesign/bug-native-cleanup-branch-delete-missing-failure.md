---
type: bug
status: todo
id: bug-native-cleanup-branch-delete-missing-failure
title: "Native cleanup branch-delete failure is reported in pruned but omitted from failures[]"
parent: native-redesign
labels: [opencode-seam, worktree, review-followup]
priority: p3
created: "2026-09-28"
updated: "2026-09-28"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-native-cleanup-branch-delete-missing-failure.md
  Leaves live only under a story. id is the filename stem: bug-native-cleanup-branch-delete-missing-failure.
  CLI `arggon create bug native-cleanup-branch-delete-missing-failure` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native cleanup branch-delete failure is reported in pruned but omitted from failures[]

## Context

PR #421 review verified a pre-existing native cleanup inconsistency: when worktree removal succeeds (or the recorded path is already missing) but branch deletion fails, `nativeCleanup` appends `pruned: [{ id, action: "failed", error, leftoverBranch }]` and may still clear/commit the record, yet it does not append the corresponding `<id>: <error>` entry to `failures[]`. The documented contract says per-item prune failures appear in both `pruned` and `failures`, and the CLI path does so. This predates PR #421 and is not absorbed into that scoped PR.

## Acceptance

- [ ] Every native branch-delete failure appends a bounded `<id>: <error>` entry to `failures[]` as well as the structured `pruned` failure.
- [ ] Per-candidate continuation and the existing record-clearing semantics after an observed worktree removal remain unchanged.
- [ ] Add a deterministic test for `git branch -d/-D` failure with no domain dependency.
- [ ] Update the json-output contract only if needed to make the two failure surfaces explicit.
- [ ] Full test, lint, build, `check:plugin`, and validate remain green.

## Notes

Review finding S7 on PR #421, 2026-09-28; verified byte-identical at `origin/main` before the PR.
