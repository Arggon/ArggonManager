---
type: bug
status: todo
id: bug-tree-ignores-hide-terminal-toggle
title: "Tree view ignores the filterbar 'hide done/cancelled' toggle (a columns-only control) — 574 terminal rows stay visible"
parent: story-board-hierarchy-grouping
labels: [ui, board]
created: "2026-10-14"
updated: "2026-10-14"
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
