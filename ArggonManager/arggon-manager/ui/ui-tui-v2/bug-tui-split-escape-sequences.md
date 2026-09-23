---
type: bug
status: todo
id: bug-tui-split-escape-sequences
title: TUI key parser treats a chunk-split CSI sequence as Esc (filter cleared mid-paging)
parent: ui-tui-v2
labels: [tui, ui]
priority: p3
created: "2026-09-23"
updated: "2026-09-23"
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

- [ ] 

## Notes

### 2026-09-23 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

Reported by the `bug-tui-selection-offscreen` worker during wave 1 (non-blocking observation): the key splitter in `runTuiBoard`/`splitKeys` handles whole CSI sequences only within a single stdin chunk. If a terminal (or a pty bridge, or paste) delivers `\x1b` and the rest (`[6~`, `[H`, …) in separate chunks, the lone trailing `ESC` is consumed as the Esc key — which clears the active filter and closes an open search prompt — and the following `[6~` bytes decay into unknown single keys. PgDn/Home/End are now first-class keys (PR #405), so the blast radius grew.

Pre-existing behavior (the original parser had the same per-chunk assumption), kept deliberately out of the wave-1 fix to hold scope.

## Acceptance

- [ ] A stateful decoder buffers an incomplete trailing escape sequence across chunks instead of consuming it as Esc; a genuinely lone `ESC` still acts as Esc when no continuation follows
- [ ] Regression test: a PgDn (or Home/End) split across two `onData` chunks scrolls instead of clearing the filter; a lone `ESC` keeps its current semantics
- [ ] No regression in the existing key tests or the pty frame check (`npm run smoke:tui-board`)
- [ ] pty evidence in the verdict (split-key scenario reproduced before/after)
