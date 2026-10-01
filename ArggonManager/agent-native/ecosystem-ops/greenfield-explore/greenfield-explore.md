---
type: story
status: todo
id: greenfield-explore
title: "Greenfield exploration methodology: think first by default"
parent: ecosystem-ops
labels: []
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/greenfield-explore/greenfield-explore.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Greenfield exploration methodology: think first by default

## Context

The repo's exploration methodology today is a **stack-spike record**
(`arggon stack explore`, `templates/exploration.md`: candidates → criteria →
findings → recommendation). It is designed for comparing library/framework
candidates — not for planning a whole new project or subsystem. Nothing in the
pipeline (`references/methodology.md` work-classification table,
`ArggonManager/docs/agents.md` §Specs and plans) makes up-front thinking the
**default for greenfield**: a new project can jump straight to spec/tasks, and
edge cases are discovered during implementation (as bugs) instead of before it.

Three external skills model the missing pieces (all files fetched 2026-10-01
from the respective repos):

- **Fission-AI/OpenSpec** `skills/openspec-explore/SKILL.md` — the
  thinking-not-building stance, ground-in-code before asking, explicit capture
  confirmation, handoff naming instead of implementing.
- **obra/superpowers** `skills/brainstorming/` (`SKILL.md`,
  `visual-companion.md`, `spec-document-reviewer-prompt.md`) — classify
  spike/bounded/architectural before the first question, one-way ratchet, hard
  gates before any implementation, 2–3 approaches with trade-offs, sectioned
  design, spec self-review.
- **mattpocock/skills** `skills/productivity/grill-me/` (`SKILL.md`,
  `agents/openai.yaml`, `docs/productivity/grill-me.md`) — frontier-rounds
  interrogation (each round = every question whose prerequisites are settled),
  ends when the frontier is empty, ungrillable questions route to a prototype.

This story lands the synthesis: an explicit **Greenfield Exploration
Protocol** that becomes the default first phase for greenfield projects, with
an **edge-case hunt** that resolves every hunted case into a spec acceptance
criterion, an explicit non-goal, or a spike — before implementation exists.

Docs + skill only; no kernel/CLI changes.

## Acceptance

- [x] task-greenfield-explore-adr: exploration doc + ADR recorded and merged
- [x] task-greenfield-explore-carriers: protocol wired into the methodology carriers (skill references + commands + docs pointer), copies byte-equal, impact class Behavioral stated
- [x] Both PRs reviewed (verdict on the item) and merged; `arggon validate` ok on main; `npm test` green
- [x] `arggon spec analyze` reports no NEW findings introduced by the new docs

## Notes
