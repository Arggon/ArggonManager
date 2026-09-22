---
type: task
status: todo
id: task-ui-browser-smoke-ci
title: "Browser smoke in CI: @smoke Playwright spec + TUI frame check"
parent: ui-foundation
labels: [ui, smoke, ci]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ui-browser-smoke-ci.md
  Leaves live only under a story. id is the filename stem: task-ui-browser-smoke-ci.
  CLI `arggon create task ui-browser-smoke-ci` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Browser smoke in CI: @smoke Playwright spec + TUI frame check

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

ADR 0008 chose two tiers: review-time Playwright CLI (used ad hoc today) and an optional CI `@smoke` `@playwright/test` spec that was never implemented. Every UI change in the `ui` epic will need a durable regression net; the TUI exception (scripted pty render check) is already prototyped in `smoke/tui-smoke.ts`.

## Acceptance

- [ ] A `@smoke`-tagged Playwright spec: `board --serve` on a fixture renders cards matching `arggon list`, one status move round-trips and persists (verified with `arggon show`), and a filter reduces the view
- [ ] A CI job runs the spec on Chromium only; Playwright stays dev-only (never a runtime dependency) and the job skips cleanly when browsers are unavailable
- [ ] The TUI gets a scripted frame assertion (reuse the smoke fixture pattern) or a documented manual step in the same docs section
- [ ] docs/engineering.md testing table + CONTRIBUTING.md commands updated; CI green on the PR
