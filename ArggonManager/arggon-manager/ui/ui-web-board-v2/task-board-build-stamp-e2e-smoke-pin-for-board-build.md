---
type: task
status: in_progress
id: task-board-build-stamp-e2e-smoke-pin-for-board-build
title: "Board build-stamp: e2e @smoke pin for #board-build"
assignee: arggon-delivery-lead
branch: feat/task-board-build-stamp-e2e-smoke-pin-for-board-build
parent: ui-web-board-v2
labels: []
created: "2026-10-16"
updated: "2026-10-16"
claimed_at: "2026-10-16T10:52:11.885Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-build-stamp-e2e-smoke-pin-for-board-build
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-build-stamp-e2e-smoke-pin-for-board-build.md
  Leaves live only under a story. id is the filename stem: task-board-build-stamp-e2e-smoke-pin-for-board-build.
  CLI `arggon create task board-build-stamp-e2e-smoke-pin-for-board-build` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Board build-stamp: e2e @smoke pin for #board-build

## Context

Follow-up from the task-board-build-stamp review (PR #854, merged 2026-10-16): the build stamp is covered by unit tests, board-parity tests and a manual Chromium smoke, but the CI `@smoke` spec (`e2e/board.smoke.spec.ts`) asserts nothing about `#board-build` — a stamp regression would pass the durable lane. Same PR left a one-word README precision nit (see acceptance).

## Acceptance

- [ ] The CI `@smoke` spec asserts the served board exposes the build stamp viewer-visible (footer `#board-build` with the build string; drawer `#board-drawer-build` after opening a card)
- [ ] `ui-smoke` lane green on the PR; `arggon validate` green; prettier clean
- [ ] README `--details` sentence no longer over-claims byte-identical: scoped to drawer-free (no drawer markup, no embedded payload, no extra script) since header/footer now always carry the stamp

## Notes
