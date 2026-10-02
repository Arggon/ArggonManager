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

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] Both surfaces print the same baseline date for the same baseline figure, sourced from one constant/file
- [ ] A test asserts the two surfaces agree (date + figure), so the labels cannot drift apart again

## Notes
