---
type: task
status: todo
id: task-promote-task-to-story
title: promote/convert task to story (import flattens ideas under one container)
parent: story-import-issues
labels: [p3]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-import-issues/task-promote-task-to-story.md
  Leaves live only under a story. id is the filename stem: task-promote-task-to-story.
  CLI `arggon create task promote-task-to-story` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# promote/convert task to story (import flattens ideas under one container)

## Context

Reported by the casa-pendiente experiment (2026-09-15): `import-issues` flattens every imported idea as a leaf (task/bug) under one container story. For the greenfield flow (ideas as GitHub issues → import → build hierarchy) the agent needed FEATURE-LEVEL stories with children and had to hand-build the whole hierarchy with `arggon create`, discarding the import structure. Related gap: there is no way to PROMOTE an existing task to a story (type conversion keeping body/issue/labels), which is the natural repair move after import.

## Acceptance

- [ ] Decide + land a promotion path: either `arggon update <task-id> --type story` (converts in place: moves file to story layout, validates children edge rules) or a documented import option that imports top-level ideas as stories — whichever is smaller, documented in the item
- [ ] Tests: promotion with no children, with children (file moves), invalid conversions refused
- [ ] Docs (README + convention.md if placement rules change)

## Notes
