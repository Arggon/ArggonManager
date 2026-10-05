# 0022 External agent tooling — decline AutoHarness / AutoContext / AutoCompact, and steal the lesson-store idea

- Status: Proposed
- Date: 2026-10-04
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)
- Input: [exploration-autoharness-autocontext-autocompact-020](../explorations/exploration-autoharness-autocontext-autocompact-020.md) (2026-10-04)
- Methodology impact class: **Advisory** — no carrier rule, command, gate or adapter changes

> **Amendment (2026-10-05, `task-explore-harness-research-transfer`): the evidence base is
> SUPERSEDED; the decision is RETAINED.** The product owner supplied the actual research on
> 2026-10-05 — **AutoHarness** (arXiv:2603.03329v1, Google DeepMind), **AutoContext**
> (arXiv:2510.02369v3, ByteDance + NUS), **AutoCompact** (arXiv:2610.02163v1, SMU / NTU /
> Harvard). These are three papers, not a vendor stack. Everything in **Context** below
> describes npm packages that merely share the papers' names; those registry facts remain
> true and are irrelevant to the question. **Do not cite this record's evidence.**
>
> The **Decision** stands on its own terms: the "second executor / second loop" argument is
> about _executors_, and a research finding proposes no executor — adopting a finding runs
> code inside the existing loop, under the existing roles. What is superseded is the
> candidate list and the reasoning that depended on package identity. Corrected record:
> [exploration-harness-research-transfer-021](../explorations/exploration-harness-research-transfer-021.md).
> Exploration-020 is retained as the record of a wrong question, not as evidence.

## Context

The product owner asked (2026-10-04) whether ArggonManager can adopt **AutoHarness /
AutoContext / AutoCompact**, and how.

The exploration's first job was to establish what those names denote, because the question
presumes a coherent external stack. They do not denote one. Measured against the public
registries on 2026-10-04 (npm registry metadata; download window 2026-09-04 → 2026-10-03;
GitHub repository metadata):

- **`autoharness`** is a name reservation, not software: version `0.0.1`, **8 downloads per
  month**, zero dependencies, repository created _and_ last pushed on the same day
  (2026-05-19). There is nothing to evaluate.
- **AutoContext** is shared by **two unrelated projects**: `autoctx` (greyhaven-ai, **1304
  stars**, 1415 dl/month, actively pushed — a self-improving _agent harness_), and
  `autocontext` (salehsquared, 1 star, 27 dl/month, dormant since 2026-04-14 —
  `.context.yaml` per directory). greyhaven's own README warns about the collision: the npm
  package is `autoctx` and is _"not the unrelated `autocontext` npm package"_. A third
  entry, `pi-autocontext`, is the Pi extension of the first.
- **AutoCompact** is shared by **three**, the two serious ones peer-depending on
  `@earendil-works/pi-coding-agent` (Pi) — a client ArggonManager ships no seam for.

Meanwhile the methodology already owns two of the three underlying problems: evaluation
(`smoke:opencode`, `smoke:opencode:wave`, `smoke:native-start-cold` in the `cli` CI job,
`smoke:tui-board`, `arggon doctor --budget`) and context budget (ADR 0006 — progressive
disclosure, ≤2 KB generated `AGENTS.md`, ≤12 KB advisory MCP ceiling, measured with a
tripwire). Compaction is the client's job and is already configured natively in the
generated `opencode.jsonc` (`compaction: { keep: { tokens: 15000 } }`, ADR 0010/0011).

## Decision

**Adopt none of them. Take one idea.** Recorded as C5 in the exploration.

1. **`autoharness` is not adopted** — there is no artifact. Its "Reserved" description and
   8 downloads/month are the whole of it.
2. **No Pi-locked extension is adopted** (`pi-autocontext`, `@dieulc/autocompact`,
   `@crewhaus/compaction-autocompact`). They peer-depend on `@earendil-works/pi-*`.
   Supporting Pi would be an ADR 0020 per-agent adapter: a capability-matrix row, a
   generated seam, a smoke story and CI — for a client with no user in the adopter base.
3. **`autoctx` is not adopted as a dependency.** Explicitly **not** on host grounds — the
   CLI surface is host-agnostic (Python + Node), so that reason would have been wrong. It is
   declined because it is a **second agent-improvement loop** beside the one the methodology
   already enforces: it runs a goal against an evaluation, keeps lessons and discards dead
   ends. Alongside our delivery-lead wave, the blocking smoke gate and `arggon next`, that
   is two loops driving the same work with two notions of "done" and two histories.
4. **`.context.yaml`-style generated per-directory context is not adopted.** ADR 0006 chose
   the opposite on purpose — **budget and point, never generate**. Generated context is a
   moving part that rewrites inside the tree it describes, which is the same class of
   problem this repo spends real effort containing (never-overwrite, `x-generated`
   provenance, orphan reaping, the ADR 0016 upgrade channel).
5. **The lesson-store idea is adopted, on our own substrate.** `autoctx`'s distinguishing
   move — keeping the lessons, discarding the dead ends, across runs — addresses a gap we
   genuinely have: our retrospectives are per-item comments and handoffs scoped to one
   item's next step, and ADR 0017's exploration artifacts are produced per exploration and
   then not carried forward. Tracked as `task-spike-cross-run-lesson-store`.

## Consequences

- **A standing bar for external agent tooling**, which is the durable part of this record:
  a candidate must close a **named gap** (ours, stated in advance, not discovered after
  adoption) and must not introduce a second loop, a second executor outside the permission
  perimeter, or a generated moving part in the tree. Fits are argued against those bars, not
  against popularity — see the trade-offs below.
- **An external executor is out of perimeter.** Today every executor is one of our four
  agent roles, so the claim discipline, never-steal/never-reopen, the least-privilege
  permission sets and the blocking smoke gate all bind it. An external harness that _runs_
  work is not one of our agents, so none of those bind it: adopting one is auditing a second
  executor, not adding a library.
- **We accept being slower to learn across runs than `autoctx` is out of the box.** That is
  the strongest argument for adoption and it is not dismissed — it is answered by the spike,
  not by this record. If the spike shows no value, revisit with evidence.
- **We decline a 1304-star, actively maintained project.** Said plainly because it will feel
  unfashionable: stars are a maintenance signal, not a fit signal. Licenses (MIT/Apache-2.0)
  were never the objection.
- **Scoped, not a standing refusal.** This rejects the five candidates evaluated on
  2026-10-04. ADR 0020 already commits the project to per-agent adapters as a standing
  offer; a real Pi user in the adopter base changes the calculus for (2), and a
  host-agnostic package that closes a named gap changes it for (3).
- **Revisit condition, written so it is falsifiable:** a candidate is re-evaluated when it
  (a) closes a gap this repo has already named in the tracker, (b) runs under our existing
  loop rather than beside it, and (c) keeps every executor inside the permission perimeter
  or comes with a spec that makes it one.

## Alternatives considered

- **Adopt `autoctx` as an opt-in power tool** (run it ad hoc, never wired into the loop).
  Rejected as the worst of both: an out-of-loop executor with its own history is exactly the
  second-history problem, and it would still need auditing while delivering none of the
  loop's guarantees. Revisit only if the spike fails.
- **Adopt a Pi seam now** "while we are here". Rejected: ADR 0020 makes a per-client adapter
  a product commitment with a smoke story and CI; there is no adopter asking for it.
- **Adopt `.context.yaml` per directory.** Rejected on ADR 0006's own reasoning, quoted in
  (4).
- **Keep the exploration and decide nothing.** Rejected: the product owner asked for a
  recorded decision, and a future session will be asked this again. The bar in the
  consequences is what makes the answer reusable.
