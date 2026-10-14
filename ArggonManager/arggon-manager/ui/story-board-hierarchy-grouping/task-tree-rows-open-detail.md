---
type: task
status: done
id: task-tree-rows-open-detail
title: "Tree interactions: open the detail drawer (click/keyboard) and compact/extend each subtree — the tree is read-only today"
assignee: arggon-delivery-lead
branch: feat/task-tree-rows-open-detail
parent: story-board-hierarchy-grouping
labels: [ui, board]
created: "2026-10-14"
updated: "2026-10-14"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-board-hierarchy-grouping/task-tree-rows-open-detail.md
  Leaves live only under a story. id is the filename stem: task-tree-rows-open-detail.
  CLI `arggon create task tree-rows-open-detail` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Tree rows open the detail drawer on click and keyboard (serve + static with --details) — the tree is read-only today

## Context

Product-owner requests 2026-10-14, while testing the freshly shipped grouped-ancestry view (`task-web-board-hierarchy-view`, PR #814):

1. **Clicking a row should show the item's details** — the drawer already exists (the columns view opens it on a card click; serve fetches `/api/item`, the static export embeds the payload behind `--details`), but the tree rows are deliberately read-only (no anchors), so clicking does nothing.
2. **Compact/extend each item** — every branch should fold and unfold (collapse/expand its subtree) so a 660-item tracker stays navigable.

Both live in the same tree code (`cli/src/board.ts`: `renderBoardTree`, the embedded client script around `refreshTree`/`wireBoardColumns`/`boardTreeDisplay`, plus `e2e/board.smoke.spec.ts`), so they are one item, one maker.

## Acceptance

- [x] Clicking a tree row opens the same detail drawer the columns view opens, for that item; serve and static-with-`--details` behave the same; a static export without `--details` offers no fake affordance (it stays honestly drawer-free)
- [x] Keyboard: rows are reachable (roving focus or equivalent) and Enter/Space opens the drawer; the subtree disclosure is keyboard-operable; axe scan green in the tree states
- [x] Each container row carries a compact/extend (collapse/expand) control: collapsing hides its subtree, expanding restores it; the state persists per browser like the columns' layout preference, and the existing reset restores the default
- [x] Composition is honest with the other tree mechanics: with a filter/lens active, a match inside a collapsed subtree stays discoverable (reveal the path to a match, or mark the collapsed branch as containing matches — decide and record); counts stay the lens verdict; terminal-hiding and the view toggle keep composing
- [x] The "no dead links" property is kept (no `href` navigation on rows; a missing parent stays marker text)
- [x] The requests become pinned tests (e2e `@smoke`: click→drawer, keyboard open, collapse/expand + persistence, the filter-inside-collapsed case; both modes where applicable); README documents the interactions
- [x] `arggon validate`, affected suites, `npm test`, CI `ui-smoke` green; prettier clean on touched files

## Notes

### 2026-10-14 @ses_ec4eaf180ffeataHU4UOHWtBdI
### 2026-10-14 maker (arggon-maker) — implementation + evidence, PR #816

**Mechanism (branch `feat/task-tree-rows-open-detail`)**
- `renderBoardTree(..., { interactive })`: container rows lead with a `–`/`+` disclosure (`aria-expanded`, named `<id> subtree`), leaves carry an aligned spacer; `interactive` (set from `details` = `--serve` or static `--details`) makes rows focusable + named like cards. Drawer-free export keeps inert rows; the tree still has **no anchors**.
- `wireBoardDetail`: delegated click/Enter/Space accept `.card, .tree-row`; the id comes from the enclosing `.tree-node` (one `data-id` per node); the row is the focus-restore target.
- `wireBoardKeyboardNav`: rows are a second roving surface — one tab stop, `↑`/`↓` in reading order (lens-hidden / terminal-hidden / folded-away skipped), `Home`/`End`; `ensureAnchor` seats the anchor in the visible layout.
- `wireBoardColumns`: fold state = `treeCollapsed` in the same `arggon-board-columns-v1` record (one key, one reset); fold is a display rule below the terminal verdict (a folded row the terminal rule keeps stays on screen); counters untouched.
- **Recorded decision (AC 4): mark, never auto-expand.** With a lens active, a folded branch holding matches shows `N matches inside` on the row and in the disclosure's accessible name (count = matched rows only, never context); a folded branch with no match and the no-lens case show no marker.

**Browser evidence — served fixture, same drive before/after (drive scripts in /tmp, not committed)**
- Before (pre-change dist): rows 4, toggles 0, `tabindex`/`role`/`data-id` null; row click → drawer hidden; Enter on a row → nothing (unfocusable).
- After: toggles 3 (containers); rows `role=group` roving; row click → drawer visible, title "Entries"; focused row + Enter/Space → drawer visible; Esc → row refocused; `entries` fold hides `task-evidence-task` and stores `{"collapsed":[],"terminalHidden":false,"treeCollapsed":["entries"]}`, survives reload; `filter=task-evidence-task` with the fold → marker "1 match inside", label "expand entries subtree — 1 match inside", counts stay "1 of 4" / "1"; expand reveals the match; `reset layout` + reload restores the default; `pageerror` list empty.

**Gates (all green)**
- `npm run build`; `npm test` 157 files / 3427 tests; `npm run lint`; `npm run test:structure`; `npm run arggon -- validate` (0 warnings, convention v5); `npx prettier --check` on every touched file.
- `npx playwright test --grep @smoke` **46 passed** (alone; new cases: serve click→drawer, keyboard open + roving, fold+persistence+reset+view-toggle, lens-inside-fold, static `--details` row drawer offline, drawer-free static honesty, terminal+fold composition). One **one-off flake** observed on the pre-existing "column headers stick to the viewport top" case (documented reload-storm sensitivity; passes alone and on re-runs) — recorded, not fixed here.

**Docs in the diff**: README (grouped-ancestry + column-controls + drawer + keyboard bullets, tree payload re-measured 662 items → ~565 B/item static), CONTRIBUTING § axe scanned states (six → twelve, this item's named), docs/json-output.md board section. Acceptance boxes ticked in this branch's copy of the item file.

### handoff 2026-10-14 @ses_ec4eaf180ffeataHU4UOHWtBdI (session: ses_ec4eaf180ffeataHU4UOHWtBdI) — next: Standards review on PR #816 (base main), then merge; verifier may re-run `npx playwright test --grep @smoke` alone — expect 46 passed.
- branch: feat/task-tree-rows-open-detail
- open questions: None blocking; one recorded one-off flake on the pre-existing sticky-header test (see comment).

### 2026-10-14 @ses_ec4eaf180ffeataHU4UOHWtBdI
### 2026-10-14 maker addendum — live-reload completion + final gates

While self-reviewing the composition, one gap surfaced that the acceptance list implies through the drawer's own contract ("a live reload preserves the open drawer"): the serve client's restore only re-clicked `.card[data-id]`, so a drawer opened from a **tree row** closed on the next tracker write (and this repo's served board reloads on every tracker change). Fixed in `cli/src/board-serve.ts` (commit `abb966c6`): the restore picks the opener of the **restored layout** — the visible layout's own path (tree row when the tree is shown, card otherwise) — and reads a row's id from its enclosing node. Pinned by `board-serve.test.ts` (selector pair) and by a new phase in the existing live-reload `@smoke` case (tree-opened drawer reopens through the row; Esc returns focus to the row).

**Final gates after the addendum**: `npm run build`; `npm test` **157 files / 3427 tests green** (three consecutive full runs); `npm run lint`; `npm run test:structure`; `npm run arggon -- validate` (0 warnings); `npx prettier --check` on every touched file; `npx playwright test --grep @smoke` **46 passed** (alone). Honest flake note: one full-suite run showed a single unreproduced failure whose name was not captured (three later runs green), beside the earlier one-off on the pre-existing sticky-header `@smoke` case — both recorded for the verifier rather than hidden.

The acceptance boxes stay ticked; PR #816 is the review surface.

### 2026-10-14 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-14 (delivery lead)
Merged as 3147d3d1 (PR #816); flipped by the lead (the auto-done flip was late/refused; rows were 7/7 ticked). Both PO requests are live: **rows open the detail drawer** (delegated click/Enter/Space, id read from the node; static --details draws offline, a drawer-free export keeps inert rows and no fake affordance; no anchors — the no-dead-links property holds) and **every container folds/unfolds** via a –/+ disclosure (aria-expanded, named subtree; leaves get an aligned spacer; state persists in the same arggon-board-columns-v1 preference and the reset restores it). Rows joined the keyboard roving surface (one tab stop, up/down in reading order skipping hidden/folded, Home/End). Recorded decision for lens-inside-fold: **mark, never auto-expand** (N matches inside, counts stay the lens verdict). Self-review catch fixed in-PR: the serve live-reload restore now re-opens a tree-opened drawer through the restored layout's own opener.
Evidence: 6 new + 1 extended @smoke cases (46 passed, run alone); axe-scanned states grew six to twelve; full suite 3,427 (3 runs); browser before to after on a served fixture; CI cli + ui-smoke green.
Notes: two honest flakes observed (one unreproduced single vitest, one on the pre-existing sticky-header case — already filed as bug-smoke-sticky-header-settle-retry); the maker briefly restarted the PO's :8137 server (restored, HTTP 200; the lead restarts it on the merged code for hand-testing).
