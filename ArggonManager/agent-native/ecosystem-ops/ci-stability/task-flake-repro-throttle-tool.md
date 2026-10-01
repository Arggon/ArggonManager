---
type: task
status: in_progress
id: task-flake-repro-throttle-tool
title: Commit a reusable CPU-throttle + load repro harness for flaky e2e specs (CDP setCPUThrottlingRate + busy-spinners)
assignee: Arggon
branch: feat/task-flake-repro-throttle-tool
parent: ci-stability
labels: [testing, flaky, board]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T18:46:47.598Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-flake-repro-throttle-tool
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-flake-repro-throttle-tool.md
  Leaves live only under a story. id is the filename stem: task-flake-repro-throttle-tool.
  CLI `arggon create task flake-repro-throttle-tool` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Commit a reusable CPU-throttle + load repro harness for flaky e2e specs (CDP setCPUThrottlingRate + busy-spinners)

## Context

Filed from the #521 review (bug-live-reload-sse-race): the live-reload race worker built a deterministic repro — CDP `Emulation.setCPUThrottlingRate(20)` + 16 host busy-spinners — and then reverted it before commit, so the next flaky e2e spec would have started from zero. This task lands that repro as a reusable, env-gated harness: the next intermittent e2e failure is reproduced under instrumented load on demand instead of by rerun roulette.

## Acceptance

- [x] Env-gated harness, reusable by any flaky e2e spec: `e2e/helpers/flake-harness.ts` — `E2E_THROTTLE=<n>` arms CDP `Emulation.setCPUThrottlingRate` on every page the spec opens, `E2E_SPINNERS=<n>` holds host busy-spinner processes for the worker (ppid-latch + 15-minute deadline so a force-killed worker cannot leak spinners). Both fixtures are strict no-ops without the env; malformed values fail loud naming the variable. Specs opt in with a one-line `test` import swap (documented in the file header); `board.smoke.spec.ts` carries exactly that hook.
- [x] Pre-#521 signature reappears under the harness: on this branch (pre-fix body), `E2E_THROTTLE=20 E2E_SPINNERS=16 npx playwright test --grep "a live reload preserves" --repeat-each=5` → **4 failed / 1 passed**, failing at the marker `expect.poll` with `page.evaluate: Execution context was destroyed, most likely because of a navigation` — the exact #521 failure signature (the PR's own instrumented A/B saw 3/5).
- [x] Current (fixed) code passes under the same harness: #521 spec patch (9960b869, PR still open) applied as a throwaway working-tree change → same command, `--repeat-each=6` → **6/6 passed** identically armed (PR acceptance loop: 12/12). Patch then reverted; tree restored to the pre-fix body (the fix ships via #521, not here).
- [x] Documented in the testing-expectations carrier: `ArggonManager/docs/engineering.md` §smoke gains the flake-reproduction-harness bullet (what it arms, the proven recipe, the never-wired-into-CI policy, and what it does not claim); usage + recipe also in the harness file header.
- [x] Default CI lane unaffected: without the env nothing is armed (fixtures no-op) — `npx playwright test --grep @smoke` on the final tree: **33 passed** unthrottled.

## Notes

### 2026-10-01 @Coordinator

### 2026-10-01 @Coordinator

Filed from bug-live-reload-sse-race (PR #521): the worker built a deterministic repro for the live-reload race — CDP Emulation.setCPUThrottlingRate(20) + 16 background busy-spinners, reproduction ~20-30%/run un-instrumented (jumped further under concurrent vitest load) — then reverted it before commit. Acceptance: land it as an env-gated harness (e.g. E2E_THROTTLE=20 + spinners) reusable by any flaky e2e spec, document in the testing expectations, prove it still reproduces the (now fixed) live-reload signature when pointed at the pre-#521 code via a scratch check, and it does not affect the default CI lane.
