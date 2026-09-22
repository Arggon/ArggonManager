---
type: story
status: todo
id: ui-foundation
title: "UI foundation: shared board view-model and browser smoke gate"
parent: ui
labels: [ui, architecture, smoke]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/ui-foundation.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# UI foundation: shared board view-model and browser smoke gate

## Context

<!-- Why this story exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Three surfaces render the same domain (statuses, types, dependency blocking, counts, tree): `cli/src/board.ts`, `cli/src/tui.ts` and `opencode/plugins/arggon/board.ts`. The kernel shares rules (`openDependencies`, `isReady`, filter parsing) but the derived display logic is re-implemented per surface (e.g. dep-blocked detection exists three times) and will drift as v2 work lands.

Separately, ADR 0008 tier 2 (an optional CI `@smoke` Playwright spec) was decided but never implemented; UI changes currently depend on review-time manual Playwright CLI runs only.

## Acceptance

- [ ] `task-ui-shared-viewmodel` done: one pure view-model consumed by all three surfaces, no behavior change
- [ ] `task-ui-browser-smoke-ci` done: `@smoke`-tagged browser spec runs in CI (Chromium-only, dev-only dependency)
- [ ] No new runtime dependency; a cross-cutting lib contract change would need an ADR (none expected here)
- [ ] `npm run check:plugin` + `npm test` green
