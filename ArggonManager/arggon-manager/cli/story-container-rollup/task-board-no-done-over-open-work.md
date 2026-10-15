---
type: task
status: todo
id: task-board-no-done-over-open-work
title: "Board: never display `done` on a container with open work inside — derive the displayed status (stored statuses unchanged)"
parent: story-container-rollup
labels: []
created: "2026-10-15"
updated: "2026-10-15"
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
