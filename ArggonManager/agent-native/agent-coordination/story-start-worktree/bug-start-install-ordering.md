---
type: bug
status: done
id: bug-start-install-ordering
title: start --worktree intermittently ships no usable install (link farm skipped) — five incidents across five sessions
assignee: Arggon
parent: story-start-worktree
labels: [worktree, install, dogfood]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
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
- [x] Instrument prepareWorktreeDependencies/start to log (bounded) which prep path ran (link farm created / reused / skipped-and-why) and correlate with the five incidents' signatures. (2026-10-01: bounded `steps` receipt on the kernel + CLI `prepSteps` + native `preparation.steps`; all EIGHT consolidated incidents mapped on the item thread.)
- [x] Identify the race/ordering defect (prep skipped when node_modules partially exists? post-start hook timing? workspace pre-build gated on a stale readiness check?) and fix it so a fresh start --worktree ALWAYS leaves a gate-usable install (or fails start itself with the named cause). (2026-10-01: the defect was the best-effort-SILENT prep contract — PR #551's fresh-worktree install gate refuses before the claim write, naming bins + prep log + remediation, on both surfaces.)
- [x] smoke:native-start-cold extended: N sequential cold starts on fresh fixtures, ALL with gateBins resolving inside the worktree and claim commits passing first try. (2026-10-01: 5 sequential cold starts, strict armed, first-try claims, steps receipts asserted; coordinator re-ran green.)
- [x] Five incident signatures each covered by a test or documented as fixed-by-the-same-fix. (2026-10-01: extended to the real eight — mapping on the item thread, each a named test or fixed-by-the-gate; reviewer-verified.)

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
SIXTH incident, from the task-cycle-set-canonical worker (PR #528): start --worktree laid no link farm; claim commit skipped with 'tsx: command not found'; worker recovered with a worktree-local npm ci (tracker mutations after that point committed normally). Pattern unchanged across all six: prep intermittently absent exactly when the claim commit first needs the gate.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
SEVENTH incident, from the task-e2e-board-serve-wrapper worker (PR #530): start's claim commit was silently SKIPPED (no error surfaced at claim time) because the worktree had no node_modules; worker hand-built the link farm (primary symlinks, @arggondev/lib repointed, build). New detail vs prior six: the skip was SILENT at claim time — the worker only noticed when the pre-commit failed later. Strengthens the instrumentation acceptance: silent skips must be impossible (report or fail, never skip quietly).

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
EIGHTH incident, from the task-start-gate-strict-mode worker (PR #533, observed pre-merge): own start --worktree claim skipped with 'tsx: command not found'; fresh worktree had NO node_modules despite the primary having a full install — the linkNodeModules step apparently did not fire at all (the #521 flavor recurring post-#517). This is also the flavor strict mode now catches loudly ('missing' source). With the flag armed on this repo as of the strict-mode dogfood commit, any recurrence refuses the claim with the named source instead of silently degrading — treat every such refusal as a live reproduction signal for this item's ordering root-fix.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
verdict: request-changes (ONE blocking item: the convention.md contract sentence — everything else passes)
- BLOCKING: ArggonManager/docs/convention.md:481 still states unqualified that unset/`false` strict-gate-bins keeps "the claim commit remains authoritative" — now FALSE for start runs that CREATE the worktree (the fresh install gate refuses before any claim write, no flag required). Per engineering.md's no-silent-fork rule this doc must move in-PR. Fix: qualify the sentence with the attach-vs-created distinction + add the fresh-gate bullet beside the strict-gate one; check the §x-worktree start guidance (~L518) mentions it too.
- Everything else PASSES: scope exact (16 files, headless-ci resolved to main's #546 version, bundle regen isolated), bounds discipline (MAX_PREP_STEPS=16 + native re-bounding), the 8-incident signature map verified against named tests, smoke 5/5 sequential cold starts with the flag armed, strict-ordering pin, default-attach #533 suite untouched.
- Contract opinion ENDORSED: the unconditional fresh-start gate binds only the run that CREATED the worktree (where the tool vouches for what it just built); attach keeps report-only/strict — strict mode remains the clean attach-run escalation, and the honest-receipt default survives where it is honest (attach). The eight incidents were receipts arriving after the worker was stranded.
- Fix the doc in-PR, push, and I merge on green CI. Nit (non-blocking): the item TITLE still says "five incidents" — now eight; leave or amend, thread carries the truth.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Final verdict: approve — the convention.md contract sentence reconciled in-PR (attach-vs-created distinction + the fresh-gate bullet at :482; x-worktree guidance + postStartRelink outcome documented; no other 'claim commit authoritative' phrasing left unqualified).
Merged: PR #551 squash -> main (CI green on the reconciled head; smoke 5/5 sequential cold starts with strict armed re-verified by the coordinator).
Resolution summary for the eight consolidated incidents: the fresh-worktree install gate (default, both surfaces) refuses any created-worktree start whose gate bins resolve outside it — naming bins, the bounded prep log, and the npm ci remediation — before any claim write; never-silent skips (incident 7's flavor) are named errors; attach keeps the honest-receipt/strict semantics so fix-then-attach survives; all eight signatures mapped to named tests or fixed-by-the-gate; the armed strict-gate-bins flag on this repo now escalates attach runs.
Item done.
