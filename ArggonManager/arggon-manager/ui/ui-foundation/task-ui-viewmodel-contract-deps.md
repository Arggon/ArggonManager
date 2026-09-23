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

### 2026-09-23 @ses_f346f75cfffe3Ysb3GZMLd5VJw
## Implementation evidence (worker)

**Design chosen: accept both shapes internally** — `dependsOn ?? depends_on ?? []`, kernel field wins when both are present. A contract→kernel mapper was rejected as *the* contract because a call site can forget to map (that is the original silent-wrong-answer mode); accepting both has no opt-in to forget.

- `lib/src/view-model.ts`: module-private `viewItemDependencies` is the single normalization; `applyViewLens` normalizes once and feeds the blocked-by index, the readiness rule and `matchesPredicate` from it (so `depends-on:`/`blocked-by:` work on contract items too); `readyTodoCount` uses the same accessor; `ViewItem` documents both fields and the precedence. No new exports; results are the original item objects, never normalized copies.
- `lib/README.md`: new "Dependency shapes" paragraph documents the chosen contract.
- `lib/src/view-model.test.ts`: +6 tests built on the real JSON-contract `WorkItem` type. The existing 25 view-model tests are unchanged.

### Test evidence

Focused (new contract-shaped cases):
```
npx vitest run lib/src/view-model.test.ts -t "contract-shaped items"
✓ lib/src/view-model.test.ts (31 tests | 25 skipped)
Test Files 1 passed (1) | Tests 6 passed | 25 skipped (31)
```

Full suite (post-commit worktree):
```
npm test
Test Files 95 passed (95)
Tests 1539 passed (1539)
TEST_EXIT=0
```

Other gates (post-commit): `npm run lint` exit 0 · `npm run build` exit 0 (lib emit + typecheck pass + postbuild bundle) · `npm run check:plugin` exit 0 · `npm run arggon -- validate --json` → `ok:true`, 0 errors / 0 warnings.

### Bundle drift (committed artifact)

- Before: 345,245 bytes, 40 modules (committed artifact at previous HEAD).
- After: 345,469 bytes, 40 modules (`npm run check:plugin` clean, exit 0). +224 bytes; module graph unchanged — `lib/src/view-model.ts` was already inlined. Regenerated bundle committed in a0786746.

### Consumption form for task-board-filter-lenses (paste into that item)

> The view-model now accepts both dependency shapes, so no mapper call is needed: pass the board's contract-shaped items (`toContractWorkItem` output, `depends_on`) straight into `applyViewLens(items, lens)` — the `blocked-by:`/`depends-on:` predicates and the `ready` lens read `dependsOn` first and fall back to `depends_on` (kernel field wins when both exist). `readyTodoCount(items)` works the same way for a ready badge. For code that needs the id list itself (`openDependencyIds`/`hasOpenDependencies`/`buildBlockedByIndex`), normalize exactly like the view-model: `item.dependsOn ?? item.depends_on ?? []`.

### Tracking

- PR #404 · head a0786746415d46ab3da63f7d199e8de54af9a84d · CI: cli pass (4m28s, includes the plugin drift gate), tasks-validate pass, ui-smoke pass.
- Open questions: none for this item. Process note: the fresh worktree hit the known `bug-native-start-worktree-no-install` (claim commit skipped, `tsx: command not found`); `npm ci` + manual claim commit 3b68d6de fixed it, no `--no-verify` used.

### handoff 2026-09-23 @ses_f346f75cfffe3Ysb3GZMLd5VJw (session: ses_f346f75cfffe3Ysb3GZMLd5VJw) — next: Coordinator: review PR #404 (gates green), paste the consumption-form paragraph into task-board-filter-lenses, merge, then flip task-ui-viewmodel-contract-deps done.
- branch: feat/task-ui-viewmodel-contract-deps
- open questions: None blocking; the 'task-board-filter-lenses consumes the chosen form' acceptance box is a coordinator note, not code in this PR.
