---
type: task
status: todo
id: task-opencode2-plugin-parser-residuals
title: "Plugin parser residuals: SHELL_SYNTAX_IN_PATH false negatives, odd-backslash heads, residual pins"
priority: p3
parent: opencode2-hardening
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-opencode2-plugin-parser-residuals.md
  Leaves live only under a story. id is the filename stem: task-opencode2-plugin-parser-residuals.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin parser residuals: SHELL_SYNTAX_IN_PATH false negatives, odd-backslash heads, residual pins

## Context

Findings 1–3 from the independent review of PR #358
(`task-opencode2-plugin-escape-nits`).

- **New conservative false negatives.** `SHELL_SYNTAX_IN_PATH` rejects `#`,
  `!`, glob chars and empty components, but those are literal in unquoted (or
  quoted) words and `//` collapses: `dir#x/arggon`, `'dir*x/arggon'`,
  `dir!x/arggon`, `a//b/arggon` all execute in bash yet are `undefined` now
  (were `task-x`). Narrow the class to characters that actually break path
  semantics (quotes/backslash/whitespace/`$`/backtick/grouping) or document.
- **Odd-backslash heads (pre-existing).** `\\\(arggon …` (3) and `\\\\\(arggon
  …` (5) still correlate though bash exits 2 (nothing runs); extend the
  word-marking or document the residual.
- **Residual wording/pins.** The item's "unchanged" note is wrong: `\\( (arggon
  …)` changed `undefined`→`task-x` and bash syntax-errors. Pin the residual
  class (`\\( (…)`, `echo (…)`, `\\((…))`) with tests and fix the wording.

## Acceptance

- [ ] The four false-negative forms correlate again (or the narrower class is
      documented) with tests; no regression of the true positives or the
      #337/#345/#352/#356/#358 eliminations.
- [ ] Odd-backslash heads fixed or documented; residual pins added.
- [ ] Full suite + `smoke:opencode` green; small PR to `opencode2`.

## Notes

- Miss-only or contrived; the plugin's declared bias (misses harmless, FPs not)
  makes this low priority.
