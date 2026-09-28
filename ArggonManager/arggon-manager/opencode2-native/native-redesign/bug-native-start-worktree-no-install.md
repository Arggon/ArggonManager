---
type: bug
status: done
id: bug-native-start-worktree-no-install
title: tools.arggon.start --worktree skips the claim commit in a fresh worktree (no install prepared)
assignee: Arggon
branch: fix/bug-native-start-worktree-no-install
parent: native-redesign
labels: [opencode-seam, worktree]
priority: p1
created: "2026-09-22"
updated: "2026-09-28"
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

### 2026-09-28 @ses_f2af667e6ffehT4bkVx6NvzwID

## PROVISIONAL re-review verdict (coordinator owns final)

Head `30b380837d6436b63ba3518d8974688bdad22b92` — **all five prior blockers are fixed and verified.** Three adjacent receipt/rollback gaps remain, so the recommendation is still **NO-MERGE** pending one more short fix round.

### Prior blockers — re-verified fixed

1. **`worktree:false` branch ownership (was High).** Generated-bundle probe: first start creates the branch, current branch == reported branch, the item records `branch`, the claim commit lands on that branch, `pushed:true` and the remote ref exists; the attach re-run is `branchCreated:false`, `claimCommit.status:"not-needed"`, no duplicate commit, `pushed:false`.
2. **Link-farm rollback + observed removal (was High).** With a link farm prepared and both domain and git removal failing: `rollback {preparationRemoved:true, worktreeRemoved:false, branchDeleted:false}`, message `rollback incomplete: …`, no "removed again", branch kept, primary install and sibling worktree untouched. When the domain resolves without removing, the git fallback removes and the branch is deleted.
3. **Pathspec / absolute / cross-root (was Medium).** `:(glob)**` → `pathspec magic is not allowed`; absolute outside root → `mutated path escapes repository root`; absolute inside root commits only that file. Wildcard/bracket ignored filenames are partitioned correctly. Cascade/ignored/exotic/contention suites green.
4. **Consistent early receipts (was Medium).** id/root/lookup/assignee/branch-conflict/checked-out-elsewhere/preflight/stale/foreign/refusal all carry bounded `claimCommitted:false` + `not-attempted`.
5. **Docs + fixtures.** `docs/opencode2.md` now documents preparation/claimCommitted/claimCommit/rollback and branch-only semantics. Fixtures use a tracked unique parent, set `maintenance.auto=false`, and tear down the whole parent: a focused `tools.test.ts` run created **0** leftover fixtures and GIT_TRACE2 recorded **0** detached maintenance children.

### Remaining findings (severity order)

1. **High — plain-start preflight race mutates the claim, then the branch switch fails, and the receipt still says `not-attempted` with no rollback/leftover disclosure.** `nativeStart` runs the claim `updateOperation` **before** `ensureWorktreeBranch`, so `preflightPlainBranch` (which runs before the update) cannot see the conflict the update itself creates. Repro: item with recorded branch `feat/p-task`; that branch carries a divergent edit to the item file; canonical clean on `master`. Preflight passes → claim writes `status: in_progress`/`assignee` into the working tree (dirties the item) → `git switch` fails (`local changes would be overwritten`) → envelope `claimCommitted:false`, `claimCommit.status:"not-attempted"`, `reason:"branch setup failed"`, **no `rollback`**, while the item is left **claimed and dirty** (`status: in_progress`, `assignee: s`). The receipt implies nothing changed but the tracker item is mutated and uncommitted — exactly the "no false 'nothing mutated'" gap. Fix: switch/attach the branch before the claim update, or detect switchability in preflight, or on a post-update branch failure roll back / report the mutated dirty claim explicitly.
2. **Medium — `guarded` reports `not-attempted` for any unexpected throw, even after the claim commit already landed.** Repro (kernel whose `successEnvelope` throws, reached only on the success path after `commitNativeClaim`): envelope `claimCommitted:false`, `claimCommit.status:"not-attempted"`, `reason:"unexpected start failure"`, and no `preparation`/`worktreePath`/`rollback` keys — yet the worktree HEAD is `chore(tasks): claimed task-p-task` on `feat/task-p-task` and the item is claimed. The last-observed commit state must be carried into the guarded failure (e.g. a `claimCommitted` flag in a closure, or re-derive from git) instead of a blanket not-attempted.
3. **Medium — native `cleanup` prune trusts the domain `remove` and can report `removed worktree` while the worktree remains, then clear `worktree_path`.** `removeWorktree` (the cleanup path, distinct from the hardened `discardWorktree`) does `await domain.remove(...); return;` with no verification and no git fallback. Repro (domain `remove` resolves without removing): `pruned` contains `{action:"removed worktree <path>"}` and `{action:"failed", leftoverBranch:"feat/…"}`, `failures:[]`, the worktree and branch remain on disk, and the item's `worktree_path` is cleared. Apply the same existsSync/`isRegisteredWorktree`-then-git-fallback verification used by the start rollback, and only delete the branch / clear the record once removal is observed; otherwise record a `failed` action + `failures[]` entry. (Cleanup unlink ownership itself is correct: a foreign `node_modules` symlink is left alone.)

### Verified green

- Full focused + full suite: **97 files / 1,630 tests**; `npm run lint`, `npm run arggon -- validate --json`, `npm run check:plugin`, `git diff --check`, `npm run context:report -- --strict` (native catalog 11,821 B ≤ 12,288 B). Generated bundle clean. Review worktree clean.
- Preflight status parsing verified directly: rename blocked, quoted untracked tracker file blocked, untracked outside tracker allowed, modified tracked blocked — item left untouched with `not-attempted`.
- Bounded receipts/messages hold on the new rollback and not-attempted paths (500-char rollback error, 2048-char error, 32×200 name caps).

**Recommendation: NO-MERGE pending findings 1–3; re-review after the fix round.** (Non-blocking nit: the vendored plugin file otherwise omits semicolons; the remediation added a few — cosmetic only, lint is green.)

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

### handoff 2026-09-28 @ses_f2b1605beffe4ketLzfuVHnIWN (session: ses_f2b1605beffe4ketLzfuVHnIWN) — next: Coordinator: re-review PR #419 (body updated) for the plain-start ordering + post-claim receipt fixes, run the required review smoke, then merge normally and verify.

- branch: fix/bug-native-start-worktree-no-install
- open questions: Standalone cold-start/model smoke remains in task-native-start-cold-smoke; native cleanup finding is bug-native-cleanup-unverified-worktree-removal (untouched here).

### 2026-09-28 @ses_f2af667e6ffehT4bkVx6NvzwID

## PROVISIONAL final re-review verdict (coordinator owns final)

Head `038495550300047439b9d0009e55a58f27b1fa5f` — **PASS on the code as reviewed.** Both remaining in-scope findings are fixed and verified with fresh adversarial probes; the out-of-scope cleanup finding is correctly filed as `bug-native-cleanup-unverified-worktree-removal` (depends on this P1) and its source is unchanged from the prior reviewed head.

### Fixes verified (fresh probes)

- **Plain start settles branch ownership before the claim mutation.** A divergent recorded branch now switches first and commits on the branch (current == reported branch, clean tree). A genuine post-preflight switch failure (untracked file that checkout would overwrite) returns `claimCommitted:false` / `not-attempted` / `"the item was not modified"`, the item is **byte-identical and unclaimed**, and the checkout is unchanged. A claim refusal after this run created a branch rolls back **only that branch**, leaves it first, restores the prior checkout (`rollback {branchDeleted:true, restoredBranch:"master"}`), reports the observed state, and leaves the item byte-identical with a clean tree. Attach/re-run (worktree and plain) still report `not-needed` with no duplicate branch or commit.
- **Unexpected throws after a landed claim commit are truthful.** A throw on the response path now reports `claimCommitted:true`, `claimCommit.status:"committed"` with the **real hash**, and a message stating the commit already landed. A pre-commit gate failure still reports `claimCommitted:false` / `failed` with the worktree kept.
- **Bounded payload/schema hold:** native catalog 11,821 B <= 12,288 B; all new receipts/messages/rollback errors bounded.

### Prior P1 findings still fixed (re-confirmed)

worktree:false branch ownership/push; link-farm rollback with observed removal (incl. domain+git failure and lying-domain fallback); pathspec magic / absolute / cross-root rejection with literal staging; consistent bounded early `not-attempted` receipts; `opencode2.md` payload contract; fixtures use a tracked unique parent with `maintenance.auto=false` and leave no artifacts (a focused `tools.test.ts` run on this head created **0** leftover fixtures, GIT_TRACE2 recorded **0** maintenance children). `lib/` and `cli/` are untouched in this delta; native cleanup/prune source is unchanged.

### Docs / acceptance / scope

Docs (agents.md, playbooks/opencode.md, opencode2.md) match the implemented ordering, owned-branch rollback and post-claim receipt semantics. Original item acceptance and the follow-up `task-harden-native-start-rollback-and-pathspec-handling` are honest and ticked only after the new evidence. No GitHub comment/review on the PR; diff stays in scope; the cleanup follow-up is a separate item.

### Gates (re-run on this head)

`npm test` 97 files / 1,633 tests; `npm run lint`; `npm run build`; `npm run check:plugin` (bundle regenerated, no drift); `npm run arggon -- validate --json`; `git diff --check`; `npm run context:report -- --strict` — all green. Review worktree clean.

**Recommendation: PASS on code. The open merge conflict is an integration step, not a code defect.** Required before merge: (1) merge current `main` (tracker review comments + the new cleanup bug) into the branch, resolving the tracker files; (2) re-run `npm run build:plugin` / `check:plugin` and confirm no bundle drift; (3) re-run `npm test`, lint, validate, and re-validate both tracker items; (4) rebase/merge normally (no squash) per the tracker-hygiene merge rule; (5) confirm CI is green on the merged head before marking the P1 and the follow-up done.

### 2026-09-28 @Arggon-coordinator

## FINAL REVIEW VERDICT — APPROVE

Final in-scope review of PR #419: **APPROVE**.

**Provisional findings resolved.** Plain-start branch ownership is settled before the claim mutation, with truthful owned-branch rollback; landed claim commits survive late/unexpected failures as committed; worktree dependency preparation, bounded receipts, link-farm rollback, literal path handling, docs, and fixture hygiene were independently re-verified.

**Engineering review bar: pass** across architecture/boundaries, conventions, quality/security/scalability, scope, tests, docs, and acceptance honesty.

**Gates run in the final in-scope review:** full test / lint / build / check:plugin / validate / context-strict, plus the schema budget (11,821 B ≤ 12,288 B).

**Scope boundary held.** The separate native cleanup defect is correctly tracked as `bug-native-cleanup-unverified-worktree-removal` and is not absorbed into this PR.

**Post-merge integration:** preserved all tracker history and changed no code beyond the reviewed head.

This verdict records approval only. The item remains `in_progress`; merging and completion remain the coordinator's post-merge steps and are not performed by this comment.
