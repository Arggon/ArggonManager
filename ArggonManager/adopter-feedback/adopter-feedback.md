---
type: initiative
status: todo
id: adopter-feedback
title: "Adopter feedback: the reverse channel from adopting repos"
labels: []
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/adopter-feedback.md (initiative index; required).
  No parent. Omit assignee when unassigned.
-->

# Adopter feedback: the reverse channel from adopting repos

## Context

Every channel ArggonManager has is one-directional. This initiative owns making the
loop close: adopters and their agents hit friction, and the project learns from it
without weakening the rule that the in-tree tracker is the single source of truth.

## Acceptance

- [x] The gap is identified and evidenced; a design is validated against local
      mechanics and external precedent
- [ ] The design ships: trigger, capture, dedupe and human-gated publish, with the
      edge cases resolved into spec acceptance criteria

## Notes

Opened 2026-10-02 as a fresh chain rather than reusing a `done` container — the
repo's own rule is never to reopen `done`/`cancelled`, and
`agents.md` §5 warns against modelling new administrative leaves under closed
product containers.

### 2026-10-16 @ses_eccc605dbffeHEwy9fqO3FP5tx
### Lead note — stage 1 shipped, initiative stays open (delivery lead, 2026-10-16)
Epic reverse-feedback-channel is done (story-adopter-feedback auto-completed; ADR 0024 Accepted; spec green). The initiative's second box is not yet true, so this container stays open honestly: trigger + capture + dedupe + tier-B human-gated publish have shipped, but no adopter carries the trigger yet and stages 2/3 are DEFERRED per the two spikes — tier C waits on a passing compliance re-sweep after ArggonStores runs init (trigger present ≥ 14 days), and any stage-3 automation waits on reporters(F, 30d) ≥ 3 attributable. When those data arrive, the re-sweeps — not new design — close this out.
