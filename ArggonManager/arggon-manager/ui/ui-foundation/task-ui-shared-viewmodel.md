---
type: task
status: todo
id: task-ui-shared-viewmodel
title: "Extract the shared board view-model (web, TUI, OpenCode panel)"
parent: ui-foundation
labels: [ui, architecture]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ui-shared-viewmodel.md
  Leaves live only under a story. id is the filename stem: task-ui-shared-viewmodel.
  CLI `arggon create task ui-shared-viewmodel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Extract the shared board view-model (web, TUI, OpenCode panel)

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

The same derived display logic is implemented per surface: dependency-blocked detection and counts exist in `cli/src/board.ts`, `cli/src/tui.ts` and `opencode/plugins/arggon/board.ts`; grouping/sorting/tree flattening will keep diverging as the v2 features land. The kernel already owns the rules (`openDependencies`, `isReady`, `parseFilter`) but not the derived view model.

## Acceptance

- [ ] One pure module (e.g. `lib/src/view-model.ts`) exports the board view model: filter/lens application, sorting (id/priority/rank), grouping, dep-blocked marks, per-status counts and tree flattening — dependency-free, fully unit-tested
- [ ] All three surfaces consume it; no behavior change (existing golden/byte tests stay green; plugin bundle regenerated and `npm run check:plugin` green)
- [ ] The module's surface is documented where lib surfaces are documented; if it changes a public contract, an ADR precedes it
- [ ] No new runtime dependency; `npm test` + `arggon validate --json` green
