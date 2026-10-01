---
type: bug
status: done
id: bug-start-install-ordering
title: start --worktree intermittently ships no usable install (link farm skipped) — five incidents across five sessions
assignee: Arggon
branch: fix/bug-start-install-ordering
parent: story-start-worktree
labels: [worktree, install, dogfood]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
worktree_path: /home/arggon/Projects/ArggonManager-bug-start-install-ordering
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/bug-start-install-ordering.md
  Leaves live only under a story. id is the filename stem: bug-start-install-ordering.
  CLI `arggon create bug start-install-ordering` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# start --worktree intermittently ships no usable install (link farm skipped) — five incidents across five sessions

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Consolidating the incident record — FIVE sessions hit a cold/broken install right after start --worktree, each hand-recovering (npm ci / npm install / manual link farm + lib pre-build):
1. cycle-rotation worker (#506): no npm ci; tsx resolved from a SIBLING worktree.
2. board worker (#510): no install at all; claim commit died at the pre-commit gate.
3. frontmatter worker (#509): start readiness passed while the environment needed hand-install (env note).
4. live-reload worker (#521): no node_modules link farm created; manual npm ci + build.
5. cleanup exit-code worker (#527): no install; start's commit step died with 'tsx: command not found' BEFORE any link farm existed; worker hand-built primary symlinks + @arggondev/lib -> ../../lib + lib pre-build.
PR #517 (merged) added named-source readiness reporting (gateBins) and task-start-gate-strict-mode (in flight) adds opt-in hard-fail — both observe/report, neither fixes the underlying ORDERING: the dependency-prep step intermittently does not run or does not complete before the claim commit needs the gate. This item owns the root fix.

## Acceptance
- [x] Instrument prepareWorktreeDependencies/start to log (bounded) which prep path ran (link farm created / reused / skipped-and-why) and correlate with the five incidents' signatures.
- [x] Identify the race/ordering defect (prep skipped when node_modules partially exists? post-start hook timing? workspace pre-build gated on a stale readiness check?) and fix it so a fresh start --worktree ALWAYS leaves a gate-usable install (or fails start itself with the named cause).
- [x] smoke:native-start-cold extended: N sequential cold starts on fresh fixtures, ALL with gateBins resolving inside the worktree and claim commits passing first try.
- [x] Five incident signatures each covered by a test or documented as fixed-by-the-same-fix.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
SIXTH incident, from the task-cycle-set-canonical worker (PR #528): start --worktree laid no link farm; claim commit skipped with 'tsx: command not found'; worker recovered with a worktree-local npm ci (tracker mutations after that point committed normally). Pattern unchanged across all six: prep intermittently absent exactly when the claim commit first needs the gate.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
SEVENTH incident, from the task-e2e-board-serve-wrapper worker (PR #530): start's claim commit was silently SKIPPED (no error surfaced at claim time) because the worktree had no node_modules; worker hand-built the link farm (primary symlinks, @arggondev/lib repointed, build). New detail vs prior six: the skip was SILENT at claim time — the worker only noticed when the pre-commit failed later. Strengthens the instrumentation acceptance: silent skips must be impossible (report or fail, never skip quietly).

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
EIGHTH incident, from the task-start-gate-strict-mode worker (PR #533, observed pre-merge): own start --worktree claim skipped with 'tsx: command not found'; fresh worktree had NO node_modules despite the primary having a full install — the linkNodeModules step apparently did not fire at all (the #521 flavor recurring post-#517). This is also the flavor strict mode now catches loudly ('missing' source). With the flag armed on this repo as of the strict-mode dogfood commit, any recurrence refuses the claim with the named source instead of silently degrading — treat every such refusal as a live reproduction signal for this item's ordering root-fix.

### 2026-10-01 @Arggon
Root fix shipped on fix/bug-start-install-ordering, PR #551 (draft, not merged). Gates: npm test 2008 passed / lint clean / build clean (incl. plugin type gate) / check:plugin ok (separate regen commit 696e461e) / arggon validate ok:true.

ROOT CAUSE. Not one missing call but the contract shape: every prep step in prepareWorktreeDependencies was best-effort-SILENT (linkNodeModules returned false with no reason; farm/symlink failures degraded quietly; build skips unrecorded), and a start that CREATED the worktree proceeded to a claim commit its gate could not run. Environmental triggers: primary install absent/mid-install at prep time (npm ci deletes node_modules first), farm creation failure, sibling .bin masking on PATH, partial worktree install reused on attach.

FIX. (1) Instrumentation: bounded `steps` log on the kernel receipt (cap 16): link outcome farm-created | symlink-created | farm-failed-symlink-fallback | worktree-install-present | primary-install-missing | failed; per-workspace build decisions (built/entry-exists/no-build-script/install-cannot-consume/build-failed/build-no-entry/flip-failed/errored); gate-bins verdict. CLI --json `prepSteps` (+ stdout note for noteworthy outcomes), native `preparation.steps`. (2) Fresh-worktree install gate on BOTH surfaces before any claim write: a start that created the worktree refuses when any gate bin resolves outside it — named bins + prep log + fix, no flag required; attach keeps report-only (or armed strict), so fix-then-attach stays possible; empty gateBins carve-out unchanged. (3) Never-silent skips: fresh-worktree clean item file at claim-commit time = named error (incident 7); post-start re-link outcome reported (additive `postStartRelink`).

EIGHT-SIGNATURE MAP (acceptance item 4, incl. the three later incidents):
1. #506 sibling-worktree tsx on PATH -> fixed-by-the-same-gate: fresh start now refuses with `resolves only via PATH from <sibling>`; pinned by smoke flavor 1 + plugin test (fresh, flag unset) + CLI fresh-gate tests.
2. #510 no install at all; claim died at gate -> refusal BEFORE the claim with link:primary-install-missing in the log; pinned by CLI fresh-refusal test + plugin refusal test.
3. #509 readiness passed while env needed hand-install -> stale mirrored install with a bin-bearing missing dep now refuses (same receipt names the dep); pinned by cli/src/worktree.test.ts + plugin stale-mirror tests (rewritten to the refusal contract).
4. #521 no link farm on fresh worktree -> link outcome now recorded (farm-created/symlink-created/failed); smoke asserts farm-created + workspace built/flipped on every cold start; failed-link unit test added.
5. #527 commit died tsx-not-found BEFORE any farm -> same refusal-before-claim path; smoke flavor 2 asserts not-attempted + named bin + npm ci fix.
6. #528 no link farm; claim commit skipped tsx-not-found -> same as 2/5 (prep log names the skip); covered by the same smoke + plugin refusal tests.
7. #530 claim commit SILENTLY skipped -> named error on a fresh worktree with an unexpectedly clean item file; pinned by cli/src/start.test.ts 'refuses to skip the claim commit silently' (incident 7).
8. #533 linkNodeModules did not fire despite full primary -> every link decision now observable (primary-install-missing / worktree-install-present / failed), and the fresh gate refuses instead of degrading; strict-armed fresh starts keep the byte-identical strict refusal (CLI test pins the ordering: strict check first).

SMOKE (extended, strict armed in the fixture config — dogfood): 5/5 sequential cold starts on fresh fixtures, each first-try: farm laid, @cold/libx built in the worktree and flipped, gateBins [native-gate-dep: worktree], gate proves the WORKTREE build, claimCommit committed, steps receipt asserted per start, receipts bounded. Attach re-run: steps show worktree-install-present + entry-exists, no duplicate claim.

LOADED-RUN SIGNAL (coordinator note): root-caused to TEST-ORDER dependence in cli/src/headless-ci.test.ts, NOT the install layer — one shared fixture with implicit order assumptions: 'drift gate' committed a clean tree when shuffled first (git commit exit 1, empty stderr, ~30ms) and later failed on a seam regenerated after 'needs no MCP' deleted artifacts; 'needs no MCP' validated a tracker that did not exist yet. Fixed with a fixture factory (recipe test gets a pristine repo) + idempotent bootstrap before state-dependent steps. Evidence: 9 shuffled 3-concurrent rounds after the fix, 8 green; the one residual was a rare unrelated spawned-CLI transient (390+ direct replications of the failing sequences under identical load: 0 failures). Residual class left documented, not chased — see handoff open questions.

### handoff 2026-10-01 @Arggon (session: ses_f0821d67effeikd2SXSwGfpEav) — next: Review PR #551 (behavioral impact statement in body); merge flips via auto-done
- branch: fix/bug-start-install-ordering
- open questions: Rare spawned-CLI exit-1 transient in vitest (doctor/success-stdout) unproven after 390 clean replications; tests assert status without stderr, so a diagnostic follow-up would help
