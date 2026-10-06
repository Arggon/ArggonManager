---
type: task
status: in_progress
id: task-adr-0026-owner-decision-brief
title: "ADR 0026: the bounded plain-language decision brief — a delivery lead brings a decision to the product owner with options, one recommendation, and a default that executes unanswered"
assignee: arggon-delivery-lead
branch: feat/task-adr-0026-owner-decision-brief
parent: role-model-foundation
labels: [methodology, roles, adr]
priority: p0
created: "2026-10-06"
updated: "2026-10-06"
claimed_at: "2026-10-06T14:01:55.152Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr-0026-owner-decision-brief
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-adr-0026-owner-decision-brief.md
  Leaves live only under a story. id is the filename stem: task-adr-0026-owner-decision-brief.
  CLI `arggon create task adr-0026-owner-decision-brief` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0026: the bounded plain-language decision brief — a delivery lead brings a decision to the product owner with options, one recommendation, and a default that executes unanswered

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG
Input: [exploration-owner-decision-brief-025](../../../docs/explorations/exploration-owner-decision-brief-025.md) (2026-10-06) — classification **greenfield** (entered bounded, upgraded in the ground phase: there is no request-side convention anywhere, and this is a Behavioral change reaching every adopter through the ADR 0016 channel).

**The decision the ADR records.** Adopt C1: a bounded, plain-language **decision brief** the delivery lead writes **on the item**, answered by a bounded `decided:` comment. Authority does not move — ADR 0021 §2 stands verbatim; the lead still recommends, the product owner still decides. This record adds only the missing **request side**.

Brief fields, in order: the question in one sentence (technical term translated into its effect on the product) · why it matters in outcome terms, never mechanism terms · 2–3 options each with its plain-language consequence, including the honest cost of the recommended one · **the recommendation and why** · **the strongest argument against that recommendation** · **the default that executes if no answer arrives, and the absolute ISO date**.

Two load-bearing constraints, both from the exploration's findings:

- **The stated default is what makes it safe to send.** A brief with a default is a time-boxed proposal; a brief without one is a blocker. This is ADR 0021 §3's "an absent product owner can never wedge a container's children" applied concretely.
- **A recommendation-first brief is a confirmation-bias vector**, mitigated by convention not by gate: the self-contradiction line, and `decided: other` as a first-class unremarkable reply. Grounded in Klein's premortem finding (HBR, 2007-09).

**Routing rule (the other load-bearing half).** A brief is owed **only** for the ADR 0021 §2 authority-map rows and for hard-to-reverse calls. Everything else the lead decides and records as a plain item comment. Mandating a brief on every decision is explicitly rejected — it inverts "the model must reduce per-item human cost, never add one".

**Rejected, with reasons recorded:** C2 teach-only (fixes tone, not the gap — the question still lands in chat and the answer has nowhere durable to live); C3 a `docs/decisions/` corpus (second home, second style, forks the record against the ADR; the volume does not justify a surface); a frontmatter field (schema change carrying a fact a comment already carries — the objection that already rejected `role:`/`owner:`); any gated transition (forgeable or unusable without an identity layer, inherited from ADR 0021 §4).

**Falsifiable reversal condition**, to be written into the ADR verbatim: revisit if (a) briefs are routinely rubber-stamped — measurable as answer latency collapsing to "immediate, no scope note", or an answered-brief ratio near 1.0 with zero `decided: other` replies across a meaningful sample; or (b) more real decisions are made in chat than in briefs, which would mean the routing rule is wrong, not the convention.

## Acceptance

- [ ] ADR 0026 written at `ArggonManager/docs/adr/0026-<owner-decision-brief>.md` with Status/Date/Deciders + Context / Decision / Consequences / Alternatives, per `ArggonManager/docs/engineering.md` §ADR process, and its row added to `ArggonManager/docs/adr/README.md`
- [ ] ADR states the **methodology impact class: Behavioral** and links exploration 025 as Input
- [ ] The six brief fields and the answer grammar are written out as the convention, not as a description of one
- [ ] The ADR states explicitly that **ADR 0021 §2 is unchanged** — no authority moves, and the delivery-lead contract still recommends rather than decides
- [ ] The **routing rule** is normative (which decisions owe a brief) and the "brief on every decision" rejection is recorded under Alternatives
- [ ] The **reversal condition** is recorded verbatim, falsifiable, with both limbs
- [ ] Exploration 025's Decision section links this ADR (closes the exploration-vs-ADR gap `task-exploration-decision-records` exists to prevent)
- [ ] ADR lifecycle honored: Proposed in the PR, Accepted on merge — never rewritten in place afterwards

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG
### 2026-10-06 @arggon-delivery-lead

Priority provenance: **`p0` set by the product owner on 2026-10-06** ("this is top priority. Let's start working on this."), after reading exploration 025. Recorded because ADR 0021 §6.1 boundary 1 makes the `priority` field the product owner's and the lead's call is sequencing only — the field, not the recommendation, is what carries their decision here.

**Delivery sequencing (mine, not the priority call).** The chain is strictly causal, so it runs as three single-item waves, not a parallel wave:

1. **W1 — this item (ADR 0026).** The decision is already taken and recorded in exploration 025's Recommendation; the ADR is the record of it. Nothing before it can be written.
2. **W2 — `task-spec-owner-decision-brief`.** Specifies the convention and turns exploration 025's edge-case table into acceptance criteria.
3. **W3 — `task-wire-decision-brief-carriers`.** **Blocked by the ADR 0017 hard gate**: no claim until W2's spec passes `arggon spec analyze` with no NEW findings.

File-disjointness is not the constraint here — causality is: each item consumes the previous item's artifact, so overlapping waves would be a race, not a wave. They are still separate worktrees, one maker each.

**Watch for in W3:** it is Behavioral, so both skill copies must land byte-equal in the same PR and the ADR 0016 release note must name the change. There is a standing item for the drift-gate interaction (`bug-seam-drift-gate-blocks-new-generated-seam-content`) — a PR adding new generated seam content fails the drift gate until a release + re-pin, so W3 must be checked against that before it is opened, not after it goes red.
