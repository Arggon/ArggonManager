---
type: task
status: in_progress
id: task-ui-viewmodel-contract-deps
title: "View-model lens on contract-shaped items: map depends_on -> dependsOn or accept both"
assignee: Arggon
branch: feat/task-ui-viewmodel-contract-deps
parent: ui-foundation
labels: [ui, architecture]
priority: p2
created: "2026-09-22"
updated: "2026-09-23"
claimed_at: "2026-09-23T00:01:54.204Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-ui-viewmodel-contract-deps
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-ui-viewmodel-contract-deps.md
  Leaves live only under a story. id is the filename stem: task-ui-viewmodel-contract-deps.
  CLI `arggon create task ui-viewmodel-contract-deps` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# View-model lens on contract-shaped items: map depends_on -> dependsOn or accept both

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-22 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Reported by the `task-ui-shared-viewmodel` worker during wave 0 (finding F2): `applyViewLens` / `readyTodoCount` read the kernel shape (`dependsOn`), while the web board's serve path (and `board --serve`'s `runUpdate` callers) work with the JSON-contract shape (`depends_on`). A wave-1 consumer (`task-board-filter-lenses`) that passes contract items would make the `blocked-by:`/`depends-on:` predicates and the `ready` lens silently see **no dependencies** (empty `dependsOn` → no blocking), which is a silent-wrong-answer footgun, not a crash. The `ViewItem` type documents the limitation today.

## Acceptance

- [ ] `applyViewLens`/`readyTodoCount` either accept both shapes (`dependsOn` ?? `depends_on`) or the view-model exports an explicit contract→kernel mapper; the chosen contract is documented in `lib/README.md`
- [ ] Unit tests cover contract-shaped input: a `depends_on` edge blocks the `blocked-by:` predicate and the `ready` lens exactly like `dependsOn`
- [ ] `task-board-filter-lenses` consumes the chosen form (note it in that item before it is claimed)
- [ ] No behavior change for kernel-shaped callers; plugin bundle regenerated + `npm run check:plugin` green if the bundle graph changes
