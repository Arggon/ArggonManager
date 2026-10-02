---
type: story
status: todo
id: story-adopter-feedback
title: "Adopter friction channel: capture, dedupe, human-gated publish"
parent: reverse-feedback-channel
labels: []
created: "2026-10-02"
updated: "2026-10-02"
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/story-adopter-feedback.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Adopter friction channel: capture, dedupe, human-gated publish

# Adopter feedback channel: friction capture, dedupe, human-gated publish

## Context

ArggonManager's only work channel points **inward** (product → adopter). Nothing
points back, and the two friction protocols in `ArggonManager/docs/labs/` are
maintainer-side, local and single-machine — they cannot observe an adopter. So the
project has no way to learn from real use outside its own checkout, while its own
tracker shows 10 repeat reports of the same failure classes.

This story owns the reverse channel: capture friction where it happens, dedupe it,
redact it, and let a **human** decide whether it becomes work. The invariant is
that the in-tree tracker stays the single system of record — no design here lets an
agent write to GitHub.

## Acceptance

- [x] The gap is grounded in evidence, not opinion: local mechanics, live
      `gh`/git data, and the existing labs protocols all read and cited
- [x] The user's proposed mechanism ("open a new GitHub issue on friction") is
      **validated against external precedent and refuted on cited evidence** —
      `deftai/directive#3633` (a sanctioned escalation skill missed by an agent
      that was escalating), `claude-code#93077` (cross-repo instruction
      precedence), OpenCode's `duplicate-issues.yml` (AI-shaped input auto-closed),
      claude-code's 27.6% duplicate rate
- [x] The refutation **improves** the design rather than dead-ending it: three
      independently converged projects (`ce-ai` shipped, `ContextDesk` shipped,
      `subfloor` declined) plus Sentry's fingerprint rules fix the trigger,
      dedupe, redaction and human-gate questions the original proposal left open
- [x] Honest negatives recorded: no evidence of a standardized YAML-front-matter
      issue convention; no incident of an adopter leaking paths via this exact
      trigger (PixelLeak is the same failure _shape_, a different cause);
      convergent designs are small-project, not proven at scale
- [ ] The decision is recorded as an ADR (carrier change is **behavioral**) and the
      hunted edge cases become spec acceptance criteria

## Notes

Non-goal for this story: changing the in-tree-tracker doctrine. That is settled
(`docs/agents.md` §0) and this story works within it — the recommended design has
the **agent emit a redacted report or a prefilled URL for a human to submit**, so
`docs/agents.md` §0 is never violated and no second canonical record is created.

The recommendation is staged; stage 1 (trigger + capture + report on the
maintainer's own machine) needs no adopter opt-in and attacks this repo's known
duplicate-filing debt immediately.
