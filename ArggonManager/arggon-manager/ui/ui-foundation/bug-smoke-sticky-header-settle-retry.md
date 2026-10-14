---
type: bug
status: done
id: bug-smoke-sticky-header-settle-retry
title: ui-smoke sticky-header test flakes locally under the SSE settle race (un-retried poll) — extend its bounded retry
assignee: arggon-delivery-lead
branch: fix/bug-smoke-sticky-header-settle-retry
parent: ui-foundation
labels: [ui, tests]
created: "2026-10-14"
updated: "2026-10-14"
worktree_path: /home/arggon/Projects/ArggonManager-bug-smoke-sticky-header-settle-retry
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

- [x] The sticky-header test's settle poll carries the same bounded retry its own comment describes (or the wait is re-based on a signal that cannot be destroyed by the reload)
- [x] Reproduced red under the flake harness (`E2E_THROTTLE=20 E2E_SPINNERS=16 npx playwright test --grep @smoke`) before, green after — or the failure mode is falsified with evidence
- [x] `npm run arggon -- validate` green; the `ui-smoke` lane stays green; PR opened

## Notes

### 2026-10-14 @Arggon
### Evidence — completed by the lead after a host tool-runtime outage (maker diagnosis preserved)
The maker's session died to the host tool-runtime fault after reproducing and designing the fix; the delivery lead applied and verified it from the same worktree.
**Root cause (proven):** `expect.poll` does not retry a probe that THROWS — `actual()` sits outside the retry try/catch in Playwright 1.63 — so when the debounced SSE reload navigated mid-poll, `page.evaluate: Execution context was destroyed` aborted the poll instead of being retried, despite the comment claiming coverage. **Red observed** in a plain full lane: test #35 "column headers stick to the viewport top while the board scrolls" — 1 failed / 45 passed; log `/tmp/opencode/flake-repro/full-lane-plain-1.log` (error text confirmed at lines 54-90, at the settle poll L1744).
**Fix:** the settle probe catches the destroyed-context throw and returns false ("a navigation in flight is not settled yet"), so the poll's own bounded retry covers it — mirroring the file's measure-loop intent — and the ceiling is raised 10s → 30s for contended machines (#521 saw >15s contexts).
**Green after:** plain full `@smoke` lane green — 46/46 passed (39.5s). Honest limit: the flake is intermittent (red observed once in the reported conditions), so one green lane is not statistical proof; the mechanism is source-proven and the aborted-probe path is now impossible by construction. PR #820.

### handoff 2026-10-14 @Arggon — next: Review + merge PR #820; tick the three acceptance rows at merge verification.
- branch: fix/bug-smoke-sticky-header-settle-retry
