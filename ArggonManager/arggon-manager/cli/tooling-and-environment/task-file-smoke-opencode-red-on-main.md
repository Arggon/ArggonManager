---
type: task
status: todo
id: task-file-smoke-opencode-red-on-main
title: "`npm run smoke:opencode` fails with 47 failures on a clean `main` checkout — a red model-driven smoke on main should be tracked, not left as a comment"
parent: tooling-and-environment
labels: [ci, smoke]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-file-smoke-opencode-red-on-main.md
  Leaves live only under a story. id is the filename stem: task-file-smoke-opencode-red-on-main.
  CLI `arggon create task file-smoke-opencode-red-on-main` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `npm run smoke:opencode` fails with 47 failures on a clean `main` checkout — a red model-driven smoke on main should be tracked, not left as a comment

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Raised by the reviewer of PR #611 (bug-three-acceptance-parsers-diverging), 2026-10-03, which explicitly declined to leave this as a comment: a red model-driven smoke on `main` is a tracked fact, not a note in someone's verdict.

**The fact.** `npm run smoke:opencode` fails with **47 failures on a clean `main` checkout** — verified by the PR's worker against a throwaway read-only clone, with sorted FAIL sets identical (diff empty) between `main` and the branch. So it is not caused by that change, and it is not noise either: it is 47 failures in a gate this repo treats as evidence.

**Why it cannot simply be re-run.** `docs/agents.md:295` (and the review bar) say the model-driven smokes are timing-sensitive and must be run **alone**, never beside a suite or another harness. The 47 came from a parallel run — which the reviewer correctly judged admissible as a DIFFERENTIAL (it isolates the change variable) but explicitly **not** as runtime evidence that the native panel works. So the current state of the one gate that exercises the native seam end to end is genuinely unknown.

Acceptance:
- [ ] Run `npm run smoke:opencode` ALONE on `main` and record what actually passes and fails — the differential establishes the change is not the cause; only an alone run establishes the baseline
- [ ] For each failure class: is it a real regression, a provider/environment limit, or a stale expectation in the harness? Fix, or record the limit with evidence
- [ ] If it cannot be brought green in one session, record the KNOWN-GOOD subset explicitly, so a future run can distinguish new breakage from the standing baseline
- [ ] State whether the smoke should be a blocking CI gate in its current state — if it cannot pass reliably, its blocking status is theatre, and the honest move is to say so and scope it
- [ ] Note `agents.md` requires it run alone: document how CI (or a developer) is expected to honour that
