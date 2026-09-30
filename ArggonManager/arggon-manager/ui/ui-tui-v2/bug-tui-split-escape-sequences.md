---
type: bug
status: done
id: bug-tui-split-escape-sequences
title: TUI key parser treats a chunk-split CSI sequence as Esc (filter cleared mid-paging)
assignee: Arggon
branch: fix/bug-tui-split-escape-sequences
parent: ui-tui-v2
labels: [tui, ui]
priority: p3
created: "2026-09-23"
updated: "2026-09-30"
worktree_path: /home/arggon/Projects/ArggonManager-bug-tui-split-escape-sequences
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-tui-v2/bug-tui-split-escape-sequences.md
  Leaves live only under a story. id is the filename stem: bug-tui-split-escape-sequences.
  CLI `arggon create bug tui-split-escape-sequences` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# TUI key parser treats a chunk-split CSI sequence as Esc (filter cleared mid-paging)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

## Notes

### 2026-09-23 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Reported by the `bug-tui-selection-offscreen` worker during wave 1 (non-blocking observation): the key splitter in `runTuiBoard`/`splitKeys` handles whole CSI sequences only within a single stdin chunk. If a terminal (or a pty bridge, or paste) delivers `\x1b` and the rest (`[6~`, `[H`, …) in separate chunks, the lone trailing `ESC` is consumed as the Esc key — which clears the active filter and closes an open search prompt — and the following `[6~` bytes decay into unknown single keys. PgDn/Home/End are now first-class keys (PR #405), so the blast radius grew.

Pre-existing behavior (the original parser had the same per-chunk assumption), kept deliberately out of the wave-1 fix to hold scope.

## Acceptance

- [x] A stateful decoder buffers an incomplete trailing escape sequence across chunks instead of consuming it as Esc; a genuinely lone `ESC` still acts as Esc when no continuation follows
- [x] Regression test: a PgDn (or Home/End) split across two `onData` chunks scrolls instead of clearing the filter; a lone `ESC` keeps its current semantics
- [x] No regression in the existing key tests or the pty frame check (`npm run smoke:tui-board`)
- [x] pty evidence in the verdict (split-key scenario reproduced before/after)

### 2026-09-30 @Arggon
Implemented on fix/bug-tui-split-escape-sequences, PR #469 (ready).

Evidence:
- Before (fix stashed, old dist, new smoke): pty step 'pane held open at row 1 while the CSI is incomplete' FAILed — partial \x1b[6 consumed as Esc, pane closed.
- After: all 8 pty steps ok; split PgDn scrolled one page; board returned with filter intact (npm run smoke:tui-board).
- Gates: npm test 107 files/1789 tests ok; lint clean; build clean; arggon validate ok:true.
- New: createTuiKeyDecoder (stateful chunk splitter) + TUI_ESCAPE_FLUSH_MS=50 esc-flush timer in runTuiBoard; 6 decoder + 3 loop unit tests in cli/src/tui.test.ts.
- Note: one pre-existing loop test's beat extended past the flush window (lone ESC is now held ~50ms by design); comment left in test.

### handoff 2026-09-30 @Arggon — next: Review+merge PR #469 (merge, never squash). Then task-tui-live-refresh will touch the same loop in cli/src/tui.ts (re-read/sync helpers).
- branch: fix/bug-tui-split-escape-sequences
