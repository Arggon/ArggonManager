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

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
verdict: approve

Exploration recorded at
`ArggonManager/docs/explorations/exploration-autoharness-autocontext-autocompact-020.md`
(number 020 = next FREE after 019) and the decision at
`ArggonManager/docs/adr/0022-decline-autoharness-autocontext-autocompact.md` (Status:
Proposed). Gates, expected vs observed:

- `npx vitest run cli/src/adr-index-parity.test.ts` → **7 passed** — the 0022 index row was added
  in the same change this time, so the suite that failed PR #624 did not fail this one
- `spec validate` → ok (34 docs, 5 pre-existing `DOC_NUMBER_COLLISION` warnings)
- `spec analyze` → **0 findings naming this exploration**
- `prettier --check` clean on both new docs and the ADR index
- `arggon validate` → `ok (0 warning(s), convention v5)`

**Classification: spike**, with the one-way ratchet recorded explicitly in the doc: had the
answer been *yes*, it would have upgraded to **greenfield**, because a Pi seam is an ADR 0020
adapter others would depend on. Recommending *no* keeps it a spike.

**The headline finding is that the question's premise does not hold**, established from the
registries rather than assumed: `autoharness` is a *name reservation* (`0.0.1`, 8 downloads
per month, zero deps, a repo created and last pushed the same day); **AutoContext is two
unrelated projects** — and greyhaven's own README warns that the npm `autocontext` package is
*"not the unrelated `autocontext` npm package"*; **AutoCompact is three**, two of them
peer-bound to `@earendil-works/pi-coding-agent`, a client we ship no seam for.

**One correction I made to my own reasoning mid-exploration**, recorded as F3: rejecting the
serious candidate (`autoctx`, 1304 stars) on host grounds would have been **wrong** — its CLI
surfaces are host-agnostic; only its Pi extension is locked. It is declined for a different
and stronger reason: it is a second agent-improvement loop beside the one the methodology
already enforces, with two notions of done and two histories — the same reasoning ADR 0021
already used to reject a parallel `next` lens.

Recommendation is **C5: adopt nothing, steal one idea.** Follow-up filed:
`task-spike-cross-run-lesson-store` — the durable cross-run lesson store, which is the one
genuine gap this exposed (nothing survives the item today).

Checklist above complete; the item flips `done` on merge.
