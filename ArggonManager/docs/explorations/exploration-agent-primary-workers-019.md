---
exploration_id: agent-primary-workers-019
title: Agent-primary delivery — agents as the primary workers, humans as product owner
status: open
created: 2026-10-04
---

# Project exploration: Agent-primary delivery — agents as the primary workers, humans as product owner (agent-primary-workers-019)

Greenfield record (the six-phase protocol,
`skills/arggon-cli/references/exploration.md` — ADR 0017): the decision lands in
an ADR (`ArggonManager/docs/adr/`) — linked under Decision. Edge cases leave this
doc as spec acceptance criteria, explicit non-goals, or spike items — nothing
stays "unknown".

Requested by the product owner (2026-10-04): _"shift to agents primary workers and
humans moved to product owners role — as a recorded decision, not a chat
summary."_

**Scope note.** "The methodology" here is narrower than
[exploration-014](exploration-methodology-improvements-014.md): it is the
**division of authority** inside the work loop — who decides, who executes, who
may override, and what each side leaves as a record. The loop itself (find →
claim → work → review → merge → done), the spec/plan/ADR/exploration pipeline and
the gates are in scope only where a role boundary crosses them. Per ADR 0011 the
methodology is the contract, so this is a Behavioral change reaching every
adopter's agents through the generated seam — which is exactly why it is recorded
here and in an ADR instead of accreting as prose (same bar exploration-014 and
exploration-015 set).

## Classification

**Greenfield.**

- **Why:** there is no existing flow to read for this. `ArggonManager/docs/agents.md`
  and `engineering.md` describe _steps_ and _bars_, never _roles with authority_ —
  the only role language is the human job-title table at `engineering.md:12` and the
  invariant line "humans and agents follow the same rules"
  (`agents.md:6`, `engineering.md:6`, `convention.md:6`, `README.md:59`, restated in
  ADR 0020 §Decision.1). Nothing depends on a role model yet, so this is a **new
  interface** — a division of authority that the carriers, the generated agents and
  the gates will all read.
- **Ratchet (one-way):** entered as _bounded_ ("make the loop agent-primary"). The
  ground phase upgraded it to **greenfield** on three observations that a bounded
  change could not absorb: (1) the change **falsifies a stated invariant** in four
  carriers plus README plus ADR 0020; (2) the review bar assigns work to human job
  titles that the shipped agent roles already perform (`agents.md:290`, coordinator
  prompt duties 1–5); (3) the only durable place a human decision can be recorded
  does not exist yet, so the change needs an artifact, not an edit. Nothing
  downgrades it back.

## Frontier-rounds log

Rounds run in the protocol's dependency order. Each ended with the frontier empty:
every branch below is either settled with evidence or routed to a follow-up item.
"I don't know" never became a guess — see the spikes in the Decision section.

### Round 1 — outcome / users

- _Who is "the human" in this methodology today?_ Not a role: a **GitHub login**
  (`convention.md:168`), four structurally human-only escape hatches, one prose-only
  review-bar section, and a `Deciders:` line in ADRs. Not a persona, not
  authenticated (Round 6).
- _Who is "the agent"?_ Four shipped roles — `arggon-coordinator` (primary),
  `arggon-worker`, `arggon-reviewer`, `arggon-prover` (`agents.md:290`) — plus
  three on the ZCode seam. The worker prompt says outright: _"the coordinator owns
  tracker decisions, review and completion"_ (worker prompt, line 23).
- _What does the PO actually want changed?_ Not "humans stop working" — the request
  is about **who holds authority and who leaves a record**. Settled: the deliverable
  is a role model with two axes — **work-loop parity** (both sides may claim, work,
  review) and **asymmetric authority** (named human powers, listed and bounded).
- _Frontier exhausted:_ every remaining "who" question resolves to the authority map
  in Round 5.

### Round 2 — scope / decomposition

Ballooning risk hit immediately — the request touches carriers, the review bar, the
item schema, the adapters, the release pipeline. Decomposed before grilling, into
five independently shippable decisions:

| #   | Decision                                                             | Lands as                     |
| --- | -------------------------------------------------------------------- | ---------------------------- |
| S1  | The invariant wording (what supersedes "same rules")                 | ADR + carriers               |
| S2  | The authority map (who may do what; which powers stay human-only)    | ADR + `engineering.md` table |
| S3  | The recorded human artifact (direction / acceptance / risk)          | ADR + convention             |
| S4  | Agent identity in the tracker (`assignee` currently conflates roles) | ADR + agent prompts          |
| S5  | Review-bar role remap (human titles → agent roles + PO)              | ADR + `engineering.md`       |

No decomposition was needed _inside_ any S — each fits one PR. Ordered S1 → S2 → S3,
with S4 and S5 riding the S1 carrier edit (same files, so same wave — see Rollout).

### Round 3 — constraints

Settled from the repo, not from opinion:

- **C1 — the methodology is the contract** (ADR 0011); a behavioral carrier change
  needs the ADR 0016 impact class and the propose channel (`agents.md:471–478`).
- **C2 — one logic path** (ADR 0010/0011/0014): no adapter may fork a rule. A role
  enforced in `.opencode/agents/*.md` and absent in the ZCode/Claude seams would be
  a dialect, not a rule.
- **C3 — context budget** (ADR 0006): the role map must be a bounded table in an
  existing carrier, not a new always-loaded file.
- **C4 — enforce discipline, not aspire** (`engineering.md:21` Goal 2).
- **C5 — the repo already named the vehicle for this decision**:
  `engineering.md:201` says "agent-only shortcuts are out of scope **unless an ADR
  says otherwise**", and `engineering.md:56` keeps "an agent-only dialect of the
  rules" out "without an ADR". So the shift is _sanctioned by the current
  methodology_ precisely because it is routed through an ADR — a reviewer objection
  to the form has a documented answer.
- **C6 — no identity layer**: the session id is correlation metadata only
  (`agents.md:414`), so no rule can authenticate _which_ human acted. This bounds S3
  hard (Round 6).
- **C7 — the automated grill exists**: `spec analyze` is the place ambiguity dies
  (ADR 0017), and it already carries decision-pipeline findings
  (`agents.md:450`).

### Round 4 — data

What the tracker can already express, and what it cannot:

| Fact needed by the role model | Exists today                                                                             | Gap                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Who is working                | `assignee` + `claimed_at` lease (`convention.md:168,177`)                                | value is a **login or an agent id** — both allowed, and the prompts pick the login (`arggon-coordinator.md:39`) |
| Who decided the direction     | `priority` field                                                                         | **no record of who set it or why**                                                                              |
| Who accepted the work         | acceptance rows in the body; `verdict:` comment header (`engineering.md:109`)            | **no product-acceptance record at all**; a story closes by the acceptance-aware cascade (`convention.md:52`)    |
| Who reviewed                  | `verdict: approve｜request-changes`, classified report-only by `sync`                    | working precedent for the shape S3 needs                                                                        |
| Who overrode the rules        | dated `### Waiver` section (ADR 0015), `> stolen <date> by …` note (`convention.md:303`) | working precedent — overrides already travel with the item                                                      |

So the _shape_ of every artifact the role model needs already exists twice over
(verdict header, waiver note). Nothing needs a new schema; two need a convention.

### Round 5 — interfaces

Where the role model must be visible, and what each surface can carry:

1. **Carriers** — `agents.md`, `engineering.md`, `convention.md`, README §Principles
   and §The methodology, plus `skills/arggon-cli/**` (byte-paired with
   `.agents/skills/arggon-cli/**`).
2. **Generated seam** — four agent prompts (OpenCode), three (ZCode), and the Claude
   Code bundle. Per C2 the _rule_ lives in the carriers; prompts may restate it.
3. **`arggon sync --json`** — already parses a bounded comment header report-only
   (`engineering.md:109`). The natural home for an acceptance classification.
4. **`spec analyze`** — already the report-only scanner for decision-pipeline gaps
   (`agents.md:450`). The natural home for "closed with no recorded acceptance".
5. **Capability matrix** (ADR 0020, report-only in `doctor`) — a role row per agent
   would need a native mechanism or an explicit gap; the claude seam has no hooks
   and no permission DSL (ADR 0020 amendment, 2026-10-02), so a role enforced per
   adapter would be permanently unenforced there.
6. **Release pipeline** — already carries a hard human decision (AC 7: no publish
   without a human-pushed version-bump commit, `spec-release-pipeline-015.md:51–53`).

### Round 6 — failure / edge

Adversarial round over the settled shape. What surfaced: an agent can _forge_ an
acceptance comment (no identity, C6); a PO-less repo (open source, single maintainer
on holiday) must still run the loop; acceptance can arrive _after_ the close;
concurrent auto-done + coordinator flips race. All twelve dimensions are resolved in
the table below — none stayed unknown.

### Round 7 — ops / security

- **Irreversibility is the natural cut.** The human keeps the steps that cannot be
  undone by an agent: publish (`spec-release-pipeline-015.md` AC 7), steal
  (`convention.md:303`), waive (ADR 0015, no agent-facing parameter), reopen
  (`agents.md:282`). All four are already structurally human-only — the role model
  **names** them rather than inventing new ones.
- **Least privilege already holds**: reviewer cannot edit, worker cannot launch
  subagents or file items, prover cannot mutate (`agents.md:291,293`). The role model
  must not weaken any of it.
- **Forgery** is accepted deliberately: acceptance is attributed, not authenticated,
  and is never a gate (edge 1, edge 5).

### Round 8 — rollout

- **Behavioral impact class** (ADR 0016) → `init --propose` for acked adopters, a
  release note, and skill byte-parity in the same PR (`agents.md:476`).
- **Forward-only**: no backfill of acceptance records for closed items; the detector
  is report-only so an empty corpus is the normal day-one state (edge 2).
- **Wave shape**: the carrier set (`agents.md`, `engineering.md`, `convention.md`,
  README, both skill copies) is one file-disjoint wave; the detector work is a second
  wave; the promotion-policy tier table lands with the carrier edit.
- **Gate order (ADR 0017)**: spec → `spec analyze` clean → implementation tasks. The
  follow-up items below are wired to keep that true.

## Edge cases

| Dimension                          | Hunted case                                                                                                                                          | Resolution                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| input validation / hostile input   | A worker writes `accept: approve` on **its own** story (or an agent counterfeits the PO's name) — the one signal that makes the PO real is forgeable | **Explicit non-goal**: acceptance is attributed and **never a gate** (no identity exists to authenticate it — `agents.md:414`). The only _enforced_ human step stays the ADR 0015 waiver, which is human-only by kernel rule and exposes no agent parameter. **Spec AC**: `sync --json` reports `self-accepted` when the acceptance author equals the item's own assignee (report-only) |
| empty / loading / error states     | Every existing container closed with no acceptance — day one and every legacy tree                                                                   | **Spec AC**: the detector is report-only, additive and silent-as-information on a corpus with zero acceptances; no gate, no auto-filed items, `validate` stays green (edge 8)                                                                                                                                                                                                           |
| concurrency / idempotency          | Two agents (auto-done workflow + coordinator) flip the same item; acceptance lands _after_ the close                                                 | **Spec AC**: re-running the detector never mutates state; a late acceptance clears the finding on the next run (comments are legal on terminal items — history, not a reopen, `agents.md:39`)                                                                                                                                                                                           |
| failure / retry / timeout          | The PO is unavailable for a week; the repo has **no** PO at all (open source)                                                                        | **Spec AC**: absence of a PO never blocks an item — the default promotion tier is agent-self-certified, so a PO-less repo is compliant by default. No "waiting on PO" status, no SLA, no timer                                                                                                                                                                                          |
| authn / authz                      | "Only the product owner may accept" cannot be enforced — the tracker has no identity, only a correlation session id                                  | **Explicit non-goal**: the role model **declares** authority, it does not authenticate it. The enforced human signals remain the TTY gates (steal / force / reopen) and the kernel's agent-caller refusal on waive                                                                                                                                                                      |
| limits / quota / perf              | PO attention is the scarce input; a per-leaf review duty makes the loop _slower_ than today                                                          | **Spec AC**: the promotion policy caps PO touchpoints at containers, waivers and irreversible steps; leaves are agent-owned end to end. The role map is a bounded table (ADR 0006), never a new always-loaded file                                                                                                                                                                      |
| time / timezones / locale          | Async PO in another timezone; staleness alarms                                                                                                       | **Spec AC**: no timers and no PO-blocked status; acceptance is a comment at any hour; `claimed_at` staleness stays advisory reporting only (`convention.md:302`)                                                                                                                                                                                                                        |
| persistence / migration / rollback | No backfill; adopters have acked carriers                                                                                                            | **Spec AC**: adoption is forward-only, per-repo opt-out through a convention flag (`x-tracker`, `convention.md:506–527`); rollback = supersede the ADR + revert the carrier text; `init --propose` never overwrites acked docs (ADR 0016)                                                                                                                                               |
| observability / debuggability      | Nobody can tell whether the shift is working, so nobody can ever justify C3                                                                          | **Spec AC**: the model ships with a report-only measure — share of closed containers carrying a recorded acceptance, plus the count of human-only hatches used (waivers / steals) as the PO-attention signal; extend `arggon report`/`doctor` and the telemetry-mining lab (`agents.md:606`), no new dashboard. This is the evidence C3's gate would require                            |
| security / threat model            | An agent routes around policy by writing its own acceptance, or by nominating itself PO                                                              | **Explicit non-goal**: no new authority surface is created for agents; agents still cannot waive. If a role marker is ever added it must be a convention key (`x-`), never a kernel-trusted frontmatter field a worker can write                                                                                                                                                        |
| environment / platform             | OpenCode has a permission DSL, ZCode has hooks but no DSL, Claude Code has neither (ADR 0020 amendment)                                              | **Spec AC**: the rule lives in the shared carriers + kernel; per-adapter differences are capability-matrix **gap rows**, never divergent rules (one-logic-path invariant, ADR 0010/0011/0014)                                                                                                                                                                                           |
| upgrade / data-loss                | Behavioral methodology change never reaches acked adopters                                                                                           | **Spec AC**: ships under the ADR 0016 channel — `init --propose`, a release note naming the new convention, and `skills/arggon-cli/` ↔ `.agents/skills/arggon-cli/` byte-parity in the same PR (`agents.md:476`). No data loss: acceptance records live in item bodies already in git                                                                                                   |

## Approaches considered

Three candidates for _how_ to encode the role model. All three ship the same
invariant change (S1) — they differ in how much structure backs it.

### C1 — Declare only

Supersede the parity invariant with a precise two-axis rule ("**same rules for the
work loop; asymmetric, named authority**"), rewrite the role table, and list the
PO's existing powers — priority/direction, acceptance, waiver, takeover, release.
No new artifact, no schema, no kernel, no detector.

_For:_ cheapest possible; nothing to migrate; no adopter ceremony; fully reversible
by editing a table. _Against:_ the PO's most important power — **accepting the work**
— stays invisible, because it is the one power with no record today (Round 4). The
shift would be true and unverifiable, which is the failure mode exploration-014 F2
already named for review verdicts: _a bar that is social stays social until something
structural carries it._

### C2 — C1 + the promotion policy + one recorded artifact (recommended)

C1, plus exactly three structural pieces, each reusing machinery that already ships:

1. **A promotion-policy tier table** in `engineering.md` naming which item classes
   need a recorded PO acceptance and which the agent may self-certify on the
   review-bar evidence. This is the missing artifact: the repo already has a
   _certificate_ (the review bar + the blocking smoke gate, ADR 0008) but no written
   statement of **how deep human review goes per class** — and that statement is
   exactly what makes agent-primary delivery finishable rather than merely
   aspirational.
2. **A PO acceptance record**: a bounded, author-attributed `accept: approve |
changes-requested` comment header on the container — the same convention shape as
   the review verdict (`engineering.md:109`). Read report-only by `arggon sync --json`
   (which already classifies verdict headers) and surfaced by `spec analyze` when a
   container closes without one. **Zero new machinery**, one convention line, and the
   report is what would later justify C3.
3. **Agent-identity discipline**: agents claim as their shipped role id
   (`arggon-coordinator`, `arggon-worker`, …), never as the PO's login. The schema
   already allows it — `assignee` is documented as "GitHub login **or agent id**"
   (`convention.md:168`) — so this is doctrine, not migration. It also ends the
   conflation that makes an agent worker look like the human owner in
   `list --assignee @me`, in stale-claim reports and in CODEOWNERS review.

_For:_ makes the decisive human decision observable without inventing authority;
costs one convention and two additive report-only rules; keeps the PO's touchpoints at
container granularity; degrades cleanly when there is no PO. _Against:_ adds a
convention adopters must learn (Behavioral class); the report is worthless until
someone reads it; a repo that ignores acceptance records is no worse than C1 — which
is precisely why the detector, not the prose, is the load-bearing part.

### C3 — C2 + a kernel-enforced PO gate

A container cannot flip to `done` without a recorded acceptance, mirroring ADR
0015's done gate: refuse the transition, expose a human-only override.

_For:_ the strongest enforceability available; nothing can drift quietly.
_Against, and decisive:_ the tracker **cannot authenticate the PO** (Round 3 C6), so
the gate is either forgeable by any agent that writes a comment, or unusable by a
real PO working through an agent surface — both outcomes are worse than the status
quo. It also spends PO attention on _every_ close, which is the one input the
evidence says is scarce (F7). And the repo's own precedent is explicit: a blocking
gate on verdict prose is "deliberately out of scope until the report proves low-noise"
(`engineering.md:109`), and exploration-014 ranked report-only first for exactly this
class of change.

### Criteria

Weighted, highest first (mirroring exploration-014 so the two records read as one
methodology):

1. **Enforceability and honesty of the stated rule** — does it make the role
   structural, or restate it (`engineering.md:21`, Goal 2)?
2. **Conservation of product-owner attention** — the scarce input. A design that adds
   a PO touchpoint per leaf is a net loss (F6, F7).
3. **Evidence fit** — does the external practice support this shape _for a
   git-native, single-maintainer, identity-less tracker_?
4. **Adopter blast radius + context cost** — Behavioral class, lean carriers, one
   logic path (ADR 0006/0011/0016).
5. **Reversibility and effort** — additive, report-only before blocking, reversible by
   superseding an ADR.

### Findings

**Repo-internal (what is already true here)**

- **F1 — the parity invariant is already structurally false in four places.**
  `--steal` is human-only and TTY-confirmed (`convention.md:303`, `claim.md:83–99`);
  `--waive` on the done gate is human-only and exposes **no** MCP/native parameter
  (`agents.md:227`, `json-output.md:415`); `--force` on `update` is human-only
  (`agents.md:303`); reopening a terminal item needs an interactive confirmation and
  refuses piped stdin (`agents.md:282`). So "humans and agents follow the same rules"
  is aspirational prose today. **The role model does not add a new fiction — it makes
  an existing, structural asymmetry honest.** (source: repo grep + cited lines,
  2026-10-04)
- **F2 — agents already hold the entire delivery loop.** Explore → ADR → spec → plan →
  implement → review (coordinator as lead architect) → merge verification → done flip
  → follow-up filing (`agents.md:290,306,308`; coordinator prompt duties 1–5).
  "Agents as primary workers" is therefore a statement of the **status quo**; the
  substantive work is moving the human's remaining authority to the front of the loop
  and giving it a record. (source: `agents.md` + generated agent prompts, 2026-10-04)
- **F3 — the human holds five powers, and four of them are already structural.**
  Direction/priority (recorded as a field, decided by a person), product acceptance
  (**prose only** — `engineering.md:75–78` assigns it to a "Project Manager" and
  nothing records it; a story closes via the acceptance-aware cascade,
  `convention.md:52`), risk waiver (ADR 0015), claim takeover (steal), release
  (human-pushed version bump, `spec-release-pipeline-015.md:51–53`). The gap is
  precisely the one power with no artifact. (source: cited lines, 2026-10-04)
- **F4 — the review-bar role table is stale in the same way.** `engineering.md:12`
  assigns the doc to a "Software Architect", product acceptance to a "Project
  Manager", implementation to a "Software Developer" and QA to a "UI Tester" — while
  the shipped agents perform architect (`agents.md:306`), review (`agents.md:291`),
  proof (`agents.md:293`) and QA (the blocking smoke bar, `engineering.md:92–103`)
  roles today. The table names humans for work agents already do. (source:
  `engineering.md:12,291,306`, 2026-10-04)
- **F5 — no agent identity, so the two roles are indistinguishable in the data.**
  `assignee` accepts a login _or an agent id_ (`convention.md:168`), yet the
  coordinator prompt claims with `assignee: "<login>"` (`arggon-coordinator.md:39`).
  Agent work is therefore recorded under the human's identity — which corrupts
  `list --assignee @me`, staleness reporting, and any future per-role measure.
  (source: cited lines, 2026-10-04)
- **F6 — both report-only surfaces the role model needs already ship.** `arggon sync
--json` parses a bounded comment header and classifies items
  `approved`/`changes-requested`/`none` report-only (`engineering.md:109`); `spec
analyze` already emits decision-pipeline findings (`agents.md:450`). C2 therefore
  needs **no new tool and no new surface** — it extends two contracts that are proven
  in production. (source: cited lines, 2026-10-04)
- **F7 — the repo already sanctioned this shape.** `engineering.md:201` forbids
  agent-only shortcuts "unless an ADR says otherwise", and `engineering.md:56` keeps
  "an agent-only dialect of the rules" out "without an ADR". A role model routed
  through an ADR is inside the current methodology, not an exception to it. The ADR
  must also state why it is **not** a dialect: both sides call the same kernel, under
  the same rules, through the same envelopes (ADR 0010/0011 one-logic-path).
  (source: cited lines, 2026-10-04)
- **F8 — ADRs already record the product owner as a decider.** `Deciders: product
owner (Gonzalo), coordinator/architect (Arggon)` is the standing header in ADR
  0013/0014/0015/0017. The role model formalizes a practice the record already
  follows; it does not invent a new ceremony. (source: `docs/adr/0015-…:7`, 2026-10-04)

**External (dated sources, accessed 2026-10-04)**

- **F9 — Anthropic's field playbook names the artifact we are missing.** "Once agents
  accelerate writing the changes, the bottleneck shifts from producing changes to
  mobilizing the organization around them"; the review processes "were built on the
  assumption that a human wrote each change and a human would review each diff". Their
  fix is a **promotion policy**: "a tiered review path — written down and agreed in
  advance — that sets the depth of human review for a change", with changes "tiered by
  blast radius and agent confidence", full human review kept "for critical paths", the
  directive coming "from the top of the organization", agreed beforehand "so
  responsibility for a bug that reaches production is shared, not pinned on whoever
  approved the change", and "SMEs won't read every final diff, but their judgment is
  still the scarce input". They also give the acceptance test for a tier: whether
  reviewers "would be comfortable merging on the certificate's evidence alone — if they
  see their own bar in it, the promotion policy can be lighter". This maps one-to-one
  onto our certificate (review bar + blocking smoke, ADR 0008) and our missing
  promotion policy. (source: Anthropic, _How to prepare for AI-driven code
  modernization projects_, 2026-09-23,
  https://claude.com/blog/how-to-prepare-for-ai-driven-code-modernization-projects)
- **F10 — machine-checkable conditions are the load-bearing half.** Their "certificate"
  is a list of conditions where "each condition should be checkable without a human in
  the loop, so the agentic workflow can iterate on a change until it meets the
  certificate **or flag it for human review if it can't**". That is our smoke gate,
  and it is the reason the human is not in the inner loop at all. (source: same, 2026-09-23)
- **F11 — the empirical case for a product owner, and the case against over-promising.**
  DORA's 2025 report finds AI adoption now improves delivery **throughput** while
  still increasing **instability** — "AI is an amplifier, magnifying an organization's
  existing strengths and weaknesses". The DORA AI Capabilities Model (Dec 2025) lists
  **user-centric focus** among seven capabilities that amplify AI's effect, and states
  that "in the absence of a user-centric focus, AI adoption can have a negative impact
  on team performance". Faster throughput without a direction-owner is how a team gets
  faster in the wrong direction. (sources: DORA, _State of AI-assisted Software
  Development 2025_, https://dora.dev/report/2025, and Thoughtworks' PDF of the same
  report published 2025-10-15; DORA, _AI Capabilities Model_ 2025-12-08,
  https://services.google.com/fh/files/misc/2025_dora_ai_capabilities_model.pdf)
- **F12 — the counter-evidence, and the design constraint it imposes.** METR's RCT
  (2025-07-10) found experienced open-source developers took **19% longer** with
  early-2025 AI (CI +2%…+39%), while expecting a 24% speedup and still believing they
  were 20% faster; less than 44% of AI-generated code was accepted unmodified, and the
  time saved on coding was overwhelmed by "time reviewing AI outputs, prompting AI
  systems, and waiting for AI generations". METR's own follow-up (2026-02-24) reports
  the sign had flipped for late-2025 tools (subset estimate −18% speedup, new recruits
  −4%) but calls it weak evidence because selection effects bias it toward a lower
  bound — and had to redesign the experiment. Their 2026-05-11 survey of 349 technical
  workers reports a median 1.4–2x self-reported value change, with stated reasons for
  skepticism. **Design consequence:** do not assume the shift is free. The binding
  constraint is human attention spent reviewing and steering, so the role model must
  _reduce_ PO touchpoints per item — never add one per leaf. This is why C2 caps the
  PO at containers and irreversibles and why C3 is rejected. (sources: METR,
  https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study and
  arXiv:2507.09089; https://metr.org/blog/2026-02-24-uplift-update;
  https://metr.org/blog/2026-05-11-ai-usage-survey)
- **F13 — the academic framing agrees, and flags its own immaturity.** A 2026
  concept paper characterizes the shift as humans moving "from artifact producer to
  orchestrator and verifier", with specifications as "the contract substrate between
  humans and agents", and names the **productivity paradox**: "as individual
  productivity increases, team throughput, review capacity, and stability degrade
  because team-scale software engineering discipline is neglected". It is explicitly
  grey-literature work presented "as a first step toward academic-industrial consensus
  rather than a validated theory" — cited here as framing, not as proof. (source:
  Diaz, Gayoso, Cimminio, Perez, _Spec-Driven Development for Agentic Software
  Engineering_, arXiv:2609.00252, submitted 2026-08-31)
- **F14 — the vendor framing of the same shift, from a talk transcript.**
  "The new role looks less like managing a personal queue of coding tasks and more
  like acting as a staff engineer for a mixed team of people and agents", and the
  operating requirement is to "make quality legible and enforceable" — an agent cannot
  reproduce a team's standards that exist only as tacit knowledge. Secondary source:
  a published transcript summary of an OpenAI engineering talk (2026-04-17) and a
  2026-08-18 blog post paraphrasing OpenAI's own harness-engineering write-up
  ("humans shaped the environment and the feedback loops while agents performed most
  of the implementation"). The primary OpenAI post was **not** fetched, so this is
  recorded as directional corroboration, not as a citation. (source: ai.engineer talk
  notes, 2026-04-17; gopenai.com, 2026-08-18 — both secondary)
- **F15 — separation of duties is the shipped default, not a boutique.** Anthropic's
  Claude Code guidance recommends verification by "a verification subagent … in a fresh
  context window, so the agent doing the work isn't the one grading it", and ships a
  `/code-review` skill that reviews the current diff in a fresh subagent. Our
  coordinator/reviewer/prover split (`agents.md:293`) is the same instinct, already
  implemented with permissions. (source: _Best practices for Claude Code_,
  https://code.claude.com/docs/en/best-practices — undated docs page, accessed 2026-10-04)

### Recommendation

**Adopt C2.** One recommendation, with its trade-offs stated.

C2 wins because it is the only candidate that makes the decisive human decision
**observable** without inventing authority the system cannot back:

- **vs C1:** C1 is honest prose that leaves the PO's most important power invisible.
  F6 shows the machinery to make it visible already ships twice over, so C1's
  simplicity buys less than it appears to.
- **vs C3:** rejected on a hard constraint, not on taste. No identity ⇒ no
  enforceable PO gate (edge 5); per-close PO attention contradicts the one thing the
  evidence says is scarce (F12); and the repo's own precedent is report-only first
  (`engineering.md:109`, exploration-014).

**The trade-offs C2 accepts, honestly:**

1. **Adopters must learn a convention.** Behavioral impact class: the acceptance
   header and the promotion tiers reach every adopting repo through `init --propose`.
   A repo that ignores both is no worse off than under C1 — the cost lands on the
   repos that want the signal.
2. **A report nobody reads is theater.** The detector earns its keep only if someone
   acts on it; the acceptance share is the metric that decides whether C3 is ever
   justified, and it is worthless if it is never looked at.
3. **The PO becomes a bottleneck by design.** Concentrating acceptance at containers
   is correct for quality and wrong for latency: a PO-less week now stalls _closures_
   (though never the work itself, per edge 4).
4. **No enforcement of the role itself.** Anyone can write an acceptance. That is
   accepted deliberately and is why the _only_ enforced human steps stay the four
   irreversible ones (Round 7).
5. **Two conventions to keep in sync** (skill ↔ `.agents/skills` byte-parity, plus the
   three carriers), which is a real maintenance tax under ADR 0016 — the same tax
   every prior behavioral carrier change has paid.

**Explicitly rejected sub-options** (recorded so they are not re-proposed):

- A `role:` (or `owner:`) frontmatter field — a schema change carrying a fact
  `assignee` already carries, and a kernel-trusted field a worker could write to
  nominate itself (edge 10).
- Per-adapter permission enforcement of the role — violates one-logic-path and
  leaves the claude seam permanently unenforced (edge 11, ADR 0020 amendment).
- Letting an agent self-certify acceptance to unblock its own item — destroys the
  only human signal in the model.
- A mandatory "PO must review every story" rule — spends the scarce input (F12).
- A PO-only `next` lens / separate agent pool — a second work loop with no evidence
  it would behave differently; YAGNI.

## Decision

Adopted as **[ADR 0021 — Agents as primary workers, humans as product
owner](../adr/0021-agents-primary-workers-human-product-owner.md)** (Status:
Proposed; becomes Accepted at PR merge, per the ADR lifecycle in
`engineering.md:191`).

Summary of what the ADR settles: the parity invariant is **superseded** by a
two-axis rule — _same rules for the work loop, asymmetric and named authority_; the
PO's authority surface is enumerated (direction/priority, container acceptance, risk
waiver, claim takeover, release) with the four irreversible powers staying
structurally human-only; agents claim as their role id, never as the PO's login;
the promotion-policy tier table and the `accept:` comment convention land as the one
new recorded artifact, read report-only by `sync` and `spec analyze`; the
kernel-enforced PO gate (C3) is deferred pending the report's evidence.

### What leaves this doc (nothing stays "unknown")

- **Follow-up work items** (filed, with acceptance checklists, deps wired so ADR
  0017's hard gate holds): the spec for the promotion policy + acceptance convention;
  the carrier wiring (three carriers + README + both skill copies, Behavioral impact
  class); the report-only detector (`sync` classification + `spec analyze` finding);
  the agent-identity discipline in the generated prompts; the review-bar role remap.
- **Spikes (would have been guesses):** none required for the decision itself. Two
  open measurement questions are recorded as acceptance criteria of the detector item
  rather than as separate spikes: what acceptance share counts as "the PO is
  actually reviewing", and how many human-only hatches per closed container is a
  healthy PO-attention budget.
- **Deferred by evidence, not by omission:** C3 (the kernel-enforced PO gate). The
  revisit condition is written into the ADR's consequences: a demonstrated failure
  the report-only detector did not prevent, plus a low-noise report.

## Self-review before handoff

- **Placeholder scan:** no `TODO`/`TBD`/`{{…}}`; the ADR link resolves (written in
  this PR).
- **Internal consistency:** F1 (asymmetry already exists) ↔ recommendation (declare,
  don't invent); edge 5 (no identity) ↔ rejection of C3; criterion 2 (conserve PO
  attention) ↔ the tier table's container granularity.
- **Scope check:** docs + two additive report-only contracts + agent identity. No
  kernel rule, no schema field, no new command, no adapter-specific behavior.
- **Ambiguity check:** the remaining open questions are measurement thresholds, and
  they are attached to the detector item as acceptance criteria — they do not change
  the decision.
