---
type: bug
status: todo
id: bug-context-report-baseline-date-mismatch
title: Context-budget baseline is labeled 2026-09-15 in context-report and 2026-09-29 in doctor --budget for the same MCP figure
parent: methodology-improvements
labels: [context-budget]
created: "2026-10-02"
updated: "2026-10-02"
---

<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-context-report-baseline-date-mismatch.md
  Leaves live only under a story. id is the filename stem: bug-context-report-baseline-date-mismatch.
  CLI `arggon create bug context-report-baseline-date-mismatch` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Context-budget baseline is labeled 2026-09-15 in context-report and 2026-09-29 in doctor --budget for the same MCP figure

## Context

The same MCP baseline figure is printed under two different dates. `cli/src/measure.ts:50-57` owns the figure: `MCP_TOOLS_BASELINE_BYTES = 15_701`, with the comment recording 9,040 B / 9 tools at `5d6c504` (2026-09-15) and 15,701 B / 15 tools at the ADR 0014 full-surface re-baseline (2026-09-29); the `doctor --budget` line at `cli/src/measure.ts:352` labels it `(2026-09-29, ADR 0014 re-baseline)`. `smoke/context-report.ts:502` reuses that same constant (`baselineBytes: MCP_TOOLS_BASELINE_BYTES`), so the figure agrees — but its human line at `:709` hardcodes `(live baseline ..., 2026-09-15)`. Repro: `npx arggon doctor --budget` (or `--json --budget`) prints 2026-09-29 for the live baseline while `npm run context:report` (`package.json:33` → `tsx smoke/context-report.ts`) prints 2026-09-15 for the same `baselineBytes`.

## Acceptance

- [ ] Both surfaces print the same baseline date for the same baseline figure, sourced from one constant/file
- [ ] A test asserts the two surfaces agree (date + figure), so the labels cannot drift apart again

## Notes
