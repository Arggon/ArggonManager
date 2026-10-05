---
type: task
status: in_progress
id: task-explore-autoharness-autocontext-autocompact
title: "Stack exploration: can ArggonManager adopt AutoHarness / AutoContext / AutoCompact?"
assignee: arggon-coordinator
branch: feat/task-explore-autoharness-autocontext-autocompact
parent: external-harness-evaluation
labels: [methodology, exploration, evaluation]
priority: p2
created: "2026-10-05"
updated: "2026-10-05"
claimed_at: "2026-10-05T02:13:46.579Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-explore-autoharness-autocontext-autocompact
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/external-harness-evaluation/task-explore-autoharness-autocontext-autocompact.md
  Leaves live only under a story. id is the filename stem: task-explore-autoharness-autocontext-autocompact.
  CLI `arggon create task explore-autoharness-autocontext-autocompact` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Stack exploration: can ArggonManager adopt AutoHarness / AutoContext / AutoCompact?

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

Product-owner question (2026-10-04): *"Explore about AutoHarness, AutoContext and
AutoCompact — can we adopt it at ArggonManager? How?"* — to be answered as a recorded
decision, not a chat summary.

Classified **spike** (one open question: adopt or not) → the `templates/exploration.md`
stack-decision record. Zero mentions of the three names anywhere in this repo, so this is an
external-tooling question, not a bounded extension of an existing flow.

## Acceptance

- [ ] Classified first, with the one-way ratchet recorded — including the condition under which
      it would upgrade to **greenfield**
- [ ] Record at `ArggonManager/docs/explorations/exploration-autoharness-autocontext-autocompact-020.md`
      following `templates/exploration.md`: candidates, criteria, findings, recommendation
- [ ] Every candidate identified **with dated sources** (registry metadata, download counts,
      repo signals, all with access date) — and the *name collision* between packages recorded,
      because two unrelated projects answer to `autocontext`
- [ ] Findings compared against what the methodology **already owns** (ADR 0006 context budget,
      the smoke harnesses, native compaction) rather than against an imagined baseline
- [ ] One recommendation with its trade-offs; if the premise of the question does not hold,
      say so plainly with the evidence, and answer the useful version of the question
- [ ] Cross-cutting → ADR linking this exploration; follow-up work filed as tracked items
- [ ] `arggon validate` + `spec validate` green; PR opened with the methodology impact class
- [ ] `arggon spec analyze` reports no NEW finding naming this exploration
