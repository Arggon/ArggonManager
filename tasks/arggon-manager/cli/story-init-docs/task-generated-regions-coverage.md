---
type: task
status: in_progress
id: task-generated-regions-coverage
title: "forever-fix coverage: generated SKILL regions for every command"
assignee: Arggon
parent: story-init-docs
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T23:14:45.378Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-generated-regions-coverage.md
  Leaves live only under a story. id is the filename stem: task-generated-regions-coverage.
  CLI `arggon create task generated-regions-coverage` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# forever-fix coverage: generated SKILL regions for every command

## Context

Follow-up from the task-schema-budget review (PR #256): the forever-fix (task-skill-generated-command-reference) works mechanically — a command's .description() change regenerates its SKILL region via skills:sync — BUT region coverage is opt-in per filter key. `doctor` was documented only in hand-written SKILL prose, so its description edits silently never fed a generated region; the same applies to init, adopt, branch, start, import-issues and other commands living outside the current region filters (board, report, sync, instructions, cleanup, and now doctor).

## Acceptance

- [ ] Coverage invariant: every non-excluded command appears in a generated region (a cross-check test fails when a command is documented only in hand-written prose)
- [ ] The remaining hand-written command lines (init, adopt, branch, start, import-issues, etc.) migrate into generated regions (or join the exclusion list with reasons if genuinely internal)
- [ ] The forever-fix net is then closed end-to-end: description changes propagate mechanically for ALL user-facing commands

## Notes
