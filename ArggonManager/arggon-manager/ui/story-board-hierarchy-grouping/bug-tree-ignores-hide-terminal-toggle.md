---
type: bug
status: in_progress
id: bug-tree-ignores-hide-terminal-toggle
title: "Tree view ignores the filterbar 'hide done/cancelled' toggle (a columns-only control) — 574 terminal rows stay visible"
assignee: arggon-delivery-lead
branch: fix/bug-tree-ignores-hide-terminal-toggle
parent: story-board-hierarchy-grouping
labels: [ui, board]
created: "2026-10-14"
updated: "2026-10-14"
claimed_at: "2026-10-14T14:43:42.066Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-tree-ignores-hide-terminal-toggle
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/story-board-hierarchy-grouping/bug-tree-ignores-hide-terminal-toggle.md
  Leaves live only under a story. id is the filename stem: bug-tree-ignores-hide-terminal-toggle.
  CLI `arggon create bug tree-ignores-hide-terminal-toggle` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Tree view ignores the filterbar 'hide done/cancelled' toggle (a columns-only control) — 574 terminal rows stay visible

## Context

Found by the product owner 2026-10-14 while testing \`arggon board --group-by tree\`. Reproduced live on the served board (Chromium probe, this repo's tracker): the tree renders 660 nodes with 574 done/cancelled rows visible; clicking the filterbar **hide done/cancelled** toggle flips its label and \`aria-pressed\` but leaves every terminal row visible. In the columns view the same toggle correctly hides the \`done\` and \`cancelled\` columns.

Cause: \`wireBoardColumns\` (\`cli/src/board.ts\` ~L1588) applies \`terminal-hidden\` to \`.column\` elements only; the tree (\`renderBoardTree\` / \`refreshTree\`) has no terminal-hiding path. This is a **layout preference**, not a lens (in the columns view the counts do not change when terminal columns hide) — the tree should follow the same semantic, not the lens's count.

## Acceptance

- [ ] With **hide done/cancelled** ON, the tree hides terminal-status rows live (no reload), and the toggle state stays consistent; OFF restores them
- [ ] A terminal row that is the ancestor path (context) of a visible match stays visible (muted) — the "nothing visible is ever orphaned" rule holds in the tree; a tree with everything hidden renders honestly (empty state), not a blank gap
- [ ] Counts (\`N of M\`, the tree heading) remain the lens verdict, unchanged by the layout toggle (consistent with the columns view)
- [ ] The preference persists/round-trips with the existing localStorage state and the reset control restores it; static export and \`--serve\` behave the same
- [ ] The reproducer becomes a pinned test (e2e \`@smoke\` case and/or unit); the README board section documents the toggle's tree behavior
- [ ] \`arggon validate\`, affected suites, \`npm test\`, CI \`ui-smoke\` green; prettier clean on touched files

## Notes

### 2026-10-14 @ses_ec520aa7effeTzFI7Qxree2Q7l
### Fix evidence (maker, 2026-10-14) — PR #815

**Mechanism.** `wireBoardColumns` owned the layout state but applied `terminal-hidden` to `.column` elements only. It now applies the same preference to `#board-tree` via a subtree-aware bottom-up pass over the rendered nesting (reverse pre-order), and returns `{ syncTree }` which the lens refresh calls after re-marking `.filtered-out`/`.context`:

- terminal row with no layout-visible descendant -> `.terminal-hidden` (`display:none`, composes with the lens: hidden by either stays hidden);
- terminal row with a layout-visible descendant -> stays, muted as `.terminal-context` (same dim surface as `.context`), so "nothing visible is ever orphaned" holds in the tree;
- tree with no visible row left -> `.tree-empty` renders the columns' `—` empty state, never a blank gap;
- counters untouched: `N of M`, per-column counts and the tree heading stay the lens verdict.

**Real-browser drive (Chromium; this repo's tracker, 661 nodes).** Reproducer: `node /tmp/opencode/tree-terminal-probe-fix.mjs <url>` (adapted from the item's probe, `#view=tree`, click `#board-terminal-toggle`, sample visible/terminal/context rows + counts + columns).

| server | expected (after click) | observed before click | observed after click |
| --- | --- | --- | --- |
| main @8137 (pre-fix, still serving) | terminal rows hide | 661 visible / 574 terminal | **661 visible / 574 terminal** (only label flips — the bug) |
| branch (this worktree, served) | terminal rows hide; context kept | 661 visible / 574 terminal | **104 visible / 557 terminal-hidden / 17 terminal-context** |

Counts identical in both runs (`661 item(s)`, tree heading `661`); columns view hides `done`+`cancelled` with unchanged per-column counts; 0 page errors both runs.

**Pinned tests.** 3 e2e `@smoke` cases in `e2e/board.smoke.spec.ts` (dedicated fixture: cancelled story with an open child, done leaf, parentless cancelled initiative): hide/restore + context retention + localStorage persistence + reset + count invariance across both layouts; lens composition + all-hidden empty state; static export `file://` parity (axe-scanned). Unit pins in `cli/src/board.test.ts` (tree CSS, embed call site `var boardColumns = …`, embedded `syncTree`/return handle). README board section documents the toggle's tree behaviour.

**Gates (all green locally).** `npm run build`; `npm test` 157 files / 3423 tests; `npm run lint`; `npm run test:structure`; `npm run arggon -- validate`; `npx prettier --check` on touched files; `npx playwright test --grep @smoke` 39 passed (run alone). CI `ui-smoke` on PR #815 still pending — the lead should verify that before ticking row 6.
