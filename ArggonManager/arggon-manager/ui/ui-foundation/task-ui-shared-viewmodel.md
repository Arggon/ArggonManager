---
type: task
status: in_progress
id: task-ui-shared-viewmodel
title: "Extract the shared board view-model (web, TUI, OpenCode panel)"
assignee: Arggon
branch: feat/task-ui-shared-viewmodel
parent: ui-foundation
labels: [ui, architecture]
priority: p2
created: "2026-09-22"
updated: "2026-09-22"
claimed_at: "2026-09-22T22:55:24.949Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-ui-shared-viewmodel
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

### 2026-09-22 @ses_f34ab7c2fffe7rHSRQcARR0Hvz
## Worker evidence — task-ui-shared-viewmodel (wave 0)

**Branch** `feat/task-ui-shared-viewmodel` · **PR** #400 (OPEN, CI green: `cli` pass 4m28s, `tasks-validate` pass 40s)
**Commit** `c249b19fdd044dd539a0901855751b1680e1d002` ("refactor(ui): extract the shared board view-model") on top of the claim commit `46039d1f`; base `802940b3` (main at claim).
**HEAD before the first code edit:** `46039d1f0aeb77f768ff0130f900b705dd01957b` → **after:** `c249b19fdd044dd539a0901855751b1680e1d002`.

### Files changed (8; this item only)

- `lib/src/view-model.ts` (new) and `lib/src/view-model.test.ts` (new, 25 tests)
- `lib/src/index.ts` (export block + module-header bullet), `lib/README.md` (stable-subset row + `Board view-model` section)
- `cli/src/board.ts`, `cli/src/tui.ts`, `opencode/plugins/arggon/board.ts` (consume the view-model; public exports unchanged)
- `opencode/plugins/arggon/index.bundle.ts` (regenerated: 39→40 modules, 338,601→345,245 bytes)

Not touched (scope guard): `cli/src/board-serve.ts`, `tui.tsx`, `package.json`/lockfiles, workflows, other items' files. `evaluateDrop` stays in place, unmodified, not wrapped/re-exported (board-parity test green). No existing test edited, no unrelated reformatting.

### Gates (run inside the worktree)

| gate | before (`46039d1`, clean) | after (`c249b19`) |
| --- | --- | --- |
| `npm test` | 92 files / 1498 tests passed | 93 files / 1523 tests passed (+1 file, +25 new view-model tests) |
| `npm run build` | baseline install built | exit 0 |
| `npm run lint` | — | exit 0 |
| `npm run check:plugin` | exit 0 (bundle clean at that commit) | exit 0 (committed bundle == deterministic build) |
| `npm run arggon -- validate --json` | ok (pre-commit hook on both commits) | `{"ok":true,...,"errors":[],"warnings":[]}` |

### No behavior change — expected vs observed

Differential render probe on one fixed v5 fixture (board HTML plain/story/milestone/live+diffLinks, 8 TUI frames plain+color, plugin snapshot/tree lines/counts/sidebar, `tuiColumnCounts`/`tuiDepBlocked`), executed at `46039d1` (before) and `c249b19` (after):

| probe | expected | observed |
| --- | --- | --- |
| 26 shared render sections (903 lines) | byte-identical | `diff` empty; only the new `viewmodel.*` sections are after-only |
| board HTML (static / grouped / live overlay) | identical | identical |
| TUI frames, counts, dep marks, selection | identical | identical |
| panel snapshot, tree lines, counts, sidebar, tree entries | identical | identical |

Existing oracles untouched and green: `cli/src/board.test.ts`, `board-parity.test.ts` (embedded `evaluateDrop` source + kernel parity), `board-serve.test.ts`, `milestone.test.ts`, `tui.test.ts`, `opencode/plugins/arggon/board.test.ts`, bundle drift gate `cli/src/plugin-copy.test.ts`.

### Acceptance mapping (coordinator checklist)

1. **One pure module** exporting filter/lens, sorting, grouping, dep marks, counts, tree flattening, dependency-free, fully unit-tested — `lib/src/view-model.ts`: `sortById`/`sortByPriority`/`priorityTier`, `visibleItems`/`itemsForStatus`/`matchesSubstringFilter`/`applyViewLens`, `buildStatusIndex`/`openDependencyIds`/`hasOpenDependencies`, `statusCounts`, `groupItemsBy`, `treeEntries`, `readyTodoCount`; only sibling kernel imports (`openDependencies`/`isReady`, `isClaimable`, `parseFilter`/`matchesPredicate`, `priorityRank`); 25 tests incl. the cycle guard, the no-group bucket and the lens rules.
2. **All three surfaces consume it; no behavior change; bundle regenerated; check:plugin green** — gates + parity above.
3. **Surface documented where lib surfaces are documented; ADR only if the public contract changes** — `lib/README.md` documents the module (stable-subset row + section). Additive only: no `--json` field/shape changed, `schemaVersion` untouched → no ADR (engineering.md: pure refactors / local implementation choices).
4. **No new runtime dependency; `npm test` + `validate --json` green** — confirmed.

### Findings for the coordinator (not filed — worker create is denied)

- **F1 — `applyViewLens` ships with no consumer yet.** It is the tested/documented entry the v2 lens items (`task-board-filter-lenses`, `task-tui-filter-language`, `task-tui-sort-ready-lens`) will build on and the acceptance explicitly asks for filter/lens application; flagging so it is deliberate.
- **F2 — contract items carry `depends_on`, the lens reads kernel `dependsOn`.** Documented on `ViewItem`; lens consumers should pass kernel-shaped items. Not worked around here (scope).
- **F3 — `board-serve.ts` keeps its own id comparator** (line ~107), explicitly out of scope per the item. Candidate follow-up if full id-sort consolidation is wanted.
- **F0 — `start --worktree` claim commit failed in this environment**: `{"skipped":"git commit failed: sh: line 1: tsx: command not found"}` (no `node_modules` prepared in the fresh worktree); I ran `npm ci` and committed the claim manually (`chore(tasks): started task-ui-shared-viewmodel`). Worth a look at `start --worktree` friction (not filed).
