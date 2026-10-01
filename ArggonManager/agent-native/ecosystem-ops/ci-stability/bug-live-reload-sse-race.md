---
type: bug
status: todo
id: bug-live-reload-sse-race
title: Board live-reload Playwright spec races the SSE reconnect on slow machines (timing flake)
parent: ci-stability
labels: [board, flaky]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-live-reload-sse-race.md
  Leaves live only under a story. id is the filename stem: bug-live-reload-sse-race.
  CLI `arggon create bug live-reload-sse-race` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Board live-reload Playwright spec races the SSE reconnect on slow machines (timing flake)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the bug-tsx-board-dead-script worker's report (PR #510).

## Context
The full @smoke lane intermittently fails one spec ("a live reload preserves …") on slower machines: machine-timing SSE race between the board's live-reload reconnect and the spec's wait window. Reproduced on a clean tree in the worker worktree (pre-existing); CI (ui-smoke lane) is authoritative and green there — so this is a test-robustness gap, not a product regression.

## Acceptance
- [ ] Reproduce or bound the race: run the spec in a loop (or with CPU throttling) until caught; identify whether the wait is a fixed timeout vs a readiness signal.
- [ ] Replace the timing assumption with a deterministic readiness signal (await the SSE reconnection event / fresh marker) — not a longer sleep.
- [ ] Spec passes 10 consecutive local runs under throttling; ui-smoke lane green.
