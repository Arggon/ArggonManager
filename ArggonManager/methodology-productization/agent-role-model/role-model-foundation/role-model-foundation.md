---
type: story
status: todo
id: role-model-foundation
title: "Role model foundation: supersede the parity invariant, name the authority map, record product acceptance"
parent: agent-role-model
labels: [methodology, roles]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
---

<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/role-model-foundation.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Role model foundation: supersede the parity invariant, name the authority map, record product acceptance

## Context

The loop is already helper-led in practice while the governing sentence still
claims flat parity, and the product owner's most important call — whether a
finished piece is accepted — has no record. Anyone reading the docs cannot tell
which calls belong to the product owner, what each role decides, or where an
acceptance lives; the shipped helper contracts still describe the work in the
vocabulary of one familiar case rather than in the project's own terms.

This story makes the split explicit end to end: the superseding record, the
two-axis rule in the carriers, role contracts that define each role by what it
decides, a bounded acceptance record with tiered depth, the request-side brief
that brings a decision to the product owner in plain words, and the seam
precondition that lets the rename land without stranding a still-usable helper
file. (ADR 0021; ADR 0026.)

## Acceptance

- [x] The carriers state the two-axis rule — anyone or any helper may claim, work, review, comment and merge under the same rules and records, while a named set of calls belongs to the product owner with the irreversible ones person-only — and the role table defines each role by what it decides (ADR 0021 §§1–2, §6.1)
- [x] Helper contracts claim as their role id, never the product owner's login, and state their gates in the project's own terms with the familiar case as a worked example only (ADR 0021 §§5–6.2)
- [x] Product acceptance is a bounded author-attributed record on the container with tiered depth per class of work, report-only and never a gate; the decision-brief request side (question, why it matters, options, recommendation, case against, default with an absolute date) rides the same report-only surface (ADR 0021 §§3–4; ADR 0026)
- [x] Orphaned generated seams are reported and removed only when byte-identical to what was generated, so the rename lands without stranding a still-usable helper file (ADR 0021 §6.2a′)
- [x] The project's verification gates and `arggon validate` stay green with no new finding naming this story

## Notes
