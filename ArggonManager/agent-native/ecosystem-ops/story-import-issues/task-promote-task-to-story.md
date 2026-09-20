---
type: task
status: done
id: task-promote-task-to-story
title: promote/convert task to story (import flattens ideas under one container)
assignee: Arggon
branch: feat/task-promote-task-to-story
parent: story-import-issues
labels: [p3]
created: "2026-09-15"
updated: "2026-09-16"
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

- [x] Decide + land a promotion path: either `arggon update <task-id> --type story` (converts in place: moves file to story layout, validates children edge rules) or a documented import option that imports top-level ideas as stories — whichever is smaller, documented in the item
- [x] Tests: promotion with no children, with children (file moves), invalid conversions refused
- [x] Docs (README + convention.md if placement rules change)

## Notes

DECIDED + LANDED (2026-09-16): in-place conversion via `arggon update <task-id> --type story` (v1: task→story only; demotion refused, bugs refused, already-story refused, missing/invalid grandparent epic refused — all pre-mutation). Design notes:
- The file moves to the story index layout under the task's grandparent epic (exactly where `create story` places it); the promoted story starts empty of children (it was a leaf, so "promotion with children" is impossible by construction — the file-move is covered by tests).
- The id renames `task-x` → `story-x`: validate forbids container ids starting with `task-`/`bug-`, so keeping the id would leave the tree permanently invalid. `depends_on` references are rewritten tree-wide; the `issue` field, labels, and body ride along untouched (GitHub round-trip link preserved — covered by a mocked-gh test).
- Reuses `assertParentEdge` (cli/src/relations.ts) and `newItemPath`; additive payload fields `movedFrom` (shared with reparent) and `renamedFrom`; exposed through the MCP `arggon_update` schema too (parity test enforces it).

## Notes

### 2026-09-16 @Arggon
Lead-architect review: APPROVED (deep-validated). The id rename is the standout: validate forbids container ids with task-/bug- prefixes, so keeping the old id would leave the tree permanently invalid — the depends_on tree-wide rewrite + renamedFrom payload is the correct handling of a discovered constraint, not scope creep. Refusals all pre-mutation, the grandparent-epic derivation reuses create's edge logic, issue/labels/body ride along (round-trip preserved), and the convention.md sentence landed. One edge for the record (not blocking): promoting an item whose PR already references the old task- id would break the auto-done id grep — promotion is for pre-PR ideas; worth a line in the docs next time the section is touched. Merge follows.
