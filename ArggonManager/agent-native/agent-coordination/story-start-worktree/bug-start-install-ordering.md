---
type: bug
status: in_progress
id: bug-start-install-ordering
title: start --worktree intermittently ships no usable install (link farm skipped) — five incidents across five sessions
assignee: Arggon
branch: fix/bug-start-install-ordering
parent: story-start-worktree
labels: [worktree, install, dogfood]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T14:29:29.361Z"
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
- [ ] Instrument prepareWorktreeDependencies/start to log (bounded) which prep path ran (link farm created / reused / skipped-and-why) and correlate with the five incidents' signatures.
- [ ] Identify the race/ordering defect (prep skipped when node_modules partially exists? post-start hook timing? workspace pre-build gated on a stale readiness check?) and fix it so a fresh start --worktree ALWAYS leaves a gate-usable install (or fails start itself with the named cause).
- [ ] smoke:native-start-cold extended: N sequential cold starts on fresh fixtures, ALL with gateBins resolving inside the worktree and claim commits passing first try.
- [ ] Five incident signatures each covered by a test or documented as fixed-by-the-same-fix.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
SIXTH incident, from the task-cycle-set-canonical worker (PR #528): start --worktree laid no link farm; claim commit skipped with 'tsx: command not found'; worker recovered with a worktree-local npm ci (tracker mutations after that point committed normally). Pattern unchanged across all six: prep intermittently absent exactly when the claim commit first needs the gate.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
SEVENTH incident, from the task-e2e-board-serve-wrapper worker (PR #530): start's claim commit was silently SKIPPED (no error surfaced at claim time) because the worktree had no node_modules; worker hand-built the link farm (primary symlinks, @arggondev/lib repointed, build). New detail vs prior six: the skip was SILENT at claim time — the worker only noticed when the pre-commit failed later. Strengthens the instrumentation acceptance: silent skips must be impossible (report or fail, never skip quietly).

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
EIGHTH incident, from the task-start-gate-strict-mode worker (PR #533, observed pre-merge): own start --worktree claim skipped with 'tsx: command not found'; fresh worktree had NO node_modules despite the primary having a full install — the linkNodeModules step apparently did not fire at all (the #521 flavor recurring post-#517). This is also the flavor strict mode now catches loudly ('missing' source). With the flag armed on this repo as of the strict-mode dogfood commit, any recurrence refuses the claim with the named source instead of silently degrading — treat every such refusal as a live reproduction signal for this item's ordering root-fix.
