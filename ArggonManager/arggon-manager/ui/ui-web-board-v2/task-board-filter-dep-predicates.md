---
type: task
status: todo
id: task-board-filter-dep-predicates
title: "Web board filter: enable parent:, depends-on:, blocked-by: and readiness"
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p3
created: "2026-09-23"
updated: "2026-09-23"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-filter-dep-predicates.md
  Leaves live only under a story. id is the filename stem: task-board-filter-dep-predicates.
  CLI `arggon create task board-filter-dep-predicates` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board filter: enable parent:, depends-on:, blocked-by: and readiness

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-23 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`task-board-filter-lenses` (merged, PR #406) shipped the board lens with a documented v1 exclusion: `parent:`, `depends-on:`, `blocked-by:` and readiness are refused with a pointer to `arggon list --filter`, because the board renders contract items (`depends_on`) while the kernel lens read `dependsOn`. `task-ui-viewmodel-contract-deps` (merged, PR #404) removed that blocker: `applyViewLens`/`readyTodoCount` now accept both shapes (`dependsOn ?? depends_on`, kernel field wins), and the display helper rule is `item.dependsOn ?? item.depends_on ?? []`.

Consumption form (from the merged item): pass contract items straight into `applyViewLens(items, lens)` — `blocked-by:`/`depends-on:` and the `ready` lens read either shape.

## Acceptance

- [ ] The board's embedded `applyBoardFilter` mirror drops the v1 refusal for `parent:`, `depends-on:`, `blocked-by:` and the readiness lens, reading contract items (`depends_on`) with the same precedence rule; kernel-only refusal test replaced by a parity case
- [ ] `cli/src/board-parity.test.ts` extends the expression table (blocked-by open/closed/unknown dep, depends-on, parent chain, readiness) with 1:1 `runList`/`applyViewLens` proof
- [ ] `e2e/board.smoke.spec.ts` gets a dep-predicate case; README board section + `docs/json-output.md` board note updated (remove the "refused" wording)
- [ ] Filtered counts/URL state behave like the existing predicates; no `lib/**` change expected (dual shape is already there), no new CLI flags
- [ ] Unit + browser smoke evidence in the verdict; `npm test` / lint / build / `validate` green
