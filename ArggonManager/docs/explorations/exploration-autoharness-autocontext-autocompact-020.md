---
exploration_id: autoharness-autocontext-autocompact-020
title: Can ArggonManager adopt AutoHarness / AutoContext / AutoCompact?
status: open
created: 2026-10-04
---

# Exploration: Can ArggonManager adopt AutoHarness / AutoContext / AutoCompact? (autoharness-autocontext-autocompact-020)

> **SUPERSEDED (2026-10-05) — kept as the record of a wrong question, not as evidence.**
> Every registry fact below is accurate _about the registries_ and irrelevant _to the
> question_: the packages share these names with the papers **by coincidence**. The names
> denoted three **research papers** — AutoHarness (arXiv:2603.03329v1, Google DeepMind),
> AutoContext (arXiv:2510.02369v3, ByteDance + NUS), AutoCompact (arXiv:2610.02163v1, SMU /
> NTU / Harvard) — which the product owner supplied on 2026-10-05. The decision landed in
> ADR 0022 survives on its own terms (see its amendment), but **do not cite the candidate
> table or the findings below.** Corrected record:
> [exploration-harness-research-transfer-021](exploration-harness-research-transfer-021.md).

Spike record: compare the candidates below, cite dated sources, and record a
recommendation. The decision itself lands in an ADR
(`ArggonManager/docs/adr/`) — link it under Decision. A technology playbook
(`arggon playbook new`) is generated after the decision.

Requested by the product owner (2026-10-04): _"Explore about AutoHarness, AutoContext and
AutoCompact — can we adopt it at ArggonManager? How?"_

**Classification: spike.** One open question — adopt these or not — with a throwaway
answer that feeds a bounded decision. **Zero** mentions of any of the three names exist
anywhere in this repo (markdown, TypeScript, JSON), so there is no existing flow to read
and extend; the question is about external tooling.

> **Ratchet (one-way).** Recorded so the classification can be audited: had the answer been
> _yes_, this would have **upgraded to greenfield** — adopting a Pi-locked compaction
> extension means a **new adapter seam** (`ArggonManager/docs/adr/0020`: per-agent
> adapters are a product commitment), and a seam is a subsystem other work would depend on.
> Recommending _no_ keeps it a spike. Nothing downgrades a classification later, so if a
> future evaluation finds a host-agnostic package that genuinely closes a gap, this becomes
> a greenfield exploration with a spec gate (ADR 0017), not an extension of this record.

## The premise does not hold — there is no such stack

The three names do not name one product, or three products from one vendor. They resolve
to **at least five distinct projects across four owners**, and the most prominent name is
a **placeholder with no implementation**. Measured 2026-10-04 (npm registry metadata,
`api.npmjs.org/downloads/point/last-month` for the window **2026-09-04 → 2026-10-03**, and
the GitHub repositories' own metadata):

| The name you asked about | What actually answers to it                                                                                                                             | Version                  | Downloads / month | Repo signal                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AutoHarness**          | `autoharness` (npm, `leonelhrp`) — description is literally **"Reserved — see …"**, zero dependencies, one-day repo                                     | `0.0.1`                  | **8**             | 0 stars, created **and** last pushed 2026-05-19                                                                                                                                                                   |
| **AutoContext** (a)      | `autoctx` / PyPI `autocontext` (`greyhaven-ai`) — "a harness for agent improvement"; recursive, evaluation-driven, keeps lessons, discards dead ends    | `0.19.0` (PyPI `0.19.1`) | **1415**          | **1304 stars**, 114 forks, 8 open issues, created 2026-02-11, pushed 2026-09-30, Apache-2.0                                                                                                                       |
| **AutoContext** (b)      | `autocontext` (npm, `salehsquared`) — "Folder-level documentation for LLMs — `.context.yaml` files for every directory"                                 | `0.2.0`                  | 27                | 1 star, created 2026-02-11, **last pushed 2026-04-14** (dormant ~6 months), MIT                                                                                                                                   |
| **AutoContext** (c)      | `pi-autocontext` (`greyhaven-ai`, same repo as (a)) — the **Pi extension** of `autoctx`                                                                 | `0.10.0`                 | 132               | keywords `pi-package`; peer-deps `@earendil-works/pi-{ai,coding-agent,tui}`                                                                                                                                       |
| **AutoCompact** (a)      | `@dieulc/autocompact` — "Intelligent session context compaction **for Pi**": proactive pre-warming, plan/todo-aware summarization, cheap-model override | `0.2.1`                  | 438               | repo `dieuluucanh/pi-workflow` created **2026-09-03** (~1 month old), 0 stars; peer-deps `@earendil-works/pi-*`                                                                                                   |
| **AutoCompact** (b)      | `@crewhaus/compaction-autocompact` — "Model-summarize-then-replace conversation compaction"                                                             | `0.7.0`                  | 765               | `@crewhaus/compaction-curator` sibling: a pre-compaction relevance+dedupe pass that "lets compaction-autocompact skip the model call"; `crewhaus/factory` = "compiler for AI agents", 3 stars, created 2026-05-01 |
| **AutoCompact** (c)      | `@agimon-ai/doompi-autocompact` — alpha                                                                                                                 | `0.0.1-alpha.113`        | —                 | pre-release                                                                                                                                                                                                       |

Two facts from that table decide most of this exploration:

1. **`autoharness` is a name reservation, not software.** 8 downloads/month, zero
   dependencies, a repository created and last touched on the same day. There is nothing
   to evaluate.
2. **The two `AutoContext` packages are unrelated, and the project's own README warns
   about it.** `greyhaven`'s README states the npm package is `autoctx` and is _"not the
   unrelated `autocontext` npm package"_ (source: `raw.githubusercontent.com/greyhaven-ai/autocontext/main/README.md`, accessed 2026-10-04). Anyone who searched "AutoContext" and installed the first hit got a different project than the 1304-star one.

## Candidates

### C1 — `autoctx` (greyhaven-ai), as a standalone CLI

The only candidate with genuine adoption and an active repository. Host-agnostic by
construction: it ships **four** surfaces — a Python CLI (`uv tool install autocontext`), a
Python library, a Node CLI (`bun add -g autoctx`, requires Node ≥ 22.19.0) and a Pi
extension. As a CLI it takes a goal, runs the task against an evaluation, keeps the useful
lessons, discards dead ends, and emits _traces, reports, playbooks, datasets, and optional
local-model training artifacts_.

### C2 — `pi-autocontext`, the Pi extension of C1

Same engine, but bound to Pi: peer-depends on `@earendil-works/pi-ai`,
`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox`. Adds iterative
strategy generation, LLM judging and evaluation tools _inside_ the Pi session.

### C3 — a Pi compaction extension (`@dieulc/autocompact` or `@crewhaus/compaction-autocompact`)

Session-context compaction for Pi, plus (crewhaus) a curation pass that can skip the
summarization model call entirely when relevance+dedupe alone gets under the trigger.

### C4 — `autocontext` (salehsquared), `.context.yaml` per directory

Folder-level generated documentation for LLMs, with a file-watcher and tree-sitter.

### C5 — adopt nothing; borrow the ideas

Record the decision, keep the dependencies out, and take the one idea that addresses a gap
we actually have (see F6).

## Criteria

Weighted, highest first — deliberately the same shape as
[exploration-014](exploration-methodology-improvements-014.md) so the two records read as
one methodology.

1. **Does it exist and is it maintained?** A name reservation is not a candidate. A
   dormant repository is a liability, not an asset.
2. **Host fit.** ArggonManager ships seams for **OpenCode V2, ZCode and Claude Code**
   (ADR 0020). A package peer-bound to a fourth client is either unusable or a new seam.
3. **One logic path** (ADR 0010/0011/0014): an adapter may not fork a rule. An external
   harness that carries its own agent loop, its own prompts or its own gate is a **second
   methodology**, not an adapter.
4. **Context/token cost** (ADR 0006): every always-on surface is a per-session bill.
5. **Adopter blast radius** (ADR 0016): does an adopter's tree change shape, and does
   `init` gain a moving part?
6. **Reversibility**: can we drop it in a release without an adopter noticing?
7. **Duplication**: do we already own the problem? (This repo's own bar — see F5.)

## Findings

- **F1 — The premise is false, and that is the finding.** There is no AutoHarness /
  AutoContext / AutoCompact _stack_: one of the three is a placeholder, one name is shared
  by two unrelated projects, and the third is shared by three. Nothing here is a coherent
  thing to "adopt" (sources: npm registry metadata + GitHub repo metadata, accessed
  2026-10-04).

- **F2 — The host is Pi, and we ship no Pi seam.** Both AutoCompacts and
  `pi-autocontext` peer-depend on `@earendil-works/pi-coding-agent`. Adopting any of them
  is an **ADR 0020 per-agent adapter** — a supported client with a capability-matrix row, a
  generated seam, a smoke story and CI. For a client with no user in our adopter base,
  that is the most expensive possible answer to this question.

- **F3 — `autoctx` itself is host-agnostic, so it is adoptable in principle.** This
  corrects the easy conclusion from F2: `autoctx` runs as a plain CLI against any repo, so
  nothing about it is Pi-bound. The Pi extension is one of four surfaces, not the product.
  Rejecting C1 on host grounds would have been wrong.

- **F4 — But C1 is a different _category_, and it collides with our loop.** It is an
  agent-improvement harness: it runs a goal against an evaluation and _learns from the
  result_ (keeps lessons, discards dead ends, emits datasets and optional local-model
  training artifacts). ArggonManager's loop already runs goals against an evaluation —
  `arggon next` (ADR 0004/0009), the delivery-lead wave, the blocking smoke gate
  (`docs/engineering.md` §Review bar), and the four smoke harnesses. Adding `autoctx` means
  **two loops driving the same work**, with two notions of "done" and two histories. That is
  the shape this repo already rejected once, on the record: ADR 0021 rejected "a
  product-owner-only `next` lens / separate agent pool" as _"a second work loop with no
  evidence it would behave differently"_. Consistency demands the same answer here.

- **F5 — We already own two of the three problems, differently.** This is the comparison
  that decides the rest:
  - _Evaluation_: `smoke:opencode`, `smoke:opencode:wave` (permission probes + a scripted
    four-phase wave), `smoke:native-start-cold` (model-free, offline, in the `cli` CI job),
    `smoke:tui-board`, plus `arggon doctor --budget` for the ADR 0006 context surfaces.
  - _Context budget_: ADR 0006 — progressive disclosure, a ≤2 KB generated `AGENTS.md` with
    pointers into `docs/`, a ≤12 KB advisory MCP `tools/list` ceiling, all measured by
    `doctor --budget`, with a tripwire if a budget is crossed.
  - _Compaction_: native and already configured — the generated `opencode.jsonc` sets
    `compaction: { keep: { tokens: 15000 } }` (ADR 0010/0011), so compaction is the client's
    job and ours is not to re-implement it.
    C4 (`.context.yaml` per directory) is the one that proposes something we do _not_ have —
    generated per-directory context. ADR 0006 deliberately chose the opposite: **budget and
    point, do not generate**. Generated per-directory context is a moving part that re-writes
    on every tree change, inside the tree it describes, and it is precisely the "generated
    docs nobody owns" failure this repo already fights (never-overwrite, `x-generated`
    provenance, orphan reaping). Adopting it would add the very class of problem ADR 0016
    exists to manage.

- **F6 — One idea is genuinely worth stealing, and it exposes a real gap.** `autoctx`'s
  distinguishing move is **keeping the lessons and discarding the dead ends across runs**.
  ArggonManager has no equivalent: our retrospectives are per-item comments and handoffs,
  scoped to one item's next step; `arggon report --trend` mines completions and cycle time;
  `ArggonManager/docs/labs/telemetry-mining.md` is a _protocol_ for mining friction
  signatures after the fact; `adopter-feedback/` is a channel. What we do **not** have is a
  durable, cross-run store of "what we learned, so the next agent does not relearn it" —
  which is also what ADR 0017's greenfield protocol produces _per exploration_ and then
  throws away. Note also the name collision-by-convergence: `autoctx` emits **playbooks**,
  and we already ship `arggon playbook` with staleness tracking
  (`playbook status`, 90-day threshold). Worth a deliberate look at whether its dataset model
  informs ours, without adopting the loop.

- **F7 — Licenses are permissive and not a blocker.** MIT (C2, C3a, C4, `autoharness`) and
  Apache-2.0 (C1, `@crewhaus/*`). Licensing is not why the recommendation is _no_; do not
  let it be mistaken for the reason.

- **F8 — Security posture for an always-on eval harness.** C1 executes tasks against a
  repo and can emit training artifacts. Our review bar already treats the dependency
  surface as a named dimension (`docs/engineering.md` §Non-functional bar: "a new runtime
  dependency needs justification in the PR") and our permissions model already encodes
  least privilege per role (`docs/agents.md` §Orchestration). An external harness that
  _runs_ work sits outside that perimeter: it is not one of our agents, so none of the
  permission rules, the claim discipline or the never-steal/never-reopen invariants bind it.
  Adopting it would mean auditing a second executor, not adding a library.

## Recommendation

**C5 — adopt nothing; borrow one idea.** One recommendation, with the trade-offs.

- **Do not adopt `autoharness`**: it does not exist (F1). There is no decision to make.
- **Do not adopt a Pi AutoCompact or the Pi extension of `autoctx`**: they are peer-bound to
  a client we do not ship a seam for, and a Pi seam is a full ADR 0020 adapter with a
  capability-matrix row, a generated seam, a smoke story and CI (F2). Wrong cost, no
  adopter.
- **Do not adopt the `autoctx` CLI**: not because of the host (F3 — that reason would be
  wrong), but because it is a **second agent-improvement loop** beside the one the
  methodology already enforces, with a second notion of done and two histories (F4). The
  same reasoning that rejected a parallel `next` lens in ADR 0021 applies unchanged.
- **Do not adopt `.context.yaml`**: we made the opposite choice deliberately — budget and
  point, never generate (F5, ADR 0006) — and generated per-directory context is exactly the
  moving-part-in-the-tree problem this repo spends real effort containing.
- **Take the lesson-store idea** (F6) as a spike of our own, on our own substrate.

**Trade-offs accepted, honestly:**

1. **We stay slower to learn across runs than `autoctx` out of the box.** That is a real
   cost, and it is the strongest argument _for_ adoption. The mitigation is a bounded
   follow-up, not a belief: if the lesson-store spike fails to show value, revisit C1 with
   the evidence rather than with this document.
2. **We decline a 1304-star, actively maintained project.** That feels unfashionable and
   should be said out loud: stars are a maintenance signal, not a fit signal. The
   disqualifier is the second loop and the unenforced executor, not the popularity.
3. **The decision is revisable on new evidence**, not on fashion. The revisit condition is
   written into the ADR: a host-agnostic package that closes a _named_ gap, with the gap
   stated up front.
4. **"No" here is scoped.** It rejects these five candidates as of 2026-10-04; it is not a
   standing refusal of external agent tooling. `ArggonManager/docs/adr/0020` already records
   that per-agent adapters are a standing commitment — a real Pi user in the adopter base
   changes this calculus.

## Decision

Recorded as [ADR 0022 — External agent tooling: decline AutoHarness /
AutoContext / AutoCompact, and steal the lesson-store
idea](../adr/0022-decline-autoharness-autocontext-autocompact.md) (Status: Proposed;
becomes Accepted at PR merge).

Follow-up work filed: a bounded spike for the cross-run lesson store
(`task-spike-cross-run-lesson-store`), which is where F6's idea is re-derived on our own
substrate rather than imported.

**If you meant a different product by these names**, say which — this record evaluated the
only five things that answer to them in the public registries on 2026-10-04, and a different
target would change the candidate set but not the criteria.
