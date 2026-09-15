---
type: task
status: todo
id: task-adr0006-remeasure
title: "ADR 0006 re-measure: repeatable context-budget measurement vs live surfaces"
parent: operating-principles
labels: []
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-adr0006-remeasure.md
  Leaves live only under a story. id is the filename stem: task-adr0006-remeasure.
  CLI `arggon create task adr0006-remeasure` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0006 re-measure: repeatable context-budget measurement vs live surfaces

## Context

Candidate #10 of [product discovery](docs/explorations/exploration-product-discovery-002.md) (ADR 0006 consequence): the token/context budgets were measured once (2026-09-14) and promised re-measurement after the directions landed. Compact envelopes, `show`, and the generated-docs budget are now live — without a repeatable measurement command the claim drifts. Effort S; principle: token-context (ADR 0006).

## Acceptance

- [ ] A repeatable measurement surface lands (e.g. `arggon doctor --budget` or `arggon measure`): sizes the agent-facing surfaces (list payload, show output, init tree bytes, generated AGENTS.md) and reports against the ADR 0006 budgets
- [ ] Measurements recorded in the item + a line appended to the ADR 0006 exploration doc (numbers vs the 2026-09-14 baseline)
- [ ] Tests + docs (json-output/README if the command is new surface)

## Notes
