---
type: task
status: todo
id: task-spike-cross-run-lesson-store
title: "Spike: a durable cross-run lesson store — keep what we learned, discard the dead ends (the one idea worth taking from autoctx)"
parent: external-harness-evaluation
labels: [methodology, evaluation, spike]
priority: p2
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/external-harness-evaluation/task-spike-cross-run-lesson-store.md
  Leaves live only under a story. id is the filename stem: task-spike-cross-run-lesson-store.
  CLI `arggon create task spike-cross-run-lesson-store` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: a durable cross-run lesson store — keep what we learned, discard the dead ends (the one idea worth taking from autoctx)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

The one adoptable idea from [ADR 0022](../../../docs/adr/0022-decline-autoharness-autocontext-autocompact.md)
(F6 of [exploration-020](../../../docs/explorations/exploration-autoharness-autocontext-autocompact-020.md)).

`autoctx`'s distinguishing move is **keeping the lessons and discarding the dead ends across
runs**. ArggonManager has no equivalent:

- retrospectives are **per-item** — a comment or a handoff scoped to one item's next step
- `arggon report --trend` mines completions and cycle time, not lessons
- `ArggonManager/docs/labs/telemetry-mining.md` is a *protocol* for mining friction
  signatures after the fact, not a store
- `adopter-feedback/` is a channel
- ADR 0017's greenfield protocol produces exactly this kind of knowledge **per exploration**
  and then does not carry it forward

So the gap is real: **nothing survives the item**. The second agent on a similar problem
re-derives what the first one learned.

This is a **spike**, not a build: the deliverable is a decision about whether a lesson store
earns its keep on our own substrate, with the bar ADR 0022 set — it must not become a second
loop, a second executor outside the permission perimeter, or a generated moving part in the tree.

**Deliberately not scoped here:** adopting `autoctx` to get this for free. ADR 0022 rejected
that; this re-derives the idea on our substrate so the comparison is honest.

## Acceptance

- [ ] Classified first (spike / bounded / greenfield) with the ratchet recorded — if the design turns out to be a new subsystem others depend on, it is **greenfield** and goes through the six-phase protocol
- [ ] States the **gap** before any design: the concrete question "what does an agent do today that it would do differently if last run's lesson were on the item?" — a design that cannot answer that is rejected
- [ ] Evaluates at least three shapes against ADR 0022's bar: (a) a lessons section in the item body,
      (b) a per-area note file the agent must read before claiming, (c) a `docs/labs`-style
      synthesized playbook promoted by a human
- [ ] **Decides where the lesson lives so it travels**: ADR 0006's context budget applies —
      anything added to an item or to always-loaded context is paid every session, so a
      bounded size and a `doctor --budget`-style measurement are part of the answer, not an afterthought
- [ ] Accounts for **staleness**: a lesson store rots the way `playbook status` rots (90-day threshold). Either it inherits that mechanism or it names why not
- [ ] Accounts for **contradiction**: two items learning opposite lessons from one area, and a lesson that stops being true after a change. ADR 0016's propose/absorb channel is the obvious mechanism to evaluate
- [ ] Answers the falsifiable question ADR 0022 set: *if this spike shows no value, is that evidence to revisit `autoctx`?* — decide it now, while nobody is invested
- [ ] Recommendation with trade-offs; if greenfield, a spec + `spec analyze` clean before any implementation task (ADR 0017)
- [ ] ADR only if the answer changes a carrier, gate or command
- [ ] `arggon validate` + `spec validate` green; `spec analyze` reports no NEW finding naming this item
