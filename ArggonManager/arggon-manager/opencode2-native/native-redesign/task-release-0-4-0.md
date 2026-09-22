---
type: task
status: in_progress
id: task-release-0-4-0
title: "Release 0.4.0: kernel-first publish + tag"
assignee: Arggon
branch: feat/task-release-0-4-0
parent: native-redesign
labels: []
priority: p1
created: "2026-09-21"
updated: "2026-09-22"
claimed_at: "2026-09-22T02:01:58.584Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-release-0-4-0
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-release-0-4-0.md
  Leaves live only under a story. id is the filename stem: task-release-0-4-0.
  CLI `arggon create task release-0-4-0` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Release 0.4.0: kernel-first publish + tag

## Context

Prepared by W7 (`task-native-dogfood-release`): the release runbook
(`ArggonManager/docs/runbooks/release.md`) and the CHANGELOG `[Unreleased]`
section are ready. Publishing/tagging is a **product-owner decision** — this
item is blocked on it.

Steps (from the runbook):

1. Bump `0.3.0` → `0.4.0`; rename `[Unreleased]` → `## 0.4.0 (date)`.
2. Remove `private: true` from `package.json` and `lib/package.json`.
3. Merge `opencode2` → `main`; `git tag v0.4.0 && git push origin v0.4.0`.
4. `npm publish --workspace @arggon/lib`, then `npm publish` (kernel first).
5. Verify with `npm view` + a clean global install.
6. Follow-up: pin `ARGGON_REF: v0.4.0` in the workflow template, re-run `init`,
   move README/`ci.md` to the one-liner install.

## Acceptance

- [ ] Product-owner approval recorded.
- [ ] Version bump + `private` removed merged to `main`.
- [ ] `v0.4.0` tag pushed; both packages published and verified.
- [ ] Workflow template pinned to `v0.4.0`; `init` re-run; docs updated.

## Notes

- Blocked on the PO release decision (2026-09-21).

### 2026-09-22 @Arggon
Release prep evidence: bump 0.3.0→0.4.0 (root+lib), private off, kernel dep range ^0.3.0→^0.4.0 (without it the packed-install suite fails E404 and skips 6 tests), CHANGELOG [0.4.0] - 2026-09-22. Review F1-F3 applied: lock synced, lib publishConfig {access: public} + license MIT + LICENSE in the tarball (79 files/124.3 kB). Gates 1498 tests, build, check:plugin, validate, spec validate. Pending (owner gate): merge opencode2→main, tag v0.4.0, npm publish kernel-first — blocked on the @arggon npm scope (account arggondev; org must be created or an alternative chosen).

### handoff 2026-09-22 @Arggon — next: After the @arggon scope exists: merge opencode2 to main, tag v0.4.0, npm publish --workspace @arggon/lib then npm publish; then pin ARGGON_REF v0.4.0 and re-run init.
- branch: feat/task-release-0-4-0
