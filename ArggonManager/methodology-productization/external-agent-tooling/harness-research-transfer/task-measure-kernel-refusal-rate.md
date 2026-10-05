---
type: task
status: todo
id: task-measure-kernel-refusal-rate
title: "Measure our illegal-action rate: how often do agents attempt transitions the kernel refuses? (AutoHarness's opening datum)"
parent: harness-research-transfer
labels: [methodology, telemetry, research]
priority: p2
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-measure-kernel-refusal-rate.md
  Leaves live only under a story. id is the filename stem: task-measure-kernel-refusal-rate.
  CLI `arggon create task measure-kernel-refusal-rate` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Measure our illegal-action rate: how often do agents attempt transitions the kernel refuses? (AutoHarness's opening datum)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

F2 of [exploration-021](../../../docs/explorations/exploration-harness-research-transfer-021.md),
from [AutoHarness (arXiv:2603.03329v1, Google DeepMind)](https://arxiv.org/abs/2603.03329v1).

AutoHarness opens with a **rate**: 78% of Gemini-2.5-Flash's losses in the Kaggle
GameArena chess competition were attributed to *illegal moves* — not bad strategy, actions
the environment forbids. The whole paper follows from that number: fix the plumbing.

We are the environment. ArggonManager has **171 `throw new Error` sites in `lib/src/`**
implementing the refusal layer — invalid status transitions, `assertParentEdge`, a create
that must be claimed before completing, blocked-requires-a-reason, never-steal-a-claim,
never-reopen-`done`/`cancelled`, and cleanup's still-claimed refusal (m6). That is
AutoHarness's *action-verifier*, hand-designed.

**And we have no idea how often it fires.** `report --trend` mines git history for weekly
completions and cycle time — commits, not refusals. Nothing counts them. So the first
question AutoHarness asks of any agent is unanswerable in this repo.

This is deliberately the **cheapest** item in the batch and it is **falsifiable in an
afternoon**. The point is to close a standing plausibility either way:

- **High refusal rate** → AutoHarness's thesis has a target here, and
  `task-explore-harness-research-transfer` should be reclassified (it is currently a
  spike; a substrate change is greenfield and owes the six-phase protocol, ADR 0017).
- **Near-zero** → AutoHarness is closed for this repo, and we did not spend a week
  proving it.

## Acceptance

- [ ] Counts kernel refusals over a stated window (suggest N = last 8 weeks) from a named
      source: session logs, the tracker's own recorded refusals (`START_FAILED`, `CANNOT_*`,
      reopen/steal refusals), or PR/CI output — whichever actually exists. **If no source
      records them, that is itself the finding** — say so and stop; do not build telemetry
      inside this item
- [ ] Reports a **rate with a denominator** (refusals per agent action or per item
      lifecycle transition), not a raw count. A count without a denominator cannot answer
      AutoHarness's question
- [ ] Breaks the rate down **by rule**, so the top offenders are named. A single aggregate
      number is less useful than "these three rules account for 80%"
- [ ] States the **measurement's own limits** explicitly (what is not captured, and why
      the rate could be understated — e.g. an agent that never attempts the illegal move
      because a doc told it not to would show zero refusals *and* zero violations, which
      are different findings)
- [ ] Cross-checks one rule against something other than the log: e.g. compare the
      never-reopen refusal against the tracker's actual `done`/`cancelled` history
- [ ] One-line verdict on the item: does AutoHarness's thesis have a target in this repo,
      yes or no — with the number attached
- [ ] If the answer is "high", file the follow-up as a tracked item (do not scope it
      here); if "near-zero", record the closure and link it from exploration-021's
      Recommendation so the next reader does not re-litigate
- [ ] `arggon validate` green; PR opened. **Advisory** unless a telemetry surface is
      actually added, in which case say which and why
