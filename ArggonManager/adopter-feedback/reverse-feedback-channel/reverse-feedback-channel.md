---
type: epic
status: todo
id: reverse-feedback-channel
title: Reverse feedback channel
parent: adopter-feedback
labels: []
created: "2026-10-02"
updated: "2026-10-02"
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/reverse-feedback-channel.md (epic index; required).
  parent MUST be the initiative id. Container ids must not start with task-/bug-.
-->

# Reverse feedback channel

## Context

The umbrella for turning adopter-side friction into work ArggonManager actually
picks up — without letting an agent write to a public tracker, and without
letting public automation read an agent's output as instructions.

## Acceptance

- [x] A validated, evidence-backed design exists
      ([`exploration-adopter-feedback-channel-024`](../../docs/explorations/exploration-adopter-feedback-channel-024.md))
- [ ] An ADR settles the cross-cutting decision and the spec passes
      `arggon spec analyze` with no NEW findings

**Left unticked on purpose** (reviewer N3): the two halves land at different
times, and splitting them would contradict the ADR's own status line. The spec
gate is already met —
[`spec-friction-capture-020`](../../docs/specs/spec-friction-capture-020.md) passes
`arggon spec analyze` with zero NEW findings. The word **settles** waits on
acceptance: ADR 0024 ships `Proposed` and flips to `Accepted` on merge (or in an
explicit accept commit), per `docs/engineering.md` §ADR process. Ticking this box
before that would assert an acceptance that has not happened.

## Notes
