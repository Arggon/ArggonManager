---
type: task
status: in_progress
id: task-board-dependency-visuals
title: board/TUI dependency visuals + --group-by story
assignee: Arggon
branch: feat/task-board-dependency-visuals
parent: story-web-board
labels: [p3]
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T15:04:08.052Z"
---
<!--
  Placement (v0): tasks/scale-adoption/views/story-web-board/task-board-dependency-visuals.md
  Leaves live only under a story. id is the filename stem: task-board-dependency-visuals.
  CLI `arggon create task board-dependency-visuals` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# board/TUI dependency visuals + --group-by story

## Context

Candidate #9 of [product discovery](docs/explorations/exploration-product-discovery-002.md): board cards render deps as text lines with no visual blocking, and the TUI has no dependency awareness at all — agents/humans scan the board instead of reading edges (agent-kanban.dev, 2026-09-15). Effort S; principle: cheap-infra (same read path, presentation only).

## Acceptance

- [ ] Board HTML: blocked cards visually distinct (greyed/badged), dependency edges or badges per card
- [ ] TUI: blocked items marked and `--group-by story` grouping available in board and/or TUI (decide exact surface, document)
- [ ] Tests (board-parity/render assertions); no new dependencies

## Notes
