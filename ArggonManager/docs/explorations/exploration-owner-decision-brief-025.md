---
exploration_id: owner-decision-brief-025
title: How a delivery lead brings a decision to a product owner who may have no technical background
status: open
created: 2026-10-06
---

# Project exploration: How a delivery lead brings a decision to a product owner who may have no technical background (owner-decision-brief-025)

Greenfield record (the six-phase protocol,
`skills/arggon-cli/references/exploration.md` — ADR 0017). Thinking is the
deliverable: nothing here is implemented. The decision lands in an ADR
(`ArggonManager/docs/adr/`) — linked under Decision. Edge cases leave this doc as
spec acceptance criteria, explicit non-goals, or spike items — nothing stays
"unknown".

Requested by the product owner (2026-10-06): the delivery lead keeps asking the
product owner to make **technical** decisions; if the product owner has no
technical background he cannot take that decision, so the lead must bring it in
**non-technical language with a recommendation grounded in an exploration**, as a
**recorded decision — not a chat summary**.

**The short answer.** The authority split is already correct and stays exactly as
it is ([ADR 0021](../adr/0021-agents-primary-workers-human-product-owner.md) §2).
What does not exist anywhere is the **request side** of that split: the
methodology defines how a decision is _answered_ (`accept:`) and how a change is
_judged_ (`verdict:`), and says nothing about how a decision is _asked_. The fix
is a bounded, plain-language **decision brief** the lead writes on the item —
question, why it matters, 2–3 options with their consequences in plain words,
**one recommendation plus the strongest argument against it**, and the default
that executes if no answer arrives — answered by a bounded `decided:` comment.
Prose, report-only, never a gate, exactly like its two siblings.

Classification: **greenfield**. Recorded decision lands in an ADR; the same shape
of cross-cutting authority record as
[exploration-agent-primary-workers-019](./exploration-agent-primary-workers-019.md).

## Classification

**Greenfield**, entered as **bounded** and upgraded during the ground phase. The
ratchet is one-way, so the upgrade stands.

- **Entered bounded** because a related flow exists to read and extend: ADR 0021
  §4 already records the product owner's **answer** on an item, and
  `ArggonManager/docs/engineering.md` §Review bar already defines the answer
  grammar (`accept: approve` / `accept: changes-requested` + evidence) and a
  report-only classification for it.
- **Upgraded to greenfield** on two observations a bounded edit could not absorb:
  1. **There is no request-side convention anywhere.** A repository-wide search
     for how a decision is escalated to the product owner returns nothing: the
     authority map names the product owner's five decisions
     (`engineering.md` §Authority map) but no carrier — not `agents.md`, not
     `engineering.md`, not either skill copy, not the generated
     `arggon-delivery-lead` contract — says how one is brought.
  2. **It is a new interface others depend on.** The brief becomes a third member
     of the bounded-header-comment family (`verdict:` / `accept:` / `decided:`),
     read by the product owner and by every adopting project, carried into every
     adopter's tree through the generated seam — a **Behavioral** methodology
     change on the ADR 0016 channel, which means an ADR, not a doc tweak.
- **Not a spike:** one question, but the answer is a standing surface with a
  durable grammar, not a throwaway prototype.

**Consequence of the classification.** ADR 0017's hard gate binds: no
implementation task may be claimed before a spec exists and `arggon spec analyze`
reports no NEW findings. Follow-up work below is the ADR and the spec, in that
order.

## Ground (measured 2026-10-06, not assumed)

### What the methodology already guarantees

| Fact                                                                                                                                                                                    | Source                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Five decisions belong to the product owner: direction and priority, container acceptance, residual-risk waiver, claim takeover, release                                                 | ADR 0021 §2; `engineering.md` §Authority map                                        |
| Human attention is the **scarce input**; the model must reduce per-item human cost, never add one                                                                                       | ADR 0021 §3 and §Consequences (cites the METR field evidence already in the record) |
| The role model is **domain-neutral**: a role is defined by what it decides, and software is only a worked example; the carriers declare "any project — not only software"               | ADR 0021 §6.2; `spec-methodology-adapters-017.md:16–18`                             |
| The answer is a **bounded, author-attributed comment header**, and it is **recorded, never enforced** — the tracker has no identity, so it can be attributed but not authenticated      | ADR 0021 §4; `convention.md` §`x-tracker.product-acceptance`; `json-output.md:367`  |
| A repository with **no product owner is compliant by default**; there is no SLA and no "blocked on the owner" status, so an absent product owner can never wedge a container's children | `engineering.md` §Review bar → Product acceptance                                   |
| Sequence ≠ priority: the lead recommends; the product owner sets `priority`                                                                                                             | ADR 0021 §6.1 boundary 1; `agents.md` §Orchestration                                |

The domain-neutrality clause is the sharpest internal argument, and it is not a
nicety: ADR 0021 §6.2 says the methodology is for **any** project while the
product owner is explicitly a **human** — a class that is not assumed to share the
lead's vocabulary. An escalation written in the lead's own technical register
contradicts the scope the same ADR established.

### What is missing — the request side

A search across the carriers, both skill copies, the generated agent contracts
and the tracker for any convention that governs escalating a decision to the
product owner returns **no** artifact. The family has two members and a missing
third:

- `verdict:` — how the standards reviewer answers "is this change right" (review
  bar → Review verdicts).
- `accept:` — how the product owner answers "do I accept this container"
  (ADR 0021 §4).
- `decided:` — **absent.** How the product owner answers "which of these should
  we do".

The failure is therefore not that the lead over-asks. It is that the question has
no home, so it lands wherever the session happens to be — a chat — and the answer,
if it comes, has nowhere durable to live.

### Three live cases in this repository, measured

The three open decision items below are the shape of the problem, not
hypotheticals. Each is `todo`, unassigned, and each asks the product owner for a
technical judgement while recording **no recommendation and no plain-language
statement of what the choice costs**:

| Item                                                     | What it asks the product owner to decide                                                                       | Plain-language statement present?                                       | Recommendation recorded? |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------ |
| `task-decide-codebase-memory-default-discovery`          | Whether a specific MCP server becomes the agents' default code-discovery aid                                   | no — the body is about star counts and registry metadata                | no                       |
| `task-decide-adr-0021-index-title-editorial-vs-verbatim` | Whether an ADR index row stays editorial (needs a `- Index title:` declaration) or copies its heading verbatim | no — reads as a file-format detail                                      | no                       |
| `task-arm-strict-worktree-writes`                        | Whether to arm `x-tracker.strict-worktree-writes` or keep the report-only default                              | partially — the body explains the mechanism, ends "coordinator decides" | no                       |

The third is the tell: it is a **flip-the-switch-or-leave-it** decision, written
so that only someone who already knows the flag can answer it.

The repository already cares that a decision is _recorded_ rather than lost:
`task-exploration-decision-records` (done) introduced a canonical no-ADR marker
so the report-only scanner stops flagging explorations whose decision was never
written down. This exploration is the same concern, one step earlier in the
chain — before the decision exists at all.

## Frontier-rounds log

Rounds run in the protocol's dependency order. Each ended with the frontier empty:
every branch is settled with evidence below or routed to a follow-up item.

### Round 1 — outcome / users

- _Who must be able to act on this?_ Exactly one person: the product owner. Not
  the reviewer (not consulted on direction), not the maker, not CI.
- _What does "act" mean?_ Choose an option, or send it back. Not "understand the
  implementation" — the lead owns that.
- _Who reads the record afterwards?_ Other agents, at the moment a similar
  decision resurfaces, and the next lead. That is why it must be on the item and
  not in a transcript.
- _Does this change who decides anything?_ **No.** ADR 0021 §2 stands. The lead
  keeps recommending; the product owner keeps deciding. Settled from the record.

### Round 2 — scope / decomposition

One question decomposes into five separable pieces, and the recommendation must
name all five or it is incomplete:

1. **The writing rule** — what a brief must contain to be actionable by a
   non-technical reader.
2. **Where it lands** — carrier and home (§Interfaces below).
3. **The answer grammar** — the product owner's bounded reply.
4. **The routing rule** — which decisions owe a brief at all (otherwise every
   decision becomes a brief and the "cry wolf" cost lands, see §Findings).
5. **The surface** — report-only visibility of briefs that were never answered.

### Round 3 — constraints

- **Never a gate.** ADR 0021 §4's reasoning is load-bearing and inherited: no
  identity layer, so anything gated on a human signal is forgeable or unusable,
  and both are worse than nothing.
- **Prose, not schema.** No new frontmatter field; the tracker already refused a
  `role:`/`owner:` field for exactly this reason (ADR 0021 §Consequences).
- **One logic path.** A comment convention, not a new command or surface
  (ADR 0020).
- **Context budget.** A brief is read by a human, so it is bounded by the PO's
  attention (ADR 0006's spirit), not by tokens.
- **Domain-neutral wording.** Fields are named in the project's own terms
  (ADR 0021 §6.2).

### Round 4 — data — the fields

Derived from the candidates in §Findings, not invented: DACI's driver duties
(scope, collated information, options with pros/cons and cost, a decision by an
agreed date) and MADR's own ordering decision (outcome before detailed
arguments). The brief carries: **the question in one sentence · why it matters
in outcome terms · 2–3 options, each with its consequence in plain words · one
recommendation and why · the strongest argument against that recommendation ·
what the lead will do if no answer arrives, and by when.** The answer carries:
**the chosen option · any scope note · the reasoning.**

### Round 5 — interfaces

Three homes were considered. The item comment wins, and not narrowly: it is the
only one that needs **no new surface**, it sits next to the answer it produces,
and it inherits attribution and supersede-by-later-comment from `accept:` for
free. A new docs directory would create a second home with a second style and
fork the record against the ADR; a frontmatter field was already rejected once.

### Round 6 — failure / edge

Routed to the edge-case table below. The one that shaped the design: **no answer
arrives.** Resolved as a stated default plus a named date, not as a block — which
is both the correct reading of "an absent product owner never wedges a container"
and the reason a brief is cheap enough to send.

### Round 7 — ops / security

A brief is prose in a file, in a repository that may be an adopted one. It is
never evaluated and never executed; untrusted content stays data (the non-
functional bar's security dimension). No new permission, no new command, no new
subprocess. Attribution only, never authentication — the same line ADR 0021 §4
draws.

### Round 8 — rollout

Behavioral methodology change → ADR 0016 upgrade channel → `arggon init
--propose` delivers the convention to adopters, and both skill copies
(`.agents/skills/arggon-cli/` and `skills/arggon-cli/`) stay byte-equal in the
same PR. The delivery-lead contract gains one duty. The promotion-policy tiers
are unchanged, so the number of product-owner touchpoints per shipped change does
not rise: a brief replaces a chat question, it does not add a step.

## Edge cases

Every hunted case resolves to a spec acceptance criterion, an explicit non-goal,
or a spike. Nothing stays unknown.

| Dimension                        | Hunted case                                                                        | Resolution                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| input validation / hostile input | A brief arrives on a repo with no product owner at all                             | **Non-goal for v0.** An absent product owner never blocks (ADR 0021 §3). The stated default executes and the brief records that it did — that is the compliance posture, not a defect     |
| empty/loading/error states       | A brief with one option, or options with no stated consequence                     | **Spec AC.** A brief owes ≥2 options, each with a plain-language consequence, and a recommendation; a one-option question is not a brief and the lead decides it and records why          |
| concurrency / idempotency        | Two leads brief the same decision on two items                                     | **Spec AC.** One item is canonical; the other links to it. No cross-item dedupe scanner in v0 — **explicit non-goal**, the volume does not justify a surface                              |
| failure/retry/timeout            | No answer by the named date                                                        | **Spec AC.** The stated default executes and the brief says so. This is the mechanism that makes escalation cheap rather than blocking                                                    |
| authn/authz                      | A brief or an answer forged by anyone, or an agent self-answering its own question | **Explicit non-goal.** Attribution only, never authentication — inherited from ADR 0021 §4. A gate here would be forgeable or unusable; both are worse than nothing                       |
| limits/quota/perf                | Briefs become routine, so the product owner starts rubber-stamping                 | **Spec AC.** One brief per decision; the routing rule limits briefs to the authority map's rows and hard-to-reverse calls. Repetition is the failure mode this guards                     |
| time/timezones/locale            | "Answer by Friday" read in another timezone, or an ADR dated in a second zone      | **Spec AC.** Absolute ISO date only. Never a relative deadline                                                                                                                            |
| persistence/migration/rollback   | An existing tree with briefs in some shape already                                 | **Non-goal: nothing to migrate.** Briefs live in item bodies, which already exist. A superseded brief is answered by a later `decided:` comment — supersede, never rewrite (the ADR rule) |
| observability/debuggability      | A brief was sent and never answered, and nobody notices                            | **Spec AC.** One additive, report-only `spec analyze` finding, mirroring `MISSING-PRODUCT-ACCEPTANCE`: a `decide:` header with no later `decided:`. Never a gate, never CI-failing        |
| security/threat model            | A brief in an adopted repo carries text a later agent will act on                  | **Data, never instruction.** Parsed as prose; no command interpolates it. The generated agent contracts are shipped files, so an adopter-edited brief cannot reach them                   |
| environment/platform             | A non-software adopter where "test suite" and "worktree" have no meaning           | **Spec AC.** Every field is named in the project's own terms; software appears only as the worked example (ADR 0021 §6.2)                                                                 |
| upgrade/data-loss                | Adopters on an older arggon version                                                | **Spec AC.** Behavioral → ADR 0016 channel; `init --propose` delivers it, both skill copies byte-equal in the same PR                                                                     |

## Candidates

Three shapes for the request side, each with the evidence behind it.

### C1 — A bounded plain-language decision brief on the item

The lead writes a comment on the item headed `decide:`, containing the fields in
§Round 4. The product owner answers with a comment headed `decided:` naming the
option. Prose; report-only; no schema; no new surface.

- **Grounded in:** MADR ADR 0016, which placed the **decision outcome above the
  fold** and ahead of the detailed pros-and-cons precisely so "the most important
  information" is what a reader gets first (source:
  https://adr.github.io/madr/decisions/0016-outcome-before-detailed-pros-cons.html,
  accessed 2026-10-06).
- **Grounded in:** DACI, where the **Driver** — the lead's role here — collates
  the information, determines the decision's scope, sets the date by which a
  decision is made, presents options _with pros, cons and cost_, and the outcome
  is then documented in the collaboration record. The **Approver** is one person
  with the final call. DACI is explicit that the Approver is an active decision
  maker, not a rubber stamp (source: Atlassian Team Playbook,
  https://www.atlassian.com/team-playbook/plays/daci, accessed 2026-10-06; the
  page cites a McKinsey survey claiming a 25% higher objective-and-timeline
  success rate for DACI users — **treated as vendor-cited and unverified**, and
  not load-bearing for anything below).
- **Grounded in:** MADR ADR 0015, which adopted only RACI's **consulted** and
  **informed** fields and rejected full RACI because it confuses _accountable_
  with _responsible_ (source:
  https://adr.github.io/madr/decisions/0015-include-consulting-informed-of-raci.html,
  accessed 2026-10-06). Same reasoning: name the one decider, keep the rest
  light.

### C2 — Teach only: put the plain-language rule in the lead's contract

One paragraph in `agents.md` §Orchestration and the generated
`arggon-delivery-lead` contract telling the lead to write in plain language with a
recommendation. No artifact, no answer grammar, no surface.

### C3 — A dedicated decisions surface

A new `ArggonManager/docs/decisions/` corpus with its own template, and a
report-only scanner over it.

## Criteria

1. **A product owner with no technical background can decide from it alone** —
   the stated purpose.
2. **It fits the existing authority split** without granting or removing
   authority (ADR 0021 §2).
3. **It cannot become a gate** — no identity layer exists to make one honest.
4. **It reduces, not adds, product-owner cost** — the scarce-input constraint.
5. **One home, one style** — no second record surface to fork against the ADR.
6. **Domain-neutral** — the software case is an example, never the vocabulary.
7. **Reuses what ships** — `arggon comment` already exists; the review-verdict and
   acceptance conventions are already the grammar.

## Findings

- **A recommendation is not a rubber stamp, but it is a confirmation-bias
  vector.** Giving the reader a preferred option first is exactly what makes the
  record decidable in minutes, and exactly what makes a lazy "yes" easy. Klein's
  premortem work is the counterweight that matters: projects fail partly because
  "too many people are reluctant to speak up about their reservations during the
  all-important planning phase", and making it safe for a knowledgeable dissenter
  to speak improves the odds (source: Gary Klein, "Performing a Project
  Premortem", _Harvard Business Review_, September 2007,
  https://hbr.org/2007/09/performing-a-project-premortem, accessed 2026-10-06).
  Two cheap countermeasures, both free in the grammar: the brief must state the
  **strongest argument against its own recommendation**, and the answer grammar
  must make **"decided otherwise" a first-class, unremarkable reply**. A brief
  that only offers agreement is a confirmation dialog with no cancel button.
- **A bare "are you sure?" is worse than no question.** NN/g's confirmation-dialog
  research is blunt: asked _"Are you sure you want to do this?"_ with no detail,
  "the only sensible reaction is 'of course I want to do the thing I just told you
  to do', and hit Yes without further thinking" — and repeatedly warning users
  trains them to stop reading the next warning. A confirmation "must restate the
  user's request and explain what the computer is about to do, with specific
  information"; and routine actions must not be confirmed at all. This is the
  strongest argument against C2 and against any brief that only says "I need your
  call on this" (source: Jakob Nielsen, "Confirmation Dialogs Can Prevent User
  Errors — If Not Overused", NN/g, 18 February 2018, last reviewed 7 August 2026,
  https://www.nngroup.com/articles/confirmation-dialog/, accessed 2026-10-06).
- **Plain language is a legal obligation in at least one domain, which shows it
  is a discipline and not a preference.** The Plain Writing Act of 2010
  established the requirement that content for the public "is written for its
  specific audience", and the government's guide series frames plain language as
  both more efficient and the law (source:
  https://www.plainlanguage.gov/guidelines/, accessed 2026-10-06; the live page
  carries the guide series forward and the original content is archived in the
  PlainLanguage.gov GitHub repository). The transferable part for us is the
  **audience-specific** rule: a brief is written for one reader with known
  vocabulary, which is stronger and more useful than a general plain-language
  style guide.
- **Match the reader's world, not ours.** NN/g heuristic 2 states the design
  "should speak the users' language… rather than internal jargon", and warns
  explicitly that terms "which seem perfectly clear to you and your colleagues may
  be unfamiliar or confusing to your users" (source: Jakob Nielsen, "10 Usability
  Heuristics for User Interface Design", 24 April 1994, last reviewed 30 January
  2024, https://www.nngroup.com/articles/ten-usability-heuristics/, accessed
  2026-10-06). Heuristic 9 makes the same demand of error text: plain language,
  no codes, and a constructive next step. This is the linguistic rule a brief
  needs — and the test is mechanical: **could the reader restate the choice and
  its consequence in their own words?**
- **Attention is the scarce resource, so offload, do not transfer.** NN/g's
  cognitive-load article separates **intrinsic** load (absorbing genuinely new
  information) from **extraneous** load (effort that does not help the reader
  understand), and says to eliminate the latter by offloading tasks — showing
  information rather than making people read and remember it, and setting smart
  defaults (source: Kathryn Whitenton, "Minimize Cognitive Load to Maximize
  Usability", NN/g, 22 December 2013,
  https://www.nngroup.com/articles/minimize-cognitive-load/, accessed
  2026-10-06). A brief that pastes the lead's technical reasoning is pure
  extraneous load; a brief that states options, consequences and a recommended
  default is intrinsic.
- **MADR upstreamed consulted/informed precisely to stay lightweight.** The
  decision was made for three stated drivers: the template must be easy to
  understand and lightweight (source: MADR ADR 0015, cited above). Our analogue
  is that a brief stays **prose with a bounded header** — not a table, not
  frontmatter, not a new command.

## Recommendation

**Adopt C1: the bounded plain-language decision brief on the item, with a stated
default — and reject C2 and C3.**

The brief is a comment on the item headed `decide:`, and the product owner answers
with a comment headed `decided:`. The brief carries, in this order:

1. **The question**, one sentence, no jargon — or the technical term spelled out
   once and immediately translated into its effect on the product.
2. **Why it matters**, in outcome terms (what changes for users, for cost, for
   risk) — never in mechanism terms.
3. **The options**: 2–3, each with its consequence in plain words, including the
   honest cost of the recommended one.
4. **The recommendation**, and why.
5. **The strongest argument against that recommendation.**
6. **The default**: what the lead will do if no answer arrives, and the absolute
   ISO date after which it executes.

**Why C1 wins.**

- It is the only candidate that fixes the actual gap. The gap is a **missing
  request side**, and C1 fills it; C2 adds prose to a contract without giving the
  decision a home, so it reproduces today's behaviour with better manners — the
  question still lands in chat and the answer still has nowhere durable to live.
- It answers the stated problem. A non-technical reader can act from (1)–(6)
  without reading anything the lead wrote, which is the MADR-0016 "outcome above
  the fold" principle applied to a decision rather than a document, and the
  NN/g "restate and explain the consequence" rule applied to a question.
- It is the cheapest of the three in surface terms: `arggon comment` already
  exists, the header grammar already has two proven siblings, and the
  answer-supersedes-earlier-answer rule is inherited rather than designed.
- The stated default is what makes it safe to send. A brief with a default is a
  **time-boxed proposal**; a brief without one is a blocker. That is the direct
  application of "an absent product owner can never wedge a container's children",
  and it is why this reduces product-owner cost instead of adding a step.
- C3 is rejected on "one home, one style": a decisions corpus would hold
  questions and answers in a second place, in a second voice, alongside the ADRs
  that record what those decisions became — and the risk is a decision recorded
  in the corpus and never in the ADR, which is precisely the failure
  `task-exploration-decision-records` exists to prevent.

**What this costs — stated honestly.**

- **A brief is work**, and the lead now writes one per decision instead of one
  chat line. The routing rule bounds it: briefs are owed only for the authority
  map's rows and for hard-to-reverse calls; everything else the lead decides and
  records on the item as a plain comment.
- **The recommendation-first shape is a confirmation-bias risk.** The two
  countermeasures (self-contradiction line, first-class "decided otherwise") are
  conventions, not gates; they work only because a human reads them.
- **Report-only means silence is invisible to CI.** An unanswered brief is a
  `spec analyze` finding, never a gate — the same trade ADR 0021 §4 already made
  for acceptances, and it is a trade, not a free win.
- **The PO's cost is bounded, not zero.** What is being removed is the cost of
  _not understanding the question_. What remains is one bounded read per
  decision, which is the irreducible part of the role.

**Reversal condition, written so it is falsifiable.** Revisit if (a) briefs are
routinely rubber-stamped — measurable as answer latency collapsing to "immediately
with no scope note", or an answered-brief ratio near 1.0 with zero "decided
otherwise" replies across a meaningful sample; or (b) the unrouted-question case
dominates, i.e. more real decisions are made in chat than in briefs — which would
mean the routing rule is wrong, not that the convention is.

## Alternatives considered

- **C2 — teach only (contract prose, no artifact).** Rejected: it fixes tone, not
  the gap. There is still no home for the question or the answer, so the record
  still lives in a transcript. Its only merit — zero new surface — is fully
  available inside C1.
- **C3 — a `docs/decisions/` corpus with its own scanner.** Rejected on the
  second-home problem and on YAGNI: the volume of product-owner decisions in a
  repo of this size does not justify a new surface, tracker or CI lane. Revisit if
  briefs ever need to be enumerated across repos, which `show`/`report` cannot do
  cheaply.
- **A mandatory brief on every decision.** Rejected outright: it inverts ADR 0021
  §3. The model must reduce per-item human cost, never add one. The routing rule
  is the load-bearing half of this recommendation.
- **Gate a transition on the product owner's answer.** Rejected as forgeable or
  unusable, for the reason ADR 0021 §4 already recorded and this record inherits.
- **Let the lead answer its own question and inform the product owner after.**
  Rejected for the authority-map rows; **retained** for everything the routing
  rule excludes. Recorded here so the boundary is explicit rather than implied.
- **A `priority`-style frontmatter field for briefs.** Rejected: a schema change
  carrying a fact a comment already carries, and a kernel-trusted field a worker
  could write — the same objection that rejected `role:`/`owner:`.

## Decision

Adopted as **[ADR 0026 — The bounded plain-language decision brief: how a
delivery lead brings a decision to the product
owner](../adr/0026-owner-decision-brief.md)** (Status: Proposed; becomes
Accepted at PR merge, per the ADR lifecycle in `docs/engineering.md` §ADR
process).

The ADR adopts **C1** as recommended above: the six brief fields and the answer
grammar become the convention itself rather than a description of one; the
routing rule is normative, so a brief is owed only for the ADR 0021 §2
authority-map rows and for hard-to-reverse calls; the stated default and the
self-contradiction line are normative too, with `decided: other` as a
first-class reply; and it is report-only, never a gate, on ADR 0021 §4's
reasoning. ADR 0021 §2 is unchanged — the delivery lead still recommends, the
product owner still decides. This is a **Behavioral** methodology change and
reaches adopters through the ADR 0016 channel, linking this exploration as
Input. Artifacts follow in order: this
doc → ADR 0026 → spec (the edge-case table above as acceptance criteria) → plan +
tasks with `depends_on`. **No implementation task may be claimed before that spec
passes `arggon spec analyze` with no NEW findings** (ADR 0017 hard gate).
