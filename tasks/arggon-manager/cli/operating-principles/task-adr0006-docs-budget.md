---
type: task
status: todo
id: task-adr0006-docs-budget
title: "ADR 0006: generated-docs context budget (AGENTS.md <=2KB) + SKILL.md dedup"
parent: operating-principles
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-adr0006-docs-budget.md
  Leaves live only under a story. id is the filename stem: task-adr0006-docs-budget.
  CLI `arggon create task adr0006-docs-budget` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0006: generated-docs context budget (AGENTS.md <=2KB) + SKILL.md dedup

## Context

Implements the generated-docs part of accepted [ADR 0006](../../../docs/adr/0006-token-context-efficiency.md): a fresh `init --full` emits ~43.7 KB (~10.9k tokens) of fixed reads per session; SKILL.md is 37% of the tree and duplicated at `skills/` + `.agents/`; the generated AGENTS.md is 3.7 KB against a <=2 KB budget. SPEC FIRST for the budget mechanism.

## Acceptance

- [ ] Context budget defined and enforced: generated AGENTS.md <=2 KB (pointers over inline rules), SKILL.md deduplicated in-tree (single copy or generated-on-demand instead of two committed 16 KB copies), budget asserted by a test so it cannot regress silently
- [ ] init-docs tests updated for the new shape; doctor reporting unchanged (0 modified / 0 drifted for adopters)

## Notes
