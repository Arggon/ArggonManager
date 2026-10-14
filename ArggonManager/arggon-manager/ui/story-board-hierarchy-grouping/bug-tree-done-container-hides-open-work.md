---
type: bug
status: in_progress
id: bug-tree-done-container-hides-open-work
title: "Tree rows: a terminal container with open descendants shows only `done` — disclose `N open` on the row (15 of 84 containers today)"
assignee: arggon-delivery-lead
branch: fix/bug-tree-done-container-hides-open-work
parent: story-board-hierarchy-grouping
labels: []
created: "2026-10-14"
updated: "2026-10-14"
claimed_at: "2026-10-14T20:53:04.148Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-tree-done-container-hides-open-work
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-board-hierarchy-grouping/bug-tree-done-container-hides-open-work.md
  Leaves live only under a story. id is the filename stem: bug-tree-done-container-hides-open-work.
  CLI `arggon create bug tree-done-container-hides-open-work` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Tree rows: a terminal container with open descendants shows only `done` — disclose `N open` on the row (15 of 84 containers today)

## Context

Product-owner report on the served board: the tree shows the `Agent-native tooling`
initiative with a `done` chip while dozens of its descendants are still open. Measured:
**15 of the tracker's 84 containers are terminal with open descendants** — `agent-native`
43, `arggon-manager` 30, `ecosystem-ops` 27, `cli` 26, `tooling-and-environment` 21,
`methodology-improvements` 18, `agent-coordination` 16, … .

This is legitimate tracker state, not corruption: `ArggonManager/docs/convention.md`
§"Parent `status` is independent of children — no rollup in v0. Container status is
authored, not derived." A closed container keeps its authored status while follow-ups
and new workstreams are filed under it; the cascade is write-on-close only. What is
wrong is the **board**: the tree row renders only the authored status chip
(`renderBoardTree`'s row template, `cli/src/board.ts` ~L2511), so a reader sees `done`
with open work below and no disclosure. The tree already accepts disclosure markers
(context rows under hide-terminal; "N matches inside" for lenses) — this adds the
missing one. The status chip must stay the authored status: this is a disclosure, not a
rollup.

## Acceptance

- [ ] Tree rows for containers (initiative/epic/story) whose subtree contains open items (todo/in_progress/blocked) render a visible badge after the status chip with the count of open descendants (e.g. `43 open`); a container with no open descendants renders no badge; leaf rows are unchanged
- [ ] The count is the FULL subtree over the tracker's complete item set — hiding done/cancelled, a lens, or a fold must not change the number
- [ ] The status chip still shows the authored status (no rollup); cancelled descendants do not count as open
- [ ] The row's accessible name (aria-label / card label) includes the disclosure
- [ ] Same rendering in the static export as in the served board; pinned by a `@smoke` e2e case (fixture with a done container holding open descendants) plus unit coverage
- [ ] `arggon validate`, focused tests, the full suite, lint, structure, prettier green

## Notes

- Shape references (already shipped): `task-web-board-hierarchy-view`,
  `bug-tree-ignores-hide-terminal-toggle`, `task-tree-rows-open-detail`. Reuse the
  existing badge pattern (the blocked badge) rather than a new component; keep the change
  in the tree renderer + its styles.
- If the renderer only receives the filtered tree, thread a full-set open-count map into
  it — the count must not depend on the active filter.

### 2026-10-14 @arggon-maker
### Evidence — PR #825 (gates + rendering)

Gates (worktree, all green):
- `npm run arggon -- validate`: ok (0 warnings, convention v5)
- focused: `npx vitest run cli/src/board.test.ts cli/src/board-serve.test.ts cli/src/board-parity.test.ts cli/src/board-embed.test.ts` -> 191 passed
- `npm test`: 3465 passed / 158 files
- `npm run build` (tsc + e2e typecheck): ok
- `npm run lint`: ok
- `npm run test:structure`: 5 passed
- `npx prettier --check cli/src/board.ts cli/src/board.test.ts e2e/board.smoke.spec.ts`: ok
- `npx playwright test --grep @smoke`: 48 passed (2 new cases)

Rendering, same tracker, static `--group-by tree` export before/after the source change:
- `agent-native` (initiative, done): before `<span class="status-chip done">done</span> <span class="tree-title">Agent-native tooling: dependencies, leases, worktrees, ecosystem</span>` -> after `...<span class="status-chip done">done</span> <span class="tree-open">43 open</span> <span class="tree-title">Agent-native tooling: ...</span>`
- `cli` (epic, done): `done` -> `done 26 open`; 22 containers disclose on the current tracker.
- Served board (e2e fixture): initiative row `done 2 open`, aria-label `initiative tree-done-root: Tree done root (done, 2 open descendants)`; the count is unchanged with hide done/cancelled, a fold and a lens; a zero-open container and leaf rows carry no badge; the static export renders identically.
