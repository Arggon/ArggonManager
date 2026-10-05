---
type: task
status: todo
id: task-state-exploration-stopping-rule
title: "Write down the ADR 0017 exploration stopping rule (AutoContext: the Planner is the load-bearing component — 95%→40% without it)"
parent: harness-research-transfer
labels: [methodology, research, exploration]
priority: p3
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-state-exploration-stopping-rule.md
  Leaves live only under a story. id is the filename stem: task-state-exploration-stopping-rule.
  CLI `arggon create task state-exploration-stopping-rule` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Write down the ADR 0017 exploration stopping rule (AutoContext: the Planner is the load-bearing component — 95%→40% without it)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

F6 of [exploration-021](../../../docs/explorations/exploration-harness-research-transfer-021.md),
from [AutoContext (arXiv:2510.02369v3)](https://arxiv.org/abs/2510.02369v3).

AutoContext's ablation on TextWorld, ReAct + AutoContext = 95%:

| variant | TextWorld |
| --- | --- |
| full | **95 ± 2** |
| w/o TODO forest | 51 ± 5 |
| **w/o Planner** | **40 ± 3** |
| w/o Extractor | 81 ± 4 |
| plain ReAct | 37 ± 5 |

The **Planner is the load-bearing component** — removing it costs more than removing the
data structure. The Planner is what decides *when coverage is sufficient to stop
exploring*. In other words the stop condition, not the representation, is most of the
value.

Our six-phase protocol ([ADR 0017](../../../docs/adr/0017-greenfield-work-exploration-first.md))
has exactly this shape — *frontier rounds* and an *edge-case hunt* — and its stopping
condition is currently an unstated judgement call by whichever agent is running it. This
item writes the rule down. It does **not** adopt a TODO forest, a knowledge graph, or any
generated context artifact.

## Acceptance

- [ ] States the stop condition as a **checkable rule**, in `references/exploration.md`'s
      own language, with the phase it belongs to
- [ ] Says what *ends* a frontier round and what *ends* the hunt — the two are currently
      indistinguishable in the protocol's prose
- [ ] Names the failure it prevents (stopping early and shipping a spec over a live
      unknown, versus grinding rounds over a closed space) — a rule with no failure mode is
      a slogan
- [ ] Survives **domain neutrality** (ADR 0021 §6.2): the rule must not presuppose a
      software repo, a file tree, or a test suite
- [ ] Does not add a gate, a new command or a new blocking step — this is advice to the
      agent doing the exploration, not machinery
- [ ] Keeps ADR 0017's hard gate intact: no implementation task before a spec with clean
      `spec analyze`
- [ ] `arggon validate` green; PR opened. Impact class **Advisory**
- [ ] `spec validate` + `spec analyze` green, with no NEW finding naming this item
