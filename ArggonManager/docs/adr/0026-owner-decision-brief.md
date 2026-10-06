# 0026 The bounded plain-language decision brief: how a delivery lead brings a decision to the product owner

- Status: Proposed
- Date: 2026-10-06
- Deciders: product owner (Gonzalo), delivery lead (Arggon)
- Input: [exploration-owner-decision-brief-025](../explorations/exploration-owner-decision-brief-025.md) (2026-10-06)
- Methodology impact class: **Behavioral** (agents must re-learn something) — reaches adopters through the ADR 0016 channel

> Status note (2026-10-06): shipped **Proposed**, per `docs/engineering.md`
> §ADR process ("Proposed in a PR → Accepted when merged") and this project's
> precedent (ADR 0022, 0023, 0025). Flip to `Accepted` on merge or in an explicit
> accept commit; nothing below this note is rewritten afterwards.

## Context

The methodology already defines how a decision is **answered** and how a change
is **judged**, both as bounded, author-attributed comment headers on an item:
`accept:` for the product owner's acceptance of a container (ADR 0021 §4), and
`verdict:` for the standards reviewer's judgement (`docs/engineering.md`
§Review bar → Review verdicts). It says nothing anywhere about how a decision is
**asked**.

That is the whole gap, and it is a gap in the method rather than in a person.
ADR 0021 §2 names the five decisions the product owner owns and the record each
one already has, but no carrier names the request side: not the engineering or
agents playbook, not the generated delivery-lead contract, not the skill. The
bounded-header family has two members and a missing third.

So the failure is not that the lead over-asks. It is that **the question has no
home**, so it lands wherever the session happens to be, and the answer, when it
comes, has nowhere durable to live. Both halves are the record's problem: the
question is lost to a transcript, and the decision is re-litigated by the next
person who cannot see why it went the way it did.

The product owner raised this on 2026-10-06 in exactly these terms: the delivery
lead keeps bringing **technical** decisions, and a product owner with no technical
background cannot take one. ADR 0021 §6.2 — the methodology is for "any project —
not only software", while the product owner is a person not assumed to share the
lead's vocabulary — makes that a contradiction rather than a matter of taste. An
escalation written in the lead's own register is out of scope for the very method
that requires the escalation.

Measured, not assumed: three open items in this repository ask the product owner
for a judgement while recording no plain-language statement of the choice and no
recommendation (`task-decide-codebase-memory-default-discovery`,
`task-decide-adr-0021-index-title-editorial-vs-verbatim`,
`task-arm-strict-worktree-writes`). The third is the tell — a
flip-the-switch-or-leave-it question, written so that only someone who already
knows the mechanism can answer it.

This is **Behavioral**: a new obligation on the delivery-lead role, carried into
every adopting project through the ADR 0016 channel. That is why it is an ADR and
not a documentation tweak.

## Decision

Adopt **C1** from the exploration: a bounded, plain-language **decision brief**,
written by the delivery lead **on the item** as a comment headed `decide:`,
answered by the product owner with a comment headed `decided:`. Prose with a
bounded header, report-only, never a gate — exactly like its two siblings.

**No authority moves.** [ADR 0021](./0021-agents-primary-workers-human-product-owner.md)
§2 is unchanged: no decision is granted, moved or removed by this record. The
delivery lead still **recommends**; the product owner still **decides**.
Sequencing is still not priority — the lead sequences delivery, the product owner
sets the `priority` field (ADR 0021 §6.1 boundary 1). What this record adds is
only the missing **request side** of a split that already exists.

### 1. The brief

A brief is a comment on the item headed `decide:`, written for **one** reader
whose vocabulary is not assumed. The header may carry a short scope in
parentheses, exactly as `verdict:` and `accept:` do. Then six fields, in this
order:

1. **The question**, in one sentence. Any specialist term is translated, at first
   use, into what it changes for the product.
2. **Why it matters**, in outcome terms — what changes for the people who use it,
   what it costs, what it risks. Never in mechanism terms: how it will be built is
   the lead's decision, not the owner's.
3. **The options** — two or three, never one. Each with its consequence in plain
   words, and for the recommended one its honest cost stated rather than implied.
4. **The recommendation**, and why.
5. **The strongest argument against that recommendation**, written by the lead. A
   brief that omits this field is not a brief.
6. **The default**: what the lead will do if no answer arrives, and the absolute
   date after which it happens. Never a relative deadline ("by Friday") — the date
   is absolute, so it cannot be read in another week than it was written.

Fields 5 and 6 are not decoration; §3 and §4 are why they are there.

**The test for whether a brief is written well is mechanical: could the reader
restate the choice and its consequence in their own words?**

### 2. The answer

A `decided:` comment, mirroring the header grammar of its siblings:

```
### 2026-10-14 @gonzalo
decided: option B (the second wave)
- it is the only option that does not spend the thing we are short of
```

It carries the chosen option, optionally a short scope note in parentheses, then
the reasoning. `decided: other` is a **first-class, unremarkable reply**:
answering "none of these" is a normal answer to a normal brief, and no lead
treats it as an escalation. A later `decided:` comment supersedes an earlier one,
and a superseded brief is never rewritten — by this rule and by the ADR lifecycle.

Attribution only, never authentication: the same line ADR 0021 §4 draws.

### 3. The stated default is what makes a brief safe to send

**A brief with a default is a time-boxed proposal. A brief without one is a
blocker, and it is not sent.** Silence then carries a meaning the product owner
has already chosen by not answering: the default executes on the stated date, and
the record says so.

This is ADR 0021 §3's rule — an absent product owner can never wedge a
container's children — applied to the request side, where it had never been
applied. It is why a brief is cheap enough to send, and why escalation replaces a
session rather than adding a step.

A brief is never sent without a default because "this one really needs you" is
not a state the record can carry. A repository with no product owner stays
compliant by default, exactly as it does for `accept:`: the default executes, and
the brief records that it did.

### 4. A recommendation-first brief is a confirmation-bias vector

Field 4 puts a preferred option in front of a reader who is, by construction, not
the person who knows most about it. That is what makes the record decidable in
minutes, and exactly what makes a lazy "yes" easy. A brief that offers only
agreement is a confirmation dialog with no cancel button.

**Two counters, both already in the grammar, and both conventions rather than
gates:**

1. **Field 5 is mandatory** and the lead writes it. The strongest argument against
   the lead's own recommendation is stated before it is asked for, so a
   knowledgeable reader has a reason to speak rather than an excuse.
2. **`decided: other` is a first-class reply** — unremarkable to give and
   unremarkable to receive.

The evidence is Klein's premortem work: projects fail partly because "too many
people are reluctant to speak up about their reservations during the all-important
planning phase", and making it safe for a knowledgeable dissenter to speak
improves the odds (Gary Klein, "Performing a Project Premortem", _Harvard
Business Review_, September 2007). A second finding sits behind this: a bare
confirmation — "are you sure?" with no detail — has only one sensible reaction,
and repeated warnings train readers to stop reading the next one (NN/g,
"Confirmation Dialogs Can Prevent User Errors — If Not Overused", 2018). Which is
why "I need your call on this" is not a brief.

### 5. The routing rule

**A brief is owed only for:**

- **the rows of the ADR 0021 §2 authority map** — direction and priority, product
  acceptance of a container, accepting residual risk, taking over another
  writer's claim, publishing a release; and
- **hard-to-reverse calls** — the ones whose cost of being wrong later is paid in
  more than the time it takes to undo.

**Everything else the delivery lead decides and records on the item as a plain
comment.** A question with one real option is not a brief: the lead decides it and
records why. A brief never replaces the record a row already has — the
`priority` field, an `accept:` comment, the ADR 0015 waiver, the claim-takeover
gate and the human-pushed release all keep the records they have, and the brief is
the request, not the answer.

This rule is the load-bearing half of the decision. Without it every decision
becomes a brief, which inverts ADR 0021 §3: the model must reduce per-item human
cost, never add one.

One item is canonical for a given decision. If two items brief the same decision,
one is the record and the other links to it.

### 6. Never a gate

Inherited from ADR 0021 §4, and kept for its reasoning rather than only its
conclusion. **The tracker has no identity layer** — a session id is correlation
metadata — so nothing a person writes can be authenticated. A gate built on it
would therefore be **forgeable or unusable**, and both are worse than not having
one: a forgeable gate teaches its reader that the gate means nothing, and an
unusable one blocks work on a signal nobody can produce. So:

- no transition consults a brief or an answer;
- no command refuses because one is missing;
- **no automated check fails on it** — in software, no pipeline goes red over an
  unanswered brief;
- visibility is report-only, the same trade ADR 0021 §4 already made for
  acceptances.

No new frontmatter field, no new command, no new schema and no new surface: the
existing comment command already writes one, and the header grammar already has
two proven siblings.

### 7. Domain neutrality

Every field is named in the **project's own terms** (ADR 0021 §6.2). A brief is
about a choice and its consequence, so its vocabulary is the project's: "a second
supplier for the same part", "the price we pay each year", "what a customer sees
if it is wrong" — never the mechanism vocabulary the lead happens to use. The
worked example for this project is software ("a shared library", "a feature flag",
"a database index"), and it appears in carriers as an example only, never as the
convention's own language. A reader who has never written anything technical must
be able to follow the convention itself, because that reader is who it exists for.

### 8. Reversal condition

**Revisit this record if** (a) briefs are routinely rubber-stamped — measurable as
answer latency collapsing to "immediate, no scope note", or an answered-brief
ratio near 1.0 with zero `decided: other` replies across a meaningful sample; or
(b) more real decisions are made in chat than in briefs, which would mean the
routing rule is wrong, not the convention.

Both limbs are measurable and each names its own target: (a) at the counters in
§4, (b) at the routing rule in §5. Neither limb is a reason to abandon the record.

## Consequences

What it buys:

- **The question and the answer get a durable home**, next to the work they govern
  and in the reader's own words. That is the gap that made this record necessary.
- **A later reader sees the why.** A recorded decision is not re-litigated by the
  next person who cannot see why it went the way it did.
- **The escalation stops costing a session.** The question is written once, on the
  item, and survives the session that produced it.
- **A brief replaces a chat question; it does not add a step.** The number of
  product-owner touchpoints per shipped change does not rise, and ADR 0021 §3's
  promotion-policy tiers are unchanged.

What it costs, stated honestly:

- **A brief is work.** The lead writes one per decision instead of one line in a
  session. The routing rule bounds it; it does not make it free.
- **Recommendation-first is a bias risk mitigated by convention only.** Field 5
  and `decided: other` work because a human reads them. Neither is checkable, and
  neither is meant to be.
- **Report-only means silence is invisible to any automated check.** An unanswered
  brief is a report-only finding, never a failure — the same trade ADR 0021 §4
  already made, and a trade rather than a free win.
- **The product owner's cost is bounded, not zero.** What is removed is the cost
  of not understanding the question. What remains is one bounded read per decision
  that genuinely needs them, which is the irreducible part of the role.

How it ships:

- **Behavioral**, so adopters receive it through the ADR 0016 propose channel, and
  the skill sources and their bundled copies stay byte-equal in the same PR.
- **Not decided here:** which read-only surface reports a brief that was never
  answered, and the carrier text that teaches the convention. Both belong to the
  spec and the carriers that follow this record, in that order.

## Alternatives considered

- **C2 — teach only:** put the plain-language rule in the delivery-lead contract
  and change nothing else. Rejected: it fixes tone, not the gap. There is still no
  home for the question or the answer, so the record still lives in a transcript —
  today's behaviour with better manners.
- **C3 — a `docs/decisions/` corpus** with its own template and a report-only
  scanner over it. Rejected on one home, one style: a second surface holds
  questions and answers in a second voice, alongside the records that own what
  those decisions became, and the failure mode is a decision recorded in the
  corpus and never in its own record. The volume of product-owner decisions in a
  repository this size does not justify a new surface.
- **A brief on every decision.** Rejected outright: it inverts ADR 0021 §3. The
  model must reduce per-item human cost, never add one. This is why §5's routing
  rule is normative and not advisory.
- **A `priority`-style frontmatter field** recording that a brief is outstanding.
  Rejected: a schema change carrying a fact a comment already carries, and a
  kernel-trusted field a worker could write — the same objection that already
  rejected `role:`/`owner:` (ADR 0021 §Consequences).
- **Gate a transition on the product owner's answer.** Rejected as forgeable or
  unusable, for the reason §6 restates and inherits from ADR 0021 §4.
- **Let the delivery lead answer its own question and inform the product owner
  afterwards.** Rejected for the authority-map rows, where the owner's answer is
  the decision. **Retained** for everything §5's routing rule excludes — recorded
  so the boundary is explicit rather than implied, and so nobody reads the
  retained half as a loophole.
