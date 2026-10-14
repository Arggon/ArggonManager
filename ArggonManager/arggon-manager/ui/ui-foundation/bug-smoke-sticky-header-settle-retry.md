---
type: bug
status: todo
id: bug-smoke-sticky-header-settle-retry
title: ui-smoke sticky-header test flakes locally under the SSE settle race (un-retried poll) — extend its bounded retry
parent: ui-foundation
labels: [ui, tests]
created: "2026-10-14"
updated: "2026-10-14"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/bug-smoke-sticky-header-settle-retry.md
  Leaves live only under a story. id is the filename stem: bug-smoke-sticky-header-settle-retry.
  CLI `arggon create bug smoke-sticky-header-settle-retry` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ui-smoke sticky-header test flakes locally under the SSE settle race (un-retried poll) — extend its bounded retry

## Context

Reported while landing `task-web-board-hierarchy-view` (PR #814): the `@smoke` "column headers stick to the viewport top" test failed in 2 of 5 local full-lane runs with `Execution context was destroyed` — the SSE live-reload landing inside its un-retried settle poll, the exact race its own comment describes. It passes in isolation and the CI `ui-smoke` lane is green, so this is a maintainer-locally reproducible flake, not a product defect. The repo's flake harness (`e2e/helpers/flake-harness.ts`) exists to reproduce this class under load.

## Acceptance

- [ ] The sticky-header test's settle poll carries the same bounded retry its own comment describes (or the wait is re-based on a signal that cannot be destroyed by the reload)
- [ ] Reproduced red under the flake harness (`E2E_THROTTLE=20 E2E_SPINNERS=16 npx playwright test --grep @smoke`) before, green after — or the failure mode is falsified with evidence
- [ ] `npm run arggon -- validate` green; the `ui-smoke` lane stays green; PR opened

## Notes
