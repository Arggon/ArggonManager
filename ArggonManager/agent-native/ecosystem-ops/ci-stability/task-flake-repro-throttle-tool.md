---
type: task
status: todo
id: task-flake-repro-throttle-tool
title: Commit a reusable CPU-throttle + load repro harness for flaky e2e specs (CDP setCPUThrottlingRate + busy-spinners)
parent: ci-stability
labels: [testing, flaky, board]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-flake-repro-throttle-tool.md
  Leaves live only under a story. id is the filename stem: task-flake-repro-throttle-tool.
  CLI `arggon create task flake-repro-throttle-tool` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Commit a reusable CPU-throttle + load repro harness for flaky e2e specs (CDP setCPUThrottlingRate + busy-spinners)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from bug-live-reload-sse-race (PR #521): the worker built a deterministic repro for the live-reload race — CDP Emulation.setCPUThrottlingRate(20) + 16 background busy-spinners, reproduction ~20-30%/run un-instrumented (jumped further under concurrent vitest load) — then reverted it before commit. Acceptance: land it as an env-gated harness (e.g. E2E_THROTTLE=20 + spinners) reusable by any flaky e2e spec, document in the testing expectations, prove it still reproduces the (now fixed) live-reload signature when pointed at the pre-#521 code via a scratch check, and it does not affect the default CI lane.
