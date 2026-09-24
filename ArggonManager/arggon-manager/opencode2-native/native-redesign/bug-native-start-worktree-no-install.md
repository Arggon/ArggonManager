---
type: bug
status: in_progress
id: bug-native-start-worktree-no-install
title: tools.arggon.start --worktree skips the claim commit in a fresh worktree (no install prepared)
assignee: Arggon
branch: fix/bug-native-start-worktree-no-install
parent: native-redesign
labels: [opencode-seam, worktree]
priority: p1
created: "2026-09-22"
updated: "2026-09-24"
claimed_at: "2026-09-24T15:36:00.779Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-native-start-worktree-no-install
---

<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-native-start-worktree-no-install.md
  Leaves live only under a story. id is the filename stem: bug-native-start-worktree-no-install.
  CLI `arggon create bug native-start-worktree-no-install` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# tools.arggon.start --worktree skips the claim commit in a fresh worktree (no install prepared)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [x] Native and CLI `start` call one shared kernel-level worktree dependency-preparation/readiness implementation; keep git/domain orchestration in its owning surface and avoid duplicating link/build/workspace-resolution orchestration.
- [x] Native cold start prepares the install/workspace build before the claim commit, returns bounded explicit preparation and claim-commit outcomes, and never reports a required pre-commit/bootstrap/claim-commit failure as unqualified `ok:true`; on failure keep the worktree and return actionable attach/remediation semantics consistent with the CLI.
- [x] Document the native install contract in `ArggonManager/docs/agents.md` orchestration/worktree sections and `ArggonManager/docs/playbooks/opencode.md`; update any native tool contract/schema-budget tests that change.
- [x] Add focused regression coverage for the native path, including dependency-requiring gate / skipped-claim detection or equivalent deterministic integration evidence; keep the separate durable cold-start smoke item out of this PR.
- [x] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, `npm run arggon -- validate`, and focused expected-vs-observed smoke/probe evidence are green.

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6

## Context

Reported by the `task-ui-shared-viewmodel` worker during wave 0 (finding F0):

```
tools.arggon.start({ id, assignee: "Arggon", worktree: true, push: true })
```

created the worktree/branch and pushed, but the claim commit was **skipped** because the fresh worktree had no `node_modules`: the wired pre-commit gate (`npm run --silent arggon -- validate`) failed with `sh: tsx: command not found`. The worker ran `npm ci` and committed the claim manually (`46039d1f`), then continued. The worktree path is `../ArggonManager-task-ui-shared-viewmodel`.

The CLI path (`arggon start --worktree`) prepares the worktree's install before the claim commit (link farm, `linkedNodeModules` in `--json`, `bug-start-worktree-node-modules`); this native-tool run did not leave the worktree able to run the gate, and the failure was silent in the tool result (the claim commit was simply absent).

## Acceptance

- [x] Reproduce on a fresh worktree through the native tool: either the claim commit runs the pre-commit gate without a manual `npm ci` (install prepared like the CLI), or the result reports the skipped claim commit plus the remediation explicitly
- [x] Decide and document the native path's install contract in `ArggonManager/docs/agents.md` §Orchestration and the OpenCode playbook (what `tools.arggon.start` guarantees about the worktree install)
- [x] Regression coverage for the native path (unit or smoke scenario) — a fresh worktree must not silently lose its claim commit
- [x] `npm test`, `npm run check:plugin`, `arggon validate` green on the fix

### 2026-09-23 @ses_f34ba048bffeDqO6XhG0C62Nw6

## Wave 1 occurrences (coordinator, 2026-09-22)

All three wave-1 workers hit this in fresh worktrees; consolidated evidence:

1. `bug-tui-selection-offscreen` (PR #405): claim commit skipped; worker ran `npm ci` and committed the claim manually (`28f1b139`).
2. `task-board-filter-lenses` (PR #406): same; manual claim commit `207ef781`.
3. `task-ui-viewmodel-contract-deps` (PR #404): same; manual claim commit `3b68d6de`.

So the trap is reproducible (3/3) on a cold `node_modules`: `tools.arggon.start({worktree:true})` creates the worktree/branch and pushes, but the wired pre-commit gate cannot run there and the claim commit is silently absent from the result. The CLI path prepares a link farm for exactly this (`linkedNodeModules`); the native tool path either skipped that preparation or did not surface its failure. Consider raising the priority if the native start path stays the default for workers.

### 2026-09-23 @ses_f34ba048bffeDqO6XhG0C62Nw6

## Wave 2 occurrences (coordinator, 2026-09-22)

All three wave-2 workers hit it again in fresh worktrees — 3/3, six total across waves 0–1:

1. `task-board-item-detail` (PR #412): manual claim `a54f4580`.
2. `task-tui-detail-pane` (PR #410): manual claim `6719188a`.
3. `task-native-panel-interaction` (PR #411): manual claim `dfef2442`.

Every occurrence costs a manual `npm ci` + claim commit and the tool result stays silent about the skipped claim. Raising priority to p1: this is the default worker path for every orchestrated item.

### 2026-09-24 @Arggon-coordinator

## Coordinator scope directive — 2026-09-24

The user-approved implementation direction is stronger than the original either/or acceptance: make the native and CLI `start` paths call one shared worktree dependency-preparation/readiness implementation, and make the native result explicitly report preparation and claim-commit outcomes so a failed required gate is never an unqualified `ok:true` success. Update the canonical Acceptance section to include this shared-path requirement before opening the fix PR. Keep the cold-start dependency-gated smoke as a separate dependent item/PR so this bug stays focused.

### 2026-09-24 @ses_f2b1605beffe4ketLzfuVHnIWN

Implementation/evidence ready for coordinator review (PR #419): shared kernel prepareWorktreeDependencies now backs CLI + native; native prepares before explicit claim commit, returns bounded preparation/claim receipts, preserves honest ready=false/missing semantics, and maps required gate/commit failures to START_FAILED with kept worktree + attach retry. Added worktree:false, ignored-path, pre-staged-index, dependency-gate and failed-attempt-retry regressions. Gates: npm test (97 files/1623 tests), npm run lint, npm run build, npm run check:plugin, npm run arggon -- validate, tools.arggon.validate, git diff --check all passed. Standalone cold-start/model smoke intentionally remains the separate item. No findings requiring a new tracker item.

### handoff 2026-09-24 @ses_f2b1605beffe4ketLzfuVHnIWN (session: ses_f2b1605beffe4ketLzfuVHnIWN) — next: Coordinator review PR #419, run the required review smoke, then merge after approval; do not mark done before merge verification.

- branch: fix/bug-native-start-worktree-no-install
- open questions: No open questions; standalone cold-start/model smoke remains the separate dependent item.
