---
type: bug
status: in_progress
id: bug-live-reload-sse-race
title: Board live-reload Playwright spec races the SSE reconnect on slow machines (timing flake)
assignee: Arggon
branch: fix/bug-live-reload-sse-race
parent: ci-stability
labels: [board, flaky]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T02:44:35.149Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-live-reload-sse-race
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

- [x] Reproduce or bound the race: run the spec in a loop (or with CPU throttling) until caught; identify whether the wait is a fixed timeout vs a readiness signal.
- [x] Replace the timing assumption with a deterministic readiness signal (await the SSE reconnection event / fresh marker) — not a longer sleep.
- [x] Spec passes 10 consecutive local runs under throttling; ui-smoke lane green.

### 2026-10-01 @ses_f0aa6a0b5ffdBhJTdljdX8f59T
Race found — it is NOT a lost SSE broadcast; it is the spec's wait mechanism.

## Mechanism (server dump + Playwright trace, both sides of the same failure)
- Repro: CDP `Emulation.setCPUThrottlingRate 20` + 16 background busy-spinners (12-core box, load avg 11→23 while a sibling worker ran vitest). Un-instrumented failure rate ~20-30%/run under that condition.
- Buffered server event log at failure: create write → broadcast → reload (GET /) → ES reconnect; update write → broadcast → `GET /` at +28ms → old ES closed at +99ms — the ES-close being processed proves `route()` returned, i.e. the server wrote the full body. One write per CLI op, one broadcast, nothing lost, no strays.
- Playwright HAR of the same failure: the reloaded `GET /` shows status 200 but the reloaded page never issues `GET /events` again — under contention the renderer takes >15s to produce a working execution context for the reloaded document.
- The spec waited via `expect.poll(() => page.evaluate(() => window.marker))`: `page.evaluate` throws "Execution context was destroyed" on every attempt while the frame navigates, so the poll burned its fixed 15s window throwing instead of waiting. Fixed timeout where a readiness signal belongs — exactly the filed hypothesis, except the reconnect itself was never lost.

## Fix (spec-only; e2e/board.smoke.spec.ts)
1. Replacement probe moved onto the DOM: `html[data-preserve-marker]`, asserted with `expect(page.locator("html:not([data-preserve-marker])")).toHaveCount(1, { timeout: 30_000 })` — non-vacuous (resolves only on the reloaded document; the old page carries the marker; a teardown window resolves zero elements and keeps waiting). Locator waits retry through navigation by design.
2. Page-functional gate: `expect(page.locator("#board-conn.live")).toHaveText("live", { timeout: 15_000 })` — the SSE reconnection signal the board itself exposes; after it, the remaining evaluate reads (scrollY) cannot race a pending navigation.
No assertion weakened: the marker still proves document replacement; ceilings are upper bounds on condition waits, not sleeps. No product change needed.

## Evidence
- A/B under identical throttle+load: OLD body 3/5 failed (same signature: marker poll, context destroyed); FIXED body 12/12 passed (load avg 11→23).
- Acceptance loop: 10/10 passed with THROTTLE_CPU=20; plus full @smoke lane 33/33 unthrottled.
- Gates: vitest 1957/1957, eslint clean, build clean, check:plugin no drift, arggon validate ok.

### handoff 2026-10-01 @ses_f0aa6a0b5ffdBhJTdljdX8f59T (session: ses_f0aa6a0b5ffdBhJTdljdX8f59T) — next: Review PR (spec-only flake fix); merge closes the item — CI ui-smoke lane confirms.
- branch: fix/bug-live-reload-sse-race
- open questions: Whether repo-wide evaluate-based waits should be swept; found none other in this spec that can race a navigation.
