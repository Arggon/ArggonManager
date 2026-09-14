---
type: task
status: in_progress
id: task-board-docs-dedup
title: board envelope docs duplicated between README and docs/json-output.md (drift risk)
assignee: Arggon
branch: feat/task-board-docs-dedup
parent: story-web-board
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T19:17:13.972Z"
---
<!--
  Placement (v0): tasks/scale-adoption/views/story-web-board/task-board-docs-dedup.md
  Leaves live only under a story. id is the filename stem: task-board-docs-dedup.
  CLI `arggon create task board-docs-dedup` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# board envelope docs duplicated between README and docs/json-output.md (drift risk)

## Context

From the bug-board-serve-json review (PR #153): the board command's envelope
is documented in BOTH README.md and docs/json-output.md; the two copies
already diverged once (README:263 described the one-shot --serve envelope
correctly while docs/json-output.md did not). Duplication is a standing drift
risk for the next board change.

## Acceptance

- [ ] Decide and land: single source (one doc references the other) or a docs-parity test that fails when the two envelope descriptions diverge

## Notes
