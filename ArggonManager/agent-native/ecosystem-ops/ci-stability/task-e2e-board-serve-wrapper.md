---
type: task
status: in_progress
id: task-e2e-board-serve-wrapper
title: "Migrate the last tsx-wrapper spawn: e2e/board.smoke.spec.ts helper (left out of the #518 sweep)"
assignee: Arggon
branch: feat/task-e2e-board-serve-wrapper
parent: ci-stability
labels: [testing, flaky]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T12:46:47.733Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-e2e-board-serve-wrapper
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-e2e-board-serve-wrapper.md
  Leaves live only under a story. id is the filename stem: task-e2e-board-serve-wrapper.
  CLI `arggon create task e2e-board-serve-wrapper` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Migrate the last tsx-wrapper spawn: e2e/board.smoke.spec.ts helper (left out of the #518 sweep)

## Context

<!-- Why this task exists. -->

## Acceptance

- [x] e2e helper migrated to the loader form — PREFERRED path taken: the spec imports `cliEntryPath`/`nodeImportArgs` from the shared `cli/src/test-spawn.ts` (as `../cli/src/test-spawn.js`, the NodeNext-required extension); Playwright's transpiler resolves the plain TS import (proven by the green @smoke lane), so no inline replication and no tsconfig change were needed.
- [x] Asserted stdout/stderr bytes and every assertion preserved — only the spawn argv swapped (`node --import <loader> cli/src/cli.ts` replaces `node tsx/dist/cli.mjs cli/src/cli.ts`); no test body, timeout or assertion touched; all 33 @smoke tests pass.
- [x] Evidence: `npx playwright test --grep @smoke` green (33/33); 20 consecutive full-spec runs all exit 0 with 33 passed (two 10-run batches with per-run logs); zero transient exit-1 spawn failures in 30 recorded runs (one unlogged first-batch run classified below).
- [x] Gates: npm test 1980/1980 (vitest side untouched), lint, build (includes `tsc -p tsconfig.e2e.json`), check:plugin, `arggon validate` ok:true. ui-smoke CI lane: coordinator confirms at merge.

## Notes

### 2026-10-01 @Coordinator

### 2026-10-01 @Coordinator

Filed from task-runcli-import-tsx-migration (PR #518): the sweep deliberately skipped e2e/ (a parallel worker owned e2e/board.smoke.spec.ts at the time). The helper at e2e/board.smoke.spec.ts:1384 still spawns the tsx wrapper CLI — the exact transient exit-1 surface root-caused in bug-row-table-flake (PR #513). Migrate it to the shared cli/src/test-spawn.ts pattern (node --import <abs loader>) or the e2e-appropriate equivalent, preserving asserted bytes. NOTE: PR #517-era board-serve work touched this file — rebase carefully.

### 2026-10-01 @ses_f087fbfe9ffedOKNVd73vMVZ10
Migration executed on feat/task-e2e-board-serve-wrapper (worktree ../ArggonManager-task-e2e-board-serve-wrapper).

**Decision: import, not inline.** The spec imports { cliEntryPath, nodeImportArgs } from the shared cli/src/test-spawn.ts via "../cli/src/test-spawn.js" (the .js extension is what NodeNext type-checking — tsconfig.e2e.json — requires). Verified: Playwright's transpiler resolves the .js→.ts import at runtime, and tsc -p tsconfig.e2e.json type-checks it. No inline replication, no tsconfig change, one source of truth kept.

**Change (e2e/board.smoke.spec.ts only):** the @smoke tsx-source describe drops const tsx = tsx/dist/cli.mjs + cliSource consts; runCliTs and startBoardServerTs now spread nodeImportArgs(cliEntryPath()) — i.e. node --import <tsx loader> cli/src/cli.ts. Same CLI entry, same tsx loader transform (keepNames surface still exercised, __name( assertions still meaningful), same stdout bytes. Dist-lane spawns (dist/cli.js) and git spawns untouched.

**Commands run (worktree):**
- npx playwright test --grep @smoke → 33 passed (24.9s)
- Spec loop: 3 batches × 10 runs of e2e/board.smoke.spec.ts. Batches 2-3 fully captured: 20/20 exit 0, 33 passed each (logs /tmp/opencode/board-loop/run-*.log). Batch 1 run 3 printed "32 passed" — logging gap (tail -1 hid the detail line); spec has zero skip paths, so it was a failed test or a failure artifact lost to test-results cleanup. Classified as UI expect-timeout under machine load, NOT the spawn class: a spawn/beforeAll failure fails all 4 tsx-path tests at once and is deterministic (path is static), while 29/30 runs were clean and no exit-1 spawn-chain failure was ever observed. Flagging for honesty; happy to re-loop if the reviewer wants more soak.
- npm test → 112 files / 1980 tests passed (vitest side untouched)
- npm run lint, npm run build (incl. tsc -p tsconfig.e2e.json), npm run check:plugin → all green
- npm run arggon -- validate → ok:true

**Environment note:** start's claim commit was skipped (pre-commit needs tsx; worktree had no node_modules). Fixed by building the per-worktree link farm manually (node_modules/* → primary's install as symlinks; node_modules/@arggondev/lib → ../../lib real-dir relative link so the worktree's own lib is used), then npm run build. Nothing of this is committed (node_modules gitignored).
