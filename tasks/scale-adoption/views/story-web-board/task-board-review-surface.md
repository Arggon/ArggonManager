---
type: task
status: todo
id: task-board-review-surface
title: "board review surface: per-item PR status, checks and diff link"
parent: story-web-board
labels: [p3]
created: "2026-09-15"
updated: "2026-09-15"
depends_on: [task-board-dependency-visuals]
---
<!--
  Placement (v0): tasks/scale-adoption/views/story-web-board/task-board-review-surface.md
  Leaves live only under a story. id is the filename stem: task-board-review-surface.
  CLI `arggon create task board-review-surface` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# board review surface: per-item PR status, checks and diff link

## Context

Candidate #6 of [product discovery](docs/explorations/exploration-product-discovery-002.md): board cards show a PR badge only with `--github`; orchestration tools compete on diff-first review (Vibe Kanban, Conductor — vibekanban.com, madelove.com, 2026-09-15). A standing `--serve` board with per-item PR state, checks and diff links makes the board the review cockpit — reusing the existing gh read path. Effort M; principle: cheap-infra.

## Acceptance

- [ ] --serve board renders per-item PR state (open/draft/merged + checks) and a diff link for items with a branch/PR
- [ ] Reuses the existing gh read path (get-open-prs); no new dependencies; rate-limit-safe (cached/poll)
- [ ] Tests for the render path; docs updated

## Notes
