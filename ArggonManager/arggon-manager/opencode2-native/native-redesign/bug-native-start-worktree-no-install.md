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

### 2026-09-24 @ses_f2af667e6ffehT4bkVx6NvzwID
## PROVISIONAL reviewer verdict — coordinator to record final

**Recommendation: NO-MERGE / return to worker.** PR #419 head `343586a4a09905bf317ccc17116dd60f3ad3039b` is green, but the P1 contract is not yet sound.

### Findings (severity order)

1. **High — `worktree:false` reports a feature branch that does not own the claim commit.** `opencode/plugins/arggon/index.ts:2428-2504` only ensures/switches a branch inside `wantWorktree`; `2538-2548` then writes/commits in `options.cwd`, and `2611-2613` only pushes when a worktree exists. The new test at `opencode/plugins/arggon/tools.test.ts:865-912` starts from the fixture's current branch but never asserts branch ownership. Real generated-plugin probe: expected `feat/task-false-task`, observed current branch `master`, `branchCreated:false`, no feature ref, claim commit on `master`, `pushed:false`. Either validate that the current branch is the recorded branch, or create/switch it explicitly; the test must assert HEAD/ref ownership (and define push behavior).

2. **High — claim-refusal rollback does not unlink the newly prepared install before domain/git removal and can falsely say it was removed.** Preparation runs at `index.ts:2506-2511`; update refusal calls `discardWorktree` at `2559-2569`. That helper (`2295-2313`) never calls the existing ownership-safe `unlinkNodeModulesLink` and ignores the fallback git removal code. Real workspace-link probe: the domain observed a real link-farm `node_modules` at remove time. With domain removal failing, worktree + feature branch remained while the typed error still said “the worktree created by this run was removed again.” Unlink only a start-owned link/farm first, make removal return a checked outcome, and report leftovers honestly; add the primary-install rollback case (current test at `tools.test.ts:1036-1073` has no install).

3. **Medium — the new root guard is not sound for Git pathspec-magic path shapes.** `lib/src/tracker-commit.ts:298-306` rejects only lexical `..` prefixes, while `351`/`366` pass the normalized string to `git add`/`git commit --only`. The file already acknowledges `:(…)` magic at `207-224`. Probe: with dirty `target.md` + unrelated `other.md`, `commitTrackerMutation(root, [":(glob)**"], ...)` returned committed and `git show` contained **both** files, leaving a clean tree. Use literal pathspecs (and reject absolute/cross-drive normalized results on Windows), with a regression test.

4. **Medium — the claim/preparation receipt contract is partial and its canonical payload table is stale.** Early failures (for example foreign worktree at `index.ts:2454-2463`) return only the base error envelope—no `claimCommitted:false` / `claimCommit.status:"not-attempted"`—although `agents.md:157-168` promises an explicit outcome. Probe keys were only `ok/schemaVersion/conventionVersion/command/error`. Separately, `ArggonManager/docs/opencode2.md:97-104` still says it is the payload contract and omits `preparation`, `claimCommitted`, and `claimCommit`. Return not-attempted consistently after a valid id and update the table/semantics.

5. **Medium — new real-git coverage reintroduces the repository's known teardown hazards.** The added `lib/src/tracker-commit.test.ts:24-40` uses raw `git init` and bare `rmSync`; GIT_TRACE2 proved the focused run spawned four `git maintenance run --auto --detach` children. Its `67-80` also writes/deletes shared `/tmp/outside.md`; a sentinel placed there was deleted by the test. The expanded `opencode/plugins/arggon/tools.test.ts:91-99,704-713,944-1034` still registers only primary fixture dirs, not sibling worktrees; after one full suite, 48 orphaned `/tmp/arggon-w4-*-task-*` dirs remained. This is exactly the failure mode documented and fixed in `cli/src/test-tmp.ts:1-31`. Reuse/equivalent settling cleanup, disable auto-maintenance before first commit, and make every fixture root/sibling unique and tracked.

### Verified

- Full diff at base `d2e595d2` reviewed; scope is item-related, no runtime dependency, no project files changed by review.
- `npm test`: 97 files / 1,623 tests passed; `npm run lint`, `npm run arggon -- validate --json`, `npm run check:plugin`, `git diff --check`, and `npm run context:report -- --strict` passed (native catalog 11,821 B <= 12,288 B; generated bundle clean).
- GitHub checks `cli`, `tasks-validate`, and `ui-smoke` all passed.
- Deterministic generated-bundle/native-tool smoke passed: dependency-gated cold start committed only the item and ran the real hook; attach returned `not-needed` with no duplicate commit; failed gate returned typed `START_FAILED`, kept worktree/branch, then committed on attach retry; primary install stayed intact. Separate push probe preserved the claim and succeeded on attach retry.
- `git commit --only` preserved unrelated staged work; full multi-file/cascade/ignored/concurrency coverage passed.

### Not verified

- No 20-cold-start/model-driven OpenCode pilot; the repository explicitly defers that to dependent `task-native-start-cold-smoke`.
- No Windows/macOS runtime validation; the pathspec finding reproduces on Linux, and the cross-drive guard was reviewed statically only.

**NO-MERGE pending fixes and re-review.**

### 2026-09-24 @ses_f2af667e6ffehT4bkVx6NvzwID
### Evidence correction to provisional finding 5

The count **48 orphaned `arggon-w4-*` sibling directories was cumulative across the review’s repeated focused/full executions**, not the output of one isolated full-suite run. The source-level finding is unchanged: `tools.test.ts` registers primary fixture directories but not the sibling worktrees those tests create, and the runs left orphaned siblings. The GIT_TRACE2 maintenance-child evidence and the `/tmp/outside.md` sentinel deletion each came from one isolated focused execution.
