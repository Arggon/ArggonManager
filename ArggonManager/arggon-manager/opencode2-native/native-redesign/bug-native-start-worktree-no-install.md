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

### 2026-09-24 @ses_f2b1605beffe4ketLzfuVHnIWN
## Review-fix evidence — 2026-09-24

Pushed `d6ac9afc` for PR #419. The provisional NO-MERGE findings are addressed: `worktree:false` now preflights and creates/attaches the item branch before the explicit claim commit, records truthful current/ref/branch/push state, and has real first-start plus no-duplicate attach assertions. Claim-refusal cleanup now unlinks only an owned symlink/link farm before observed worktree/branch removal; primary-install, sibling-worktree, and domain-removal-failure regressions pass. `commitTrackerMutation` now rejects pathspec magic/cross-root results, uses literal pathspecs for add/commit/status, and exact-output matching for `check-ignore`; cascade/ignored/exotic/concurrency behavior remains green. Native pre-commit failures consistently carry bounded not-attempted claim receipts, and `opencode2.md` documents preparation/rollback receipts.

Green gates: `npm test` (97 files / 1,630 tests), `npm run lint`, `npm run build`, `npm run check:plugin`, `npm run context:report -- --strict` (native catalog 11,821 B <= 12,288 B), `npm run arggon -- validate`, `tools.arggon.validate`, and `git diff --check`. Reviewer-focused cases passed (7 native/pathspec + 3 CLI edge); native tools repeated 3x with no fixture leftovers. Linux cannot exercise Windows cross-drive/junction behavior; that platform limitation is documented in the PR update. Standalone cold-start/model smoke remains in `task-native-start-cold-smoke`. Item intentionally remains in_progress for coordinator review/merge; no merge or completion was performed.

### handoff 2026-09-24 @ses_f2b1605beffe4ketLzfuVHnIWN (session: ses_f2b1605beffe4ketLzfuVHnIWN) — next: Coordinator: review pushed PR #419, run the required review smoke, merge normally, verify merge, then complete the original and follow-up items.
- branch: fix/bug-native-start-worktree-no-install
- open questions: Standalone cold-start/model smoke remains in task-native-start-cold-smoke; Windows drive/junction paths were not executable on this Linux host.

### 2026-09-28 @ses_f2b1605beffe4ketLzfuVHnIWN
## Re-review round 2 evidence — 2026-09-28

Two in-scope gaps closed in `ea530234`; native `cleanup` deliberately untouched (finding 3 is `bug-native-cleanup-unverified-worktree-removal`, parent `native-redesign`, depends on this P1).

1. **Plain-start ordering.** Branch ownership is now settled (ownership preflight → create/attach/switch) BEFORE the claim mutation, so a failed switch leaves the item byte-identical and unclaimed instead of claimed-and-dirty. If the claim update is refused after this run created a branch, the rollback leaves that branch first (`git switch <previous>` / `--detach`), deletes only the owned branch, and reports the observed receipt (`rollback { branchDeleted, restoredBranch }`; `null` when no branch was owned).
2. **Truthful unexpected failures.** `nativeStart` now records a `NativeStartProgress` (stage, preparation, branch/worktree flags, claim receipt, push) and wraps every post-resolution phase. An unexpected throw reports the state observed so far, so a claim commit that already landed stays `claimCommitted: true` with its committed status/hash; only pre-commit failures carry `not-attempted`. `guarded`'s start catch now provably only covers pre-body throws, and a literal-envelope fallback exists if even the failure path throws.

Reproducer evidence (3 new regressions, all green):
- divergent recorded branch whose switch fails → item file byte-identical, still `todo`/unassigned, checkout unmoved, branch intact, `claimCommit.status: "not-attempted"`.
- claim refused after this run created the branch → `rollback { branchDeleted: true, restoredBranch: <base> }`, owned branch deleted, checkout restored, existing owner claim intact.
- `successEnvelope` throwing after a real claim commit → `claimCommitted: true`, `claimCommit.status: "committed"`, hash equal to `git rev-parse --short HEAD`.

Gates: `npm test` 97 files / 1,633 tests; `npm run lint`; `npm run build`; `npm run check:plugin`; `npm run context:report -- --strict` (native catalog 11,821 B ≤ 12,288 B); `npm run arggon -- validate`; `tools.arggon.validate`; `git diff --check`; focused repro set 8 native + 5 tracker-commit; no fixture leftovers. Acceptance line 2 was un-ticked before the fix and re-ticked only after this evidence. PR body updated (no comment posted); draft, unmerged, item stays in_progress.
