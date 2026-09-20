---
type: story
status: done
id: story-container-rollup
title: Container auto-completion
assignee: Arggon
parent: cli
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-container-rollup/story-container-rollup.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Container auto-completion

## Context

After the 2026-09-11 wave, every leaf (story/task/bug) reaches `done` while its story, epic, and initiative containers stay `todo` forever: v0's no-rollup rule plus the illegal `todo -> done` transition leave containers stranded until a human chains two manual updates per level. This story closes that gap — when all internal work of a container closes, the container completes automatically.

## Acceptance

- [x] Automatic container completion implemented in the shared update path (see task-container-auto-done)
- [x] Behavior documented in `docs/convention.md` (no-rollup exception) and `docs/json-output.md` (additive `autoCompleted`)

## Notes

- Opt-out preserved for callers that must not touch ancestors: `--no-cascade` / `cascade: false`.
