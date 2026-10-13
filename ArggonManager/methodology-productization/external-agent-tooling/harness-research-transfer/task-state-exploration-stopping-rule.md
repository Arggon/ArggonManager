---
type: task
status: in_progress
id: task-state-exploration-stopping-rule
title: "Write down the ADR 0017 exploration stopping rule (AutoContext: the Planner is the load-bearing component — 95%→40% without it)"
assignee: arggon-delivery-lead
branch: feat/task-state-exploration-stopping-rule
parent: harness-research-transfer
labels: [methodology, research, exploration]
priority: p3
created: "2026-10-05"
updated: "2026-10-13"
claimed_at: "2026-10-13T13:29:20.235Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-state-exploration-stopping-rule
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-state-exploration-stopping-rule.md
  Leaves live only under a story. id is the filename stem: task-state-exploration-stopping-rule.
  CLI `arggon create task state-exploration-stopping-rule` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Write down the ADR 0017 exploration stopping rule (AutoContext: the Planner is the load-bearing component — 95%→40% without it)

## Context

F6 of [exploration-021](../../../docs/explorations/exploration-harness-research-transfer-021.md),
from [AutoContext (arXiv:2510.02369v3)](https://arxiv.org/abs/2510.02369v3).

AutoContext's ablation on TextWorld, ReAct + AutoContext = 95%:

| variant         | TextWorld  |
| --------------- | ---------- |
| full            | **95 ± 2** |
| w/o TODO forest | 51 ± 5     |
| **w/o Planner** | **40 ± 3** |
| w/o Extractor   | 81 ± 4     |
| plain ReAct     | 37 ± 5     |

The **Planner is the load-bearing component** — removing it costs more than removing the
data structure. The Planner is what decides _when coverage is sufficient to stop
exploring_. In other words the stop condition, not the representation, is most of the
value.

Our six-phase protocol ([ADR 0017](../../../docs/adr/0017-greenfield-exploration-gate.md))
has exactly this shape — _frontier rounds_ and an _edge-case hunt_ — and its stopping
condition is currently an unstated judgement call by whichever agent is running it. This
item writes the rule down. It does **not** adopt a TODO forest, a knowledge graph, or any
generated context artifact.

## Acceptance

- [ ] States the stop condition as a **checkable rule**, in `references/exploration.md`'s
      own language, with the phase it belongs to
- [ ] Says what _ends_ a frontier round and what _ends_ the hunt — the two are currently
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

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

F6 of [exploration-021](../../../docs/explorations/exploration-harness-research-transfer-021.md),
from [AutoContext (arXiv:2510.02369v3)](https://arxiv.org/abs/2510.02369v3).

AutoContext's ablation on TextWorld, ReAct + AutoContext = 95%:

| variant         | TextWorld  |
| --------------- | ---------- |
| full            | **95 ± 2** |
| w/o TODO forest | 51 ± 5     |
| **w/o Planner** | **40 ± 3** |
| w/o Extractor   | 81 ± 4     |
| plain ReAct     | 37 ± 5     |

The **Planner is the load-bearing component** — removing it costs more than removing the
data structure. The Planner is what decides _when coverage is sufficient to stop
exploring_. In other words the stop condition, not the representation, is most of the
value.

Our six-phase protocol ([ADR 0017](../../../docs/adr/0017-greenfield-work-exploration-first.md))
has exactly this shape — _frontier rounds_ and an _edge-case hunt_ — and its stopping
condition is currently an unstated judgement call by whichever agent is running it. This
item writes the rule down. It does **not** adopt a TODO forest, a knowledge graph, or any
generated context artifact.

## Acceptance

- [ ] States the stop condition as a **checkable rule**, in `references/exploration.md`'s
      own language, with the phase it belongs to
- [ ] Says what _ends_ a frontier round and what _ends_ the hunt — the two are currently
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

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K

Correction to the Context comment above: the ADR 0017 link resolves to the wrong
filename. Correct path from this item's directory:

`../../../docs/adr/0017-greenfield-exploration-gate.md`

(not `…0017-greenfield-work-exploration-first.md`). The item's argument is unchanged.

Other links in the Context comment resolve: `exploration-harness-research-transfer-021.md`
and `adr/0022-decline-autoharness-autocontext-autocompact.md` both exist.

### 2026-10-13 @arggon-maker
### Evidence — stopping rule written; PR #771 (impact class: Advisory)

Carrier: `skills/arggon-cli/references/exploration.md` (ADR 0017 six-phase protocol). Impact class
**Advisory** per `ArggonManager/docs/agents.md` §Changing the methodology itself — wording/structure
only; no rule, gate, command contract or pipeline step changed.

**The rule as written.**

- Ends a frontier round (Phase 3): "no question remains that is askable now (prerequisites settled)
  and still unsettled — if you can name one, the round has a next move."
- Ends the hunt (Phase 4): "The hunt ends when a whole pass over the dimensions raises no case that
  is not already resolved: every row carries a terminal resolution and a fresh read of the
  dimensions finds nothing new. A pass that adds nothing ends the hunt; passes beyond it are not
  evidence of coverage."
- The stops are now different tests: round-end = **questions exhausted**; hunt-end = **design
  closed** (a full pass stops changing it). Failure modes named: a round stopped early ships a spec
  over a live unknown that resurfaces as rework (the failure ADR 0017 exists to prevent); a hunt run
  past the empty pass never converges, at the protocol's cost.
- Phase 5's hard gate (no implementation task before the spec exists and `arggon spec analyze`
  reports no NEW findings) is explicitly unchanged — a closed hunt is readiness to write the design
  down, not permission to implement.
- Domain-neutral (ADR 0021 §6.2): questions / cases / dimensions / resolutions — no repo, file tree
  or test suite. Advice, not machinery: no gate, command or blocking step added.

**Gates (worktree, branch `feat/task-state-exploration-stopping-rule`).**

- `npm run arggon -- validate` → ok (0 warnings, convention v5)
- `npx vitest run cli/src/skill-copy.test.ts` → 8/8 passed
- `npm run skills:sync` → 7 files; `.agents/skills/arggon-cli/references/exploration.md` byte-equal
  to the source after the generated marker
- `npx prettier --check skills/arggon-cli/references/exploration.md` → clean
- `npm run arggon -- spec validate` → ok (38 docs, 0 warnings)
- `npm run arggon -- spec analyze` → 4 findings, the findings list byte-identical to the pre-change
  baseline; none names this item
- `npm test` not run — docs-only change, no executable behavior touched

**Notes.** `.agents/skills/**` is gitignored here (single committed source; derived copies
regenerated by `npm run skills:sync` / the parity test), so the commit is source-only and there is
no tracked sync copy to stage — byte-equality is verified above. The acceptance checklist is
deliberately left unticked for the delivery lead/reviewer. Two environment observations, not defects
of this change: (1) `tools.arggon.show` resolves the **main checkout** and still reports this item
`todo` / unclaimed although the claim is committed on this branch (2cfcaafb); (2) a project
auto-harness gate declined a read-only `arggon` tool call and demanded checkers under
`.opencode/checks/` — enforcement machinery is out of this item's scope, so I did not add it.

### handoff 2026-10-13 @arggon-maker — next: Review PR #771 (docs-only, impact Advisory) against the item's acceptance criteria; tick the live checklist and flip done after merge — full evidence in the comment above.
- branch: feat/task-state-exploration-stopping-rule
- open questions: checklist left unticked for the lead; tools.arggon.show reads main checkout (todo/unclaimed) despite the committed claim; auto-harness gate declined a read-only arggon call (out of scope)
