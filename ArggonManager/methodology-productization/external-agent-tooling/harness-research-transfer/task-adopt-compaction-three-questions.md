---
type: task
status: todo
id: task-adopt-compaction-three-questions
title: "Adopt AutoCompact's three-question compaction diagnostic (when / what / how to continue) in the review bar"
parent: harness-research-transfer
labels: [methodology, context-budget]
priority: p3
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-adopt-compaction-three-questions.md
  Leaves live only under a story. id is the filename stem: task-adopt-compaction-three-questions.
  CLI `arggon create task adopt-compaction-three-questions` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adopt AutoCompact's three-question compaction diagnostic (when / what / how to continue) in the review bar

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

F8 of [exploration-021](../../../docs/explorations/exploration-harness-research-transfer-021.md),
from [AutoCompact (arXiv:2610.02163v1)](https://arxiv.org/abs/2610.02163v1).

AutoCompact reduces context management to three questions: **when** to compact, **what** to
preserve, and **how to continue** from the compacted state. It reports +9.2% absolute on
SWE-bench Verified and +5.0% on SWE-PolyBench Verified by *training* a coding agent to
answer those three inside its policy (judge-corrected trajectories → SFT → outcome RL).

**We do not train models, and that is not the transfer.** What transfers is the
diagnostic: three questions we can ask of any degrading session with no compute at all.

Two details from the paper make it sharper:

- its failure mode for *how to continue* is that an agent revisits completed exploration
  or ignores the intended next action — which is exactly what our **handoff** exists to
  prevent, and exactly what we do not verify
- its self-check is **removing the behaviour while keeping the training**: ignoring the
  compaction calls of the same trained model lowers pass rates, so the gain is
  behavioural. That is the shape of evidence we should demand of our own loop changes,
  and it is the discipline the smoke gate already applies.

**Deliberately out of scope:** changing `templates/docs/opencode.jsonc`'s
`compaction: { keep: { tokens: 15000 } }`. AutoCompact's Conclusion names Codex and Claude
Code — our exact category — as length-triggered harnesses where combining learned
proactive compaction "could further improve these systems, which we leave for future
work". We are on a **named open gap**, not a missing fix, and the published fix needs RL
we do not have.

## Acceptance

- [ ] Adds the three questions to `docs/engineering.md`'s review bar (or the nearest
      prose carrier) as **advice with a trigger** — "when the session's context is visibly
      degrading" — not as a gate and not as a new command
- [ ] Each question is answerable against artifacts that exist: *when* → what signal is
      visible (re-reading the same files, restarting exploration, long tool output);
      *what* → the bounded surfaces ADR 0006 already measures; *how to continue* → the
      handoff fields
- [ ] States the honest limitation inline, so a future reader does not mistake this for a
      compaction fix: our compaction stays length-triggered by choice, and the published
      alternative requires training
- [ ] Accounts for ADR 0006's budget — anything added to always-loaded context is paid
      every session, so the addition is prose in an existing doc, not a new surface, and
      `doctor --budget` is checked if it moves
- [ ] **Does not** add a `compact()` action, a compaction tool, or any executor
- [ ] `arggon validate` green; PR opened. Impact class **Advisory**
