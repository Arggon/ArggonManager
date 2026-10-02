---
type: task
status: todo
id: task-spike-friction-trigger-compliance
title: "Spike: does an embedded trigger fire more reliably than a skill reference?"
parent: story-adopter-feedback
labels: [method, research]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-spike-friction-trigger-compliance.md
  Leaves live only under a story. id is the filename stem: task-spike-friction-trigger-compliance.
  CLI `arggon create task spike-friction-trigger-compliance` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: does an embedded trigger fire more reliably than a skill reference?

## Context

A **spike, not a task**: it builds nothing and implements nothing. It answers the
one open question
[exploration-adopter-feedback-channel-018](../../../docs/explorations/exploration-adopter-feedback-channel-018.md)
deliberately refused to guess at, and it **gates stage 2**.

The question: do adopters run the command? The evidence says instruction-only
compliance is insufficient — `deftai/directive#3633` shipped a skill documented
as the sanctioned escalation route and an agent that was actively escalating and
following the rule pointing at it still missed it, because a policy flag
defaulted off, the skill was absent from the host's skill-discovery inventory,
and the `REFERENCES.md` index the managed `AGENTS.md` told agents to scan was
never deposited. But that is evidence about a **skill reference**. It says
nothing about a command embedded in the agent files the adopter already loads —
which is exactly the change ADR 0020 makes and exactly what stage 1 ships.

So the spike measures the thing stage 1 actually changed.

Two real adopters exist on this machine: `../ArggonStores` and this repo.

## Acceptance

- [ ] A pass/fail criterion is written **before** any observation is collected (the `deftai` post-mortem failed partly because "silent" was indistinguishable from "absent").
- [ ] At least one non-maintainer adopter repo is observed end to end: `arggon friction` invoked, or demonstrably not, with the transcript kept.
- [ ] `arggon doctor --json`'s `friction.triggerPresent` is recorded for each observed repo, so "the trigger was never seen" is distinguishable from "the trigger was seen and ignored".
- [ ] The result is reported as a number with its denominator (N repos observed, N with the trigger present, N with a record written) — not as a qualitative impression.
- [ ] The finding is filed as a comment on this item, and the answer decides whether **stage 2** (tier C, `gh` upstream dedupe) proceeds, is deferred, or is abandoned in favor of a human-only channel.
- [ ] Explicitly recorded even if the answer is "nobody ran it": a null result here is the input to choosing tier B as the primary channel rather than tier C.

## Notes

Non-goal: shipping any code in this spike. If the answer is negative, the honest
response is to make tier B (the prefilled URL a human clicks) the whole channel —
not to add instruction pressure.
