---
type: bug
status: in_progress
id: bug-live-reload-sse-race
title: Board live-reload Playwright spec races the SSE reconnect on slow machines (timing flake)
assignee: Arggon
parent: ci-stability
labels: [board, flaky]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T12:10:19.890Z"
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

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
verdict: approve (lead-architect review, PR #521)
- Mechanism: the filed guess was wrong and the worker proved it — server side clean (one broadcast per op, buffered event log + HAR); the defect was the wait mechanism (expect.poll throwing "context destroyed" through the pending navigation, burning its window). Replacement waits are strictly stronger: html-marker locator (retries through navigations; non-vacuity verified by the reviewer against board-serve.ts:143's real location.reload — the marker is spec-injected by design, same witness model as the old window.marker) + #board-conn.live reconnect gate. No assertion weakened; no sleeps.
- Evidence: A/B under identical throttle+load (old 3/5 fail, fixed 12/12), formal 10/10 at 20x throttle, @smoke 33/33; coordinator confirmations: CI cli/tasks-validate/ui-smoke all green on the final reconciled head (the tick-3 CI conjunct now evidenced).
- Scope: exactly e2e/board.smoke.spec.ts + item file; reviewer bars 1-5 pass; procedural note (CI conjunct ticked ahead of CI) resolved by this confirmation.
- Findings filed: task-flake-repro-throttle-tool (committed flake harness), task-remove-diag-listener (dead [DIAG] listener); fourth cold-start incident appended to bug-start-worktree-npm-ci-claim (now merged/covered).
