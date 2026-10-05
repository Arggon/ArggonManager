---
exploration_id: harness-research-transfer-021
title: What do the AutoHarness / AutoContext / AutoCompact papers change for ArggonManager?
status: open
created: 2026-10-05
---

# Exploration: what do the AutoHarness / AutoContext / AutoCompact papers change for ArggonManager? (harness-research-transfer-021)

**Classification: spike.** One open question — does any of this research change what we
do — with a throwaway answer feeding bounded follow-ups. It is **not** greenfield: no
paper proposes a subsystem for us to build, and the recommendation is adoption-shaped
(measure, borrow an idea, adopt no dependency), not interface-shaped.

> **Ratchet (one-way).** Recorded for audit. This would have upgraded to **greenfield**
> if the answer were "adopt one of these as our execution substrate" — that is a new
> subsystem other work would depend on, and it would owe the six-phase protocol and a
> spec with clean `spec analyze` (ADR 0017). Recommending _no adoption_ keeps it a spike.
> If a later round re-reads these papers and one of them _does_ change the substrate, that
> is an upgrade, not a continuation of this record.

> **This record supersedes exploration-020's candidate set.** Not its conclusion — 020's
> _rejection_ stands (we adopt no second agent loop) — but its **evidence**, which was
> gathered about the wrong artifacts. See [Correction to exploration-020](#correction-to-exploration-020).

## The candidates, read from source

The product owner supplied the three papers on 2026-10-05. All three are research
results, not products: there is nothing to install, and every one of them is a claim
about a _different_ substrate than ours.

### P1 — AutoHarness (arXiv:2603.03329v1, Google DeepMind)

Lou, Lázaro-Gredilla, Dedieu, Wendelken, Lehrach, Murphy — _"improving LLM agents by
automatically synthesizing a code harness."_ Read from the arXiv HTML on 2026-10-05.

- **Claim.** Agents fail not from bad strategy but from actions the environment
  _forbids_: 78% of Gemini-2.5-Flash's losses in the Kaggle GameArena chess competition
  were illegal moves. People fix this by hand-writing a harness around the model, which
  the paper calls brittle and labor-intensive — "requiring additional work for every new
  game." Instead, **the model writes its own harness**: "code as harness", framed as a
  rejection sampler whose acceptance condition is itself learned. Search is over the space
  of programs — a hypothesis tree with Thompson-sampling-guided refinement, not naive
  iterative prompting — with the environment returning a critic (was the move legal, what
  reward).
- **Three harness shapes.** _Action-filter_ (code proposes legal moves, the LLM ranks);
  _action-verifier_ (LLM proposes, code checks, re-prompt on rejection); _policy_ (the
  whole decision procedure is code — no LLM at decision time).
- **Measured on.** 145 TextArena games for the illegal-move result; evaluation on a
  16-game 1P + 16-game 2P subset — 20 matches per 1P game, 40 per 2P game. Legal actions
  prevented in all 145 games. Flash+Harness beats Flash in 12/16 2P games (64.8% vs its
  own baseline); vs Gemini-2.5-Pro it wins 9/16 (56.3% vs 38.2%), and on 1P games
  averages 0.745 reward vs Pro's 0.707 and Flash's 0.673. The LLM-free code-policy
  beats Pro and GPT-5.2-High on 16 1P games.
- **What it does not claim.** Nothing about software repositories, tests, multi-file
  edits, or any artifact larger than a game state. The per-game harness is the unit, and
  the paper's own Future Work admits the obvious next problem: harnesses are generated
  per environment and not yet distilled into reusable, recursive improvement.

### P2 — AutoContext (arXiv:2510.02369v3, ByteDance + NUS)

Cai, Liu, Yang, Niu, Xiao, Chen — _"Instance-Level Context Learning for LLM Agents."_

- **Claim.** Existing auxiliary context is either _environment-level_ (global mechanisms)
  or _task-level_ (goal-specific instructions). Neither is **instance-level**: the local
  facts of _this_ environment — layouts, file hierarchies, exact tool behaviour. Humans
  do familiarization before working; agents skip it, so every task rediscovers the same
  facts. AutoContext does one compact exploration and emits a reusable knowledge graph.
- **Method.** A **TODO forest** (each tree rooted at an environment state, nodes are
  actions or subtasks, each paired with a _key result_ — a compact abstraction of the
  observation, recording **negative** feedback as well as successful transitions; in Agent
  Mode nodes are high-level subtasks that keep only a summary) serialized to indented
  text so it fits the window. A **Plan–Act–Extract loop** drives exploration until
  coverage suffices or the budget is spent.
- **Measured on.** TextWorld, ALFWorld, Crafter, InterCode-Bash. ReAct on TextWorld
  **37% → 95%**. Execution steps fall for every baseline it equips (TextWorld ReAct
  60.7 → 42.7; ALFWorld ReAct 11.4 → 6.6). Graph construction covers >95% of entities in
  200 steps (TextWorld) / 80 (ALFWorld), while IGE needs >160 steps in ALFWorld and
  scores lower at that budget. Ablation on TextWorld: w/o Planner **40%**, w/o TODO
  forest 51%, w/o Extractor 81% — **the Planner is the load-bearing component**, i.e.
  deciding _when to stop exploring_ is most of the value.
- **What it does not claim.** Its own Limitations section, verbatim, is the part that
  decides this exploration: the approach _"relies on a one-off exploration … which
  assumes a relatively stable environment. In dynamic settings where the environment
  changes frequently, the pre-computed context may become outdated."_ And it is _"less
  suitable for disposable environments that are discarded after a single use"_ because
  exploration carries an upfront cost. It also plans online adjustment as **future
  work** — i.e. the method is not safe in a moving environment _as published_.

### P3 — AutoCompact (arXiv:2610.02163v1, SMU / NTU / Harvard)

Zhang, Zheng, Du, An, Dong — _"Learning When to Compact Context in Long-Horizon Coding
Agents."_

- **Claim.** Context management is three questions, not one: **when** to compact, **what**
  to preserve, and **how to continue** afterwards. Length-triggered compaction
  (CompactionRL-style thresholds) ties the decision to length rather than task progress:
  stale exploration accumulates until the threshold, then compaction can fire mid-stage
  where the evidence is still needed. Proactive _instruction_ methods give a rubric but no
  training signal; offline-insertion SFT keeps the original actions after each inserted
  call, so the agent's _post-compaction behaviour_ is never supervised.
- **Method.** **Model-harness co-design**: the harness exposes a `compact()` action and
  the _model learns_ to use it as part of its policy. Data comes from **judge-corrected
  trajectories** — run the base agent, have a judge review the compaction decision, the
  summary and the actions after it, replace flawed outputs with corrections, execute the
  corrected trajectory so it continues from the corrected decision — then SFT, then
  outcome-reward RL jointly optimizing coding and compaction.
- **Measured on.** SWE-bench Verified (**+9.2%** absolute pass rate) and SWE-PolyBench
  Verified (**+5.0%**), holding across inference budgets at a 256K window that never
  overflows and a 16K window whose overflow falls back. Ablation: **ignoring the
  compaction calls of the same trained model lowers pass rates**, so the gain is not
  training alone.
- **What it does not claim.** It needs a **trainable model** and RL compute. Its own
  Conclusion names our configuration as open work: _"Widely used agent harnesses such as
  Codex and Claude Code currently compact the context automatically when it approaches the
  window limit … Our 16K results suggest that combining such mechanisms with learned
  proactive compaction could further improve these systems, which we leave for future
  work."_ So it does not claim a drop-in answer for a harness we configure, and it
  studied a **single scaffold**.

> **Citation caveat, recorded rather than smoothed over.** P1's arXiv id encodes
> `2603` (2026-03) while both its metadata and page header show **2026-02-10**. P2's id
> `2510` with a v3 dated 2026-01-13 is consistent. Cite by id + version; do not derive a
> date from the id.

## Criteria

Same shape as [exploration-014](exploration-methodology-improvements-014.md) and
[exploration-020](exploration-autoharness-autocontext-autocompact-020.md), restated
against a paper rather than a package:

1. **Does the substrate match?** A result on games, or on a text benchmark, is not a
   spec for a repository-tracking methodology.
2. **Do we already own it?** The decisive question, and the one 020 got wrong by
   assuming an empty baseline: where is the paper's contribution _already ours_?
3. **What does it not claim?** Applied to ourselves: does the paper's own Limitations
   or Future Work cover our case?
4. **Evidence vs. idea.** Can anything transfer without the paper's compute or substrate?
5. **Cost of being wrong.** What breaks if we act on a transfer that does not hold?
6. **Domain neutrality** (ADR 0021 §6.2): does the transfer survive in a non-software
   repo, or does it encode a software-shaped assumption?

## Findings

- **F1 — We already _are_ the harness, hand-designed, at 171 enforcement points.** P1's
  motivation is that hand-written harnesses are brittle and need work "for every new
  game". ArggonManager has exactly that, and on purpose: 171 `throw new Error` sites in
  `lib/src/` implement the refusal layer — invalid status transitions, `assertParentEdge`,
  a create that must be claimed before completing, blocked-requires-a-reason, never steal
  a claim, never reopen `done`/`cancelled`, `cleanup`'s still-claimed refusal (m6). P1's
  _action-verifier_ shape is this layer. **The contribution is already ours** — and ours
  is the thing P1 calls the brittle version.

- **F2 — The transferable half of P1 is a measurement we have never made, and it is the
  one thing P1 opens with.** P1's motivating datum is a _rate_: 78% of losses were
  illegal moves. We have 171 enforcement points and **no counter**. `report --trend` mines
  git history for weekly completions and cycle time — commits, not refusals. So the
  direct question P1 asks of any agent — _how often does your agent attempt an action your
  environment forbids?_ — is **unanswerable in this repo today**. That is a real, cheap,
  falsifiable gap, and it is the only part of P1 with a number attached to it.

- **F3 — AutoHarness's synthesis loop is the wrong direction for a normative layer.**
  P1 learns its acceptance condition from environment feedback. Ours is _normative_:
  `convention.md` says what a valid tracker is, and the kernel refuses everything else.
  A learned verifier would be an approximation of the rule, replacing the rule with a
  sample of it — and it would put the invariants that make parallel agents safe
  (never-steal, never-reopen) behind a prompt and a critic. AutoHarness also never tests
  transfer: harnesses are per-game, and distillation into reusable harnesses is its own
  Future Work. **Declined**, on the grounds that the thing being automated is the part
  that must not be automated. What P1 _does_ confirm is a choice we already made: its
  strongest result — an entire policy in code, beating a larger model — is
  harness-as-policy, and this repo already prefers code over model for rule enforcement
  (`arggon next` is a deterministic ranking, the review bar is a checklist, the gate is a
  script).

- **F4 — P2's transferability is refuted by P2's own Limitations, and our case is the
  counterexample it names.** AutoContext assumes a stable environment and warns that
  pre-computed context "may become outdated" where the environment changes frequently,
  with online adjustment as future work. A repository is a frequently-changing
  environment _and_ our unit of work is a short-lived branch or worktree — the
  "disposable environment discarded after single use" for which it explicitly says the
  method is _less suitable_. Building a `.context.yaml`-style or knowledge-graph-style
  per-instance context artifact would mean a generated moving part in the tree,
  rewriting itself as the tree moves — the exact class ADR 0016 exists to contain and
  ADR 0006 rejected by choosing **budget and point, never generate**.

- **F5 — P2 nevertheless supplies the quantitative support ADR 0006 argues only
  qualitatively.** ADR 0006 measures context _cost_ per surface (list 60.7 KB vs next
  901 B; AGENTS.md ≤2 KB) and never argues **amortization**. P2's RQ2 does: the one-off
  construction cost is amortized, graph construction covers >95% of entities in 200/80
  steps, and every equipped baseline then takes fewer steps. That is evidence for the
  shape ADR 0006 already chose — cheap fixed reads that beat repeated full reads — and it
  is the **first** time that argument has a citation. Note the corollary that keeps it
  honest: amortization requires reuse, and the amortization argument only pays when the
  artifact is stable, which loops back to F4.

- **F6 — P2's Planner ablation is the most portable finding in the batch, and it is a
  stopping rule.** Removing the Planner costs more than any other component
  (TextWorld 95% → 40%, worse than removing the TODO forest at 51% and the Extractor at
  81%). The Planner is what decides **when coverage is sufficient** to stop exploring.
  Our six-phase protocol (ADR 0017) has exactly this shape — _frontier rounds_ and an
  _edge-case hunt_ — and its stopping condition is currently a judgement call by the
  agent doing it, with no stated rule. P2 is evidence that the stopping decision is the
  load-bearing part, which is an argument for writing ours down rather than for building
  their structure.

- **F7 — Our compaction is exactly the length-triggered baseline P3 names, and P3
  explicitly leaves it as future work.** `templates/docs/opencode.jsonc` sets
  `"compaction": { "keep": { "tokens": 15000 } }` — a pure length trigger, no `auto`. P3's
  thesis is that this ties compaction to length rather than task progress, and its
  Conclusion names Codex/Claude Code — our exact category — as systems where combining
  length-triggered fallback with learned proactive compaction "could further improve
  these systems, which we leave for future work". So we are not missing a published fix;
  we are sitting on a **named, open gap** in the state of the art. That is worth knowing
  and is not worth acting on: the fix requires training a model with RL on task-success
  rewards.

- **F8 — P3's transferable content is a three-question diagnostic, and its ablation is
  the transferable _method_.** "When to compact / what to preserve / how to continue" is
  askable of our loop with no training. And its self-check — _ignoring the compaction calls
  of the same trained model lowers pass rates_, so the gain is behavioural, not from
  training — is the shape of evidence we should demand of any of our own loop changes:
  remove the behaviour, keep the training, and see whether the gain survives. This repo's
  closest analogue is the smoke gate: we already require that a change be exercised
  end-to-end rather than merely unit-tested.

- **F9 — "How to continue" is the third question, and it is the one we already have a
  mechanism for and a known weakness in.** P3's failure mode is that after compaction an
  agent revisits completed exploration or ignores the intended next action. ArggonManager's
  answer to exactly that is the **handoff** (`next`, `open_questions`, `branch`, capped at
  200 chars) plus the per-item comment: a deliberate, bounded _working state_ that a
  fresh session resumes from. ADR 0006 chose a single summary of conclusions plus
  workspace status; P3 chose a single working-state summary alongside the original task
  and recent turns — **the same representation**, arrived at independently, which is a
  point in favour of our shape. But P3's point that the _post-compaction behaviour_ needs
  supervising is unanswered by us: our handoff carries intent, and nothing verifies the
  resuming agent followed it.

- **F10 — All three are external _findings_, not executors, so the ADR 0022 perimeter
  argument does not transfer — and must not be reused by reflex.** 020 rejected `autoctx`
  because it would be a second executor outside the permission perimeter (no claim
  discipline, no least-privilege sets, no smoke gate binding it). A paper proposes no
  executor: adopting a _finding_ runs code inside the existing loop, under the existing
  roles. So the strongest argument in 020 does not apply here — and I am recording that
  rather than reaching for the previous record's reasoning because it was convenient. What
  _does_ transfer is 020's harder bar, unchanged: a transfer must close a gap we named in
  advance, and must not fork a rule into a second implementation.

- **F11 — Domain-neutrality check (ADR 0021 §6.2).** P1's mechanism (validate the action
  against the environment's own rules) is domain-neutral — a planner forbidding illegal
  transitions is the same shape as a tracker forbidding illegal status transitions. P2's
  is weaker: "instance context" means _file-system hierarchies and tool behaviour_, which
  presupposes a machine with files and tools. P3's is neutral in form (when/what/how to
  continue) and software-flavoured in content (SWE-bench). The honest reading: only P1's
  lesson and P3's diagnostic survive a non-software repo unchanged.

## Recommendation

**Adopt no dependency (there is nothing to install), transfer exactly three things, and
measure one number before believing any of it.**

1. **Take P2's amortization evidence for ADR 0006's shape** (F5). One sentence, one
   citation, and it is the first quantitative support for a position we already hold.
2. **Take P3's three-question diagnostic** (F8) — _when to compact, what to preserve, how
   to continue_ — as three questions the coordinator asks when a session's context is
   visibly degrading. No new surface; it goes in the review bar's prose if nowhere else.
3. **Take P2's Planner finding as an argument for writing down our own stopping rule**
   (F6) — not for building a TODO forest. ADR 0017's frontier-round stop condition is
   currently implicit.
4. **Measure our illegal-action rate** (F2) before any of P1's thesis is considered for
   this repo. This is the one follow-up with a number behind it and it is falsifiable in
   an afternoon: grep the tracker's own refusal records and the session logs for kernel
   refusals (`START_FAILED`, `CANNOT_*`, reopen/steal refusals) over the last N weeks.
   **If the rate is high, P1's thesis has a target and the follow-up is worth
   reclassifying; if it is low, P1 is closed for us and we did not spend a week proving
   it.**

**Trade-offs, stated rather than hidden:**

1. **We decline the strongest empirical result in the batch** (P3: +9.2% on SWE-bench
   Verified) because acting on it needs RL compute we do not have and a model we do not
   train. That is a real gap and it is _named as open by the authors themselves_ for
   harnesses like ours — so this is a recorded "not yet", not a dismissal.
2. **We adopt no new artifact, so this exploration ships almost nothing operationally.**
   The honest value is one citation, one diagnostic, one stopping-rule argument, and one
   measurement. That is thin, and it is the correct size for three papers that all
   measure something other than repositories.
3. **The measurement (F2) may show near-zero**, which would close P1 for us. We accept
   spending the afternoon to find that out, because the alternative is a standing
   plausibility ("maybe our agents attempt illegal transitions a lot") that will never be
   resolved either way.
4. **This record corrects 020, and a correction costs credibility.** 020's evidence was
   gathered about coincidentally-named npm packages, not the research. Its _decision_
   happens to survive — but only because the second-loop argument in F4/F10 does not
   depend on which artifacts were examined. That is luck, not method, and 020 should be
   read as history, not as evidence.

## Correction to exploration-020

[exploration-020](exploration-autoharness-autocontext-autocompact-020.md) evaluated
`autoharness@0.0.1` (description literally "Reserved", 8 downloads/month), `autoctx`
(greyhaven-ai, 1304 stars) and `@dieulc/autocompact` / `@crewhaus/compaction-autocompact`
(Pi extensions) — and concluded "there is no such stack." Every fact in that table is
accurate **about the registries** and irrelevant **to the question**: those packages share
names with the papers by coincidence. Re-verified 2026-10-05: `autoharness` is still
`0.0.1`, still "Reserved", still 8 downloads/month, repo still empty; `autoctx` is a real
1304-star project and is **not** the AutoContext paper; the AutoCompacts are real Pi
extensions and are **not** the AutoCompact paper.

What survives: the _shape_ of 020's recommendation — adopt no third-party executor, do not
add a second loop — because F10 shows that argument is about executors and holds on its own
terms. What is superseded: the **evidence base** and every candidate row. **ADR 0022 is
amended accordingly**; the decision stands, its grounding does not.

## Decision

Recorded as an amendment to [ADR
0022](../adr/0022-decline-autoharness-autocontext-autocompact.md) (evidence base
superseded, decision retained) — no new ADR, because no carrier, gate, command or adapter
changes. Methodology impact class: **Advisory**.

Follow-up work filed under `harness-research-transfer`.

**Reading order for the next session:** this record, then ADR 0022's amendment box. Do not
read exploration-020 as evidence — it is the record of a wrong question, kept because
corrections are part of the trail.
