---
type: bug
status: todo
id: bug-native-start-worktree-no-install
title: tools.arggon.start --worktree skips the claim commit in a fresh worktree (no install prepared)
parent: native-redesign
labels: [opencode-seam, worktree]
priority: p1
created: "2026-09-22"
updated: "2026-09-23"
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

- [ ] 

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

- [ ] Reproduce on a fresh worktree through the native tool: either the claim commit runs the pre-commit gate without a manual `npm ci` (install prepared like the CLI), or the result reports the skipped claim commit plus the remediation explicitly
- [ ] Decide and document the native path's install contract in `ArggonManager/docs/agents.md` §Orchestration and the OpenCode playbook (what `tools.arggon.start` guarantees about the worktree install)
- [ ] Regression coverage for the native path (unit or smoke scenario) — a fresh worktree must not silently lose its claim commit
- [ ] `npm test`, `npm run check:plugin`, `arggon validate` green on the fix

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
