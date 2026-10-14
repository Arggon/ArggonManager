---
type: story
status: in_progress
id: external-harness-evaluation
title: "Evaluate and adopt-or-decline external harness / context / compaction tooling against the methodology's own bars"
assignee: arggon-delivery-lead
parent: external-agent-tooling
labels: [methodology, evaluation]
priority: p2
created: "2026-10-05"
updated: "2026-10-14"
claimed_at: "2026-10-14T12:42:50.891Z"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/external-harness-evaluation/external-harness-evaluation.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Evaluate and adopt-or-decline external harness / context / compaction tooling against the methodology's own bars

## Context

Someone asked whether the method should adopt outside helpers for running,
briefing, or compressing the work, and the names turned out to denote no
coherent stack. The method already owns two of the three underlying problems —
judging work through its own review and trial runs, and holding a budget on how
much briefing a session carries — while compression stays the helper's own job.

This story judges the named candidates against the method's own bars and keeps
only the idea worth taking: carrying lessons across runs while discarding dead
ends, on the existing substrate and inside the existing loop. (ADR 0022.)

## Acceptance

- [x] The exploration records what the named candidates actually are and judges each against the standing bars — closes a gap named in advance, runs inside the existing loop rather than beside it, keeps every actor inside the permission and review discipline (ADR 0022)
- [x] No candidate is adopted as a second executor or second loop; the lesson-store idea is carried forward as a spike on the existing substrate
- [x] The project's verification gates and `arggon validate` stay green with no new finding naming this story

## Notes
