---
type: story
status: todo
id: story-capability-matrix
title: Machine-readable capability matrix (spec S3)
parent: native-agent-adapters
labels: []
created: "2026-10-02"
updated: "2026-10-02"
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-capability-matrix/story-capability-matrix.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Machine-readable capability matrix (spec S3)

## Context

Every capability the method assumes should be declared per helper, with the
shared kernel named as the enforcement of record wherever a helper hook is only
assistance. Without that declaration an adopter cannot tell what their helper
enforces natively and what it simply cannot express — and a difference a helper
cannot express must stay a written gap, never a second rule.

This story commits the machine-readable matrix — methodology invariant by
helper to native mechanism or explicit gap — and makes the status report print
the gap rows, report-only, including in a real adopter tree. (ADR 0020
§Decision.3; spec-methodology-adapters-017 §S3.)

## Acceptance

- [ ] A committed machine-readable matrix covers every methodology invariant by supported helper, naming the native mechanism used or carrying an explicit gap note for what the helper cannot express (ADR 0020 §Decision.3; spec §S3)
- [ ] The status report prints the gap rows report-only, no gap row is reported closed that the seam does not close, and the matrix reaches the adopter tree through the packaged bundle so the report works outside this repo
- [ ] The project's verification gates and `arggon validate` stay green with no new finding naming this story

## Notes
