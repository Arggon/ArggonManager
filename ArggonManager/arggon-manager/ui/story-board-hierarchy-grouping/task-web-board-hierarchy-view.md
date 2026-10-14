---
type: task
status: done
id: task-web-board-hierarchy-view
title: "Web board: grouped ancestry view (initiative → epic → story → leaf) in the served board"
assignee: arggon-delivery-lead
branch: feat/task-web-board-hierarchy-view
parent: story-board-hierarchy-grouping
labels: [ui, board]
created: "2026-10-14"
updated: "2026-10-14"
worktree_path: /home/arggon/Projects/ArggonManager-task-web-board-hierarchy-view
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-board-hierarchy-grouping/task-web-board-hierarchy-view.md
  Leaves live only under a story. id is the filename stem: task-web-board-hierarchy-view.
  CLI `arggon create task web-board-hierarchy-view` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board: grouped ancestry view (initiative → epic → story → leaf) in the served board

## Context

Parent story `story-board-hierarchy-grouping` (PO requirement 2026-10-14). Implementation home: `cli/src/board.ts` (page render, `groupBy` prototype, the `drawer`/lens machinery) + `cli/src/board-serve.ts`; the served page's filter round-trips through the URL hash; `--group-by milestone|story` exists as within-column grouping and its enum is documented in README + the board's `json-output.md` contract. The OpenCode panel's `boardTreeLines` is the reference for a readable ancestry tree. The ZCode `/arggon-board` path serves the same board and should inherit the fix (verify, do not assume).

## Acceptance

- [x] `arggon board --serve` (and the static export) can render the grouped ancestry view: every leaf under its story, story under epic, epic under initiative, each level carrying id + status; the selection mechanism (a `--group-by` value and/or an in-page control) is decided and recorded
- [x] The filter lens applies within the view and the `N of M` counts stay honest; the existing `milestone|story` grouping keeps working or is deliberately folded in (decision recorded); `--tui` combination rules stay honest
- [x] Orphans and partial chains render honestly (no dead links, no silently missing sections); XSS-safe through the existing escape path; axe WCAG A/AA scan green
- [x] Docs travel: README board section + `ArggonManager/docs/json-output.md` board contract updated additively
- [x] Browser-drive evidence per ADR 0008 (Playwright CLI or the repo's established UI-smoke path): the view renders, toggling round-trips, the lens filters within it — expected vs observed on the item; if browser tooling is unavailable, say so and use the strongest available gate, never claiming an unrun probe
- [x] `arggon validate`, affected suites, `npm test`, CI `ui-smoke` green; prettier clean on touched files

## Notes

### 2026-10-14 @ses_ec55cfa05ffeH351ZF7kM1XOT0
### 2026-10-14 @arggon-maker (task-web-board-hierarchy-view)

decision — selection mechanism (recorded): the grouped-ancestry view is selected by a new `--group-by tree` value (generation-time default) **and** by an in-page `grouped ancestry` toggle in the filterbar that exists on EVERY board (static export and `--serve` alike, no server needed) — the PO asked the board to SHOW this, so a hidden flag alone would not do. The choice round-trips through the URL hash (`#view=tree`, written only when it differs from the generated default), beside the lens's `#filter=`. `--group-by milestone|story` keep their within-column grouping unchanged (kept, not folded in); `--tui` keeps refusing `--group-by` as a whole, unchanged.

shape — every board carries both layouts; `--group-by tree` only decides which one the page OPENS in. The tree is a nested list of the recorded `parent` chains (initiative → epic → story → leaf; the shared view-model's `treeEntries` rebuilt into a tree by depth), each row carrying type badge + id + status chip, plus priority/assignee/open-deps badge on the rows that have them. Recorded `parent` edges are the only hierarchy source. Read-only by design (no anchors at all → a dangling parent can never become a dead link): moves, drag-and-drop, the drawer and the live PR overlay stay in the columns view, one toggle away.
lens semantics: matches stay plus their ancestor path marked `.context` (muted); a non-matching subtree hides whole (never an orphaned visible row); `N of M` and the tree heading count MATCHES, never context rows.
cost (measured, documented in README): tree markup ≈490 B/item — 313 KiB for this tracker's 657 items, ≈29% of the board page, linear in item count.

files: cli/src/board.ts (boardTreeRoots, renderBoardTree, boardTreeDisplay, wireBoardView + page markup/CSS/script), cli/src/board-serve.ts, cli/src/cli.ts, cli/src/board.test.ts (+19 cases), cli/src/board-serve.test.ts, cli/src/milestone.test.ts, e2e/board.smoke.spec.ts (+3 @smoke cases, 2 new axe-scanned states), README.md, CONTRIBUTING.md, ArggonManager/docs/json-output.md, ArggonManager/docs/engineering.md.

gates (worktree, commit 49fb11f3): build exit 0 (lib + tsc + typecheck + e2e tsc; plugin bundle unchanged) · npm test 157 files / 3416 tests passed · affected board suites 6 files / 189 tests passed · lint clean · test:structure 5/5 · lint:structure clean · arggon validate ok (0 warnings, convention v5) · prettier --check clean on all 11 touched files · CI ui-smoke path: npx playwright test --grep @smoke 36/36 passed (two full-lane runs) · npm run smoke:tui-board passed.

browser-drive evidence, expected vs observed:
- @smoke fixture, chromium, served board: cascade `--group-by story`/summary/toggle cases unchanged 36/36.
- static `board --group-by tree` export (file://): main.board hidden / #board-tree visible (observed), one .tree-node per `arggon list` item, chain board-smoke > core > entries > task-board-task nested (observed 1 chain match), row status chip `todo` (observed), axe scan green on this state.
- toggle round-trip (served): columns↔tree swapped (observed), aria-pressed false→true, hash `#view=tree` (observed), reload keeps the tree (observed), toggle back → columns visible + .board .card = all items + hash `""` (observed).
- lens inside the tree (served): `label:detail` → 4 visible nodes (1 match + 3 context), match never `.context`, `1 of N item(s)`, tree heading `1`, axe scan green on this state; `label:does-not-exist` → 0 rows and `0 of N item(s)`.
- real-data probe (this repo's tracker, 657 items; served 127.0.0.1 + file:// export; standalone Playwright/Chromium drive): 25/25 checks. Observed: static tree = 657 nodes; my own chain initiative arggon-manager > epic ui > story story-board-hierarchy-grouping > task task-web-board-hierarchy-view nested (count 1) with chip `in_progress`; 0 anchors in the tree; served toggle + reload round-trip; `label:board` → 17 matches + 6 context = 23 visible rows (expected computed from `arggon list --json` with the same rule), `17 of 657 item(s)`, tree count 17, unrelated `story-adapter-selection` hidden whole; after switching back the hash is `#filter=label%3Aboard` (view param dropped because it equals the default); 0 page errors.

CLI surface observed: `board --group-by tree --json` → `{"groupBy":"tree",...}`; `board --group-by bogus --json` → `unknown --group-by field 'bogus' (supported: milestone, story, tree)`; `board --tui --group-by tree --json` → unchanged honest refusal.

ZCode `/arggon-board` (verified, not assumed): `.zcode-marketplace/arggon/commands/arggon-board.md` runs `arggon board --serve`, and the seam contains no board renderer (grep for renderBoardHtml/renderBoardTree → none), so that path serves the same page and inherits the toggle and `--group-by tree` with no change.

observations (not defects of this change): (1) the `@smoke` "column headers stick to the viewport top" test failed once in a full-lane run with `Execution context was destroyed` — the SSE reload landing in its un-retried settle poll, the exact flake its own comment describes; it passed in isolation and on two subsequent full-lane runs. Report-only, not filed. (2) pre-existing: the `--serve` JSON envelope does not echo `groupBy` while the static envelope does; left unchanged.

### handoff 2026-10-14 @ses_ec55cfa05ffeH351ZF7kM1XOT0 (session: ses_ec55cfa05ffeH351ZF7kM1XOT0) — next: Standards review + verifier probes on 676ce14e/49fb11f3, then merge (no squash; the branch carries a tracker commit) and flip done per the live checklist
- branch: feat/task-web-board-hierarchy-view
- open questions: SSE flake in the sticky-header @smoke settle poll (report-only); serve envelope still omits groupBy; tree markup always-on (+29% page) — flag-gating is the recorded lever if review prefers it

### 2026-10-14 @ses_ec55cfa05ffeH351ZF7kM1XOT0
### 2026-10-14 @arggon-maker — CI on PR #814 (addendum)

CI run 38577687986 on feat/task-web-board-hierarchy-view: **cli success, ui-smoke success** (both jobs green on the pushed head). The local full-lane runs of `npx playwright test --grep @smoke` reported above: 36/36, 36/36, then 36/36 again in the final committed-state verification; the sticky-header test failed twice locally across five full-lane runs with the SSE-settle race its own comment describes ("Execution context was destroyed" in the un-retried settle poll; it is not one of this item's tests and CI's ui-smoke job is green on this head). Suggested follow-up if the lead wants it filed: extend that bounded retry to the settle poll — reported, not filed, per maker scope.
