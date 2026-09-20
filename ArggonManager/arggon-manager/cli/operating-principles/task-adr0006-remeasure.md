---
type: task
status: done
id: task-adr0006-remeasure
title: "ADR 0006 re-measure: repeatable context-budget measurement vs live surfaces"
assignee: Arggon
branch: feat/task-adr0006-remeasure
parent: operating-principles
labels: [p2]
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

Candidate #10 of [product discovery](../../../docs/explorations/exploration-product-discovery-002.md) (ADR 0006 consequence): the token/context budgets were measured once (2026-09-14) and promised re-measurement after the directions landed. Compact envelopes, `show`, and the generated-docs budget are now live — without a repeatable measurement command the claim drifts. Effort S; principle: token-context (ADR 0006).

## Acceptance

- [x] A repeatable measurement surface lands (e.g. `arggon doctor --budget` or `arggon measure`): sizes the agent-facing surfaces (list payload, show output, init tree bytes, generated AGENTS.md) and reports against the ADR 0006 budgets
- [x] Measurements recorded in the item + a line appended to the ADR 0006 exploration doc (numbers vs the 2026-09-14 baseline)
- [x] Tests + docs (json-output/README if the command is new surface)

## Notes

DESIGN DECISION (documented per coordinator pre-read): chose the additive
`budget` section on `arggon doctor --budget` over a new `arggon measure`
command. Doctor is the report-only charter holder (exit 0, never writes to
the examined tree), and the budget section is exactly a report; gating it
behind `--budget` keeps plain `doctor` fast (the measurement spawns the CLI
in a throwaway temp tree). Implementation: `cli/src/measure.ts` (measurement
+ budget evaluation) surfaced through `doctor.ts`/`cli.ts`; no new top-level
command, so the MCP/command-name surface is untouched.

Measured 2026-09-15 (fixture = 8 items, 1 comment; method = 2026-09-14
baseline, `arggon doctor --json --budget`):

| Surface | Baseline (2026-09-14) | Re-measure (2026-09-15) | Budget check |
|---|---|---|---|
| generated AGENTS.md | 3,696 B | 2,043 B | <=2048 B: PASS (5 B headroom) |
| `list --json` compact (fixture) | n/a | 2,539 B | < `--full` (compact saving) |
| `list --json --full` (fixture) | baseline shape | 3,347 B | 808 B (~24%) compact saving |
| `show <id> --json` | unbounded fs read | 730 B | bounded (direction 3) |
| `init --full` tree total | 43,694 B | 51,813 B | no budget; tracked vs baseline |

Full comparison table in docs/explorations/exploration-token-context-efficiency-001.md
§Re-measurement (linked from ADR 0006 Consequences).

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. doctor --budget keeps the report-only charter while making ADR 0006 falsifiable — the baseline method is replicated exactly (temp tree always deleted, deterministic fixture, both compact and --full measured). The numbers themselves are the review finding: AGENTS.md at 2043/2048 (5 B headroom — fragile) and the init tree +18% (SKILL.md-dominated, un-budgeted). Both going to the backlog. Merge follows.
