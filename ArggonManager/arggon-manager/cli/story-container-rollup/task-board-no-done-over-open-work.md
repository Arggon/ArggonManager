---
type: task
status: in_progress
id: task-board-no-done-over-open-work
title: "Board: never display `done` on a container with open work inside — derive the displayed status (stored statuses unchanged)"
assignee: arggon-delivery-lead
branch: feat/task-board-no-done-over-open-work
parent: story-container-rollup
labels: []
created: "2026-10-15"
updated: "2026-10-15"
claimed_at: "2026-10-15T00:14:47.921Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-no-done-over-open-work
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-container-rollup/task-board-no-done-over-open-work.md
  Leaves live only under a story. id is the filename stem: task-board-no-done-over-open-work.
  CLI `arggon create task board-no-done-over-open-work` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Board: never display `done` on a container with open work inside — derive the displayed status (stored statuses unchanged)

## Context

Owner decision (2026-10-14, `task-container-status-vs-open-workstreams`): the board must never
display `done` on a container that still has open work inside — leaves included ("Fix all not
just what I point"). Five containers holding open _stories_ were reopened by hand; the remaining
terminal containers with open _follow-ups_ (`methodology-improvements` `done` + 18 open,
`tooling-and-environment` + 21, `story-spec-pipeline` + 5, …) cannot be fixed by reopening —
that is human-only and every new follow-up under a closed container recreates the state. So the
board derives the **displayed** status: stored statuses stay as the closure record; the board
computes what the owner needs to read.

## Acceptance

- [ ] A container (initiative/epic/story) whose subtree contains any open item (todo/in_progress/blocked, any depth) never displays `done` on the web board — it displays `open` (the tracker's own antonym of terminal), with the open count still visible (the existing `N open` badge); the derivation is computed server-side from the complete item set (not the filtered view)
- [ ] Containers with a fully terminal subtree display their authored status unchanged; open containers display their authored status unchanged; leaf rows unchanged; `cancelled` containers are NOT masked (record why: the misleading case is `done` over open work; a cancelled scope reads as abandoned, not finished)
- [ ] The `hide done/cancelled` toggle and lenses do not hide a masked container (it reads open) — pinned by tests; wherever else the board renders a container's status (cards, if containers appear there), the same rule applies
- [ ] The row's accessible name carries the displayed state; if the drawer renders the stored status, it explains the effective one (or records why it stays out)
- [ ] Static export and served board identical; unit coverage for the mask/no-mask matrix (done+open work → `open`; done+terminal subtree → `done`; open container → authored; leaf → authored) plus a `@smoke` e2e case (a `done` story with an open leaf follow-up); axe state re-scanned
- [ ] `arggon validate`, focused tests, the full suite, lint, structure, prettier green

## Notes

- Owner-visible outcome: refresh the board — no `done` chip sits over open work anywhere, without touching the stored files.
- Implementation head start: `renderBoardTree` already computes an `openDescendants` map per node (`bug-tree-done-container-hides-open-work`); the mask is `authored === "done" && openDescendants.get(id) > 0`.
- Parallel task `task-container-hygiene-check` owns `lib/src/report*`, the report tests and `ArggonManager/docs/json-output.md` — do not touch those here; README's board section is the doc home if needed.
- TUI and OpenCode panel are out of scope (record the decision); the shared view-model may make the derivation reusable later.

## Notes

### 2026-10-15 @Arggon
**Evidence (maker, `task-board-no-done-over-open-work`) — PR https://github.com/Arggon/ArggonManager/pull/827**

Rule delivered: stored statuses untouched; the board derives the displayed status server-side from the complete item set — a container with any open descendant (todo/in_progress/blocked, any depth) renders `open` + the existing `N open` disclosure instead of `done`, on the tree row AND the column card, aria included. `cancelled` deliberately not masked; leaves and all-terminal subtrees byte-identical. The `hide done/cancelled` toggle and the lens read the displayed state (tree row not terminal; columns hide only genuinely terminal cards and keep the column). Drawer keeps the stored status and explains the effective one via additive `detail.open_descendants`.

Files: `cli/src/board.ts`, `cli/src/board.test.ts`, `cli/src/board-parity.test.ts`, `e2e/board.smoke.spec.ts`, `README.md`.

Gates (worktree, all green):
- `npm run arggon -- validate` → ok (0 warning(s), convention v5)
- `npx vitest run cli/src/board.test.ts cli/src/board-parity.test.ts` → 159 passed
- `npm test` (after `npm run build`) → 158 files / 3472 tests passed
- `npm run lint` → clean; `npm run test:structure` → 5 passed
- `npx prettier --check` touched files → clean
- `npx playwright test --grep @smoke` → 48 passed

Before/after (real render, `arggon board --group-by tree` over this tracker): `methodology-improvements` stored `done` with 18 open — before `<span class="status-chip done">done</span><span class="tree-open">18 open</span>`, after `<span class="status-chip open">open</span><span class="tree-open">18 open</span>`.

Decisions recorded: `cancelled` never masked (abandoned, not finished); TUI/OpenCode panel out of scope; the lens keeps the stored-status grammar (the mask changes the rendered state and the layout rule that could hide it, not the filter predicate).

### handoff 2026-10-15 @Arggon — next: Delivery lead: review PR #827, then merge; after merge tick the acceptance and close the item (stored statuses untouched).
- branch: feat/task-board-no-done-over-open-work
- open questions: lens predicate reads the stored status by design — flag if the owner wants a status:open value; a kept done column still shows the lens-verdict count (layout never moves counters)
