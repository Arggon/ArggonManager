---
type: task
status: done
id: task-explore-harness-research-transfer
title: "Spike: what do the AutoHarness / AutoContext / AutoCompact papers change for ArggonManager? (corrects exploration-020's candidate set)"
assignee: arggon-coordinator
branch: feat/task-explore-harness-research-transfer
parent: harness-research-transfer
labels: [methodology, exploration, research]
priority: p2
created: "2026-10-05"
updated: "2026-10-05"
worktree_path: /home/arggon/Projects/ArggonManager-task-explore-harness-research-transfer
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-explore-harness-research-transfer.md
  Leaves live only under a story. id is the filename stem: task-explore-harness-research-transfer.
  CLI `arggon create task explore-harness-research-transfer` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: what do the AutoHarness / AutoContext / AutoCompact papers change for ArggonManager? (corrects exploration-020's candidate set)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

**This item corrects the premise of exploration-020 / ADR 0022.** The product owner supplied
the three papers on 2026-10-05:

- **AutoHarness** — arXiv:2603.03329v1 (2026-02-10), Lou, Lázaro-Gredilla, Dedieu,
  Wendelken, **Lehrach**, **Murphy** — *"improving LLM agents by automatically synthesizing a
  code harness"*
- **AutoContext** — arXiv:2510.02369v3 (2025-09-29), Cai, Liu, Yang, Niu, Xiao, Chen —
  *"Instance-Level Context Learning for LLM Agents"*
- **AutoCompact** — arXiv:2610.02163v1 (2026-10-01), Zhang, Zheng, Du, An, Dong — *"Learning
  When to Compact Context in Long-Horizon Coding Agents"*

Exploration-020 evaluated **npm packages that happen to share those names** and concluded
"there is no such stack" — which was true of the registry and **wrong about the question**:
these are three peer-reviewed research results, not a vendor stack. The registry names
collide by coincidence; `autoharness@0.0.1` is an unrelated one-day placeholder (re-verified
2026-10-05: still `0.0.1`, still "Reserved", still 8 downloads/month, repo still empty),
and `autoctx` (greyhaven-ai, 1304 stars) is a **different** project from the AutoContext
paper. ADR 0022's *decision* survives (we do not adopt a second loop), but its **evidence**
was about the wrong artifacts and must be superseded, not quietly left standing.

## Acceptance

- [x] Classified first, with the ratchet recorded
- [x] Each paper read from source (arXiv HTML), its **method** recorded — not its abstract
- [x] For each: what it claims, measured on what, and **what it does not claim**
- [x] Compared against what the methodology **already owns**, naming the specific substrate
      (the kernel's refusal layer, ADR 0006's context budget, the smoke harnesses) — the
      interesting question is where a paper's contribution is *already* ours
- [x] The honest read on transferability: a research result on games/benchmarks is not a
      spec for our loop, and the record says which of these three could ever be more than an idea
- [x] Records that exploration-020's candidate set was the **wrong artifacts** and supersedes
      it explicitly — ADR 0022 amended, not left to mislead the next reader
- [x] One recommendation with trade-offs; follow-ups filed as tracked items
- [x] `arggon validate` + `spec validate` green; PR opened with the methodology impact class
- [x] `arggon spec analyze` reports no NEW finding naming this item

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
verdict: approve

Record: `ArggonManager/docs/explorations/exploration-harness-research-transfer-021.md`
(spike). Correction: an amendment box on ADR 0022 (evidence base **superseded**, decision
**retained**) and a superseded banner on exploration-020, so the wrong record cannot be
cited as evidence by the next reader.

Gates, expected vs observed:

- `adr-index-parity` + `spec-doc-numbers` + `spec-decision-gaps` + `init-docs` → **88 passed**.
  No new ADR row needed (0022 is amended, not added) — that drift is exactly what this
  suite catches
- `spec validate` → ok (34 docs, 5 pre-existing `DOC_NUMBER_COLLISION`) · `spec analyze` →
  **0 findings naming this exploration** · `arggon validate` → ok, **0 warnings**
- `prettier --check` → my 3 files clean. **7 pre-existing warnings in other exploration
  docs on `main` are NOT touched** — out of scope here, and folding them in would bury
  the correction this PR exists to make
- One broken link found and fixed before PR: the ADR 0017 filename in
  `task-state-exploration-stopping-rule`'s body (`0017-greenfield-work-exploration-first`
  does not exist → `0017-greenfield-exploration-gate`), corrected in a comment rather
  than edited, since a comment is history
- Blocking end-to-end check: CI (full suite + tasks-validate + ui-smoke). Docs + tracker
  only — no `lib/`, `cli/src/` or template source touched, so `npm run build`/`npm test`
  were run locally only for the doc suites above

## What the three papers actually claim

Read from the arXiv HTML, methods not abstracts:

- **AutoHarness** (arXiv:2603.03329v1, **Google DeepMind**) — the model writes its own
  harness; prevents all illegal moves in 145 TextArena games; Flash+Harness beats
  Gemini-2.5-Pro 9/16 2P games (56.3% vs 38.2%); LLM-free code-policy beats Pro and
  GPT-5.2-High on 16 1P games. Opens on a **rate**: 78% of Flash's chess losses were
  illegal moves.
- **AutoContext** (arXiv:2510.02369v3, **ByteDance + NUS**) — one-off exploration → reusable
  instance knowledge graph (TODO forest + Plan–Act–Extract loop). ReAct on TextWorld
  **37% → 95%**; every equipped baseline takes fewer steps. **Its own Limitations is the
  finding**: it assumes a *relatively stable environment*, warns pre-computed context may go
  "outdated" in frequently-changing ones, and calls itself *less suitable for disposable
  environments discarded after single use*.
- **AutoCompact** (arXiv:2610.02163v1, **SMU / NTU / Harvard**) — when/what/how to compact as a
  trained policy; **+9.2%** SWE-bench Verified, +5.0% SWE-PolyBench Verified. Ablation:
  ignoring the compaction calls *of the same trained model* lowers pass rates.

Citation caveat recorded rather than smoothed: P1's id encodes `2603` while its metadata and
header both say **2026-02-10**.

## The findings that decided it

- **F1/F2 — we already are the harness, hand-designed, at 171 `throw new Error` sites** in
  `lib/src/`, and we have **no counter**. `report --trend` mines commits, not refusals. So
  AutoHarness's opening question — how often does an agent attempt an action your
  environment forbids? — is unanswerable here. That is the one finding with a number
  behind it, and it is cheap to settle.
- **F3 — synthesis is the wrong direction for a normative layer.** AutoHarness *learns* its
  acceptance condition; ours is `convention.md`, and the invariants that make parallel
  agents safe would end up behind a prompt and a critic. Confirmed: 171 refusal sites is
  exactly the brittle hand-written harness the paper criticises.
- **F4 — P2 is refuted by P2, for our case.** A repo is a frequently-changing environment and
  a worktree is the disposable unit of work P2 names as unsuitable. Its generated-context
  artifact would be a moving part inside the tree — what ADR 0006 rejected.
- **F5 — P2 supplies the first *quantitative* support for ADR 0006's shape.** 0006 measures
  cost per surface and never argues amortization; P2's RQ2 does (>95% coverage in 200/80
  steps, fewer steps downstream).
- **F6 — the most portable finding is a stopping rule.** Ablation: w/o **Planner 40%** vs full
  95% — removing the stop-decision costs more than removing the data structure. Our ADR 0017
  frontier-round stop condition is currently unstated.
- **F7 — our compaction is exactly the length-triggered baseline P3 names**, and P3's
  Conclusion names Codex/Claude Code as open future work. We are on a **named open gap**, not
  a missing fix.
- **F8 — transferable: the three-question diagnostic**, and the *remove the behaviour, keep
  the training* shape of evidence, which the smoke gate already applies.
- **F9 — P3 and our handoff converged independently on one working-state summary**; what P3
  asks that we do not answer is whether the resuming agent **followed** the handoff.
- **F10 — I did not reuse ADR 0022's strongest argument.** It said: no second *executor*
  outside the permission perimeter. A paper proposes no executor, so that argument does not
  transfer. Recorded explicitly so the previous record's reasoning is not reused by reflex.

## Recommendation: adopt no dependency, transfer three things, measure one number

There is nothing to install. Transfers: (1) P2's amortization citation for ADR 0006's shape —
**which I did not apply here**, since amending an Accepted ADR is a carrier change and this
PR is Advisory; that is for the PO. (2) P3's three-question diagnostic. (3) P2's Planner
finding as an argument for writing down our stopping rule. Measure: our illegal-action rate.

Trade-offs: we decline the strongest result in the batch (+9.2% SWE-bench) because it needs
RL compute we do not have — named open by the authors themselves for harnesses like ours;
this PR ships little operationally, which is the correct size for three papers that all
measure something other than repositories; the measurement may come back near-zero and close
AutoHarness for us, which is why it is an afternoon's work; and **a correction costs
credibility** — 020's decision survived by luck, not method.

Follow-ups filed: `task-measure-kernel-refusal-rate` (p2),
`task-state-exploration-stopping-rule` (p3), `task-adopt-compaction-three-questions` (p3).

Checklist above complete; the item flips `done` on merge.
