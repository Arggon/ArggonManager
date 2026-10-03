---
type: task
status: in_progress
id: task-adapter-selection-flags
title: init --agents/--no-agents + doctor --agents (plan T2)
assignee: Arggon
branch: feat/task-adapter-selection-flags
parent: story-adapter-selection
labels: []
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T23:58:01.793Z"
depends_on: [task-methodology-carriers]
worktree_path: /home/arggon/Projects/ArggonManager-task-adapter-selection-flags
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/task-adapter-selection-flags.md
  Leaves live only under a story. id is the filename stem: task-adapter-selection-flags.
  CLI `arggon create task adapter-selection-flags` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init --agents/--no-agents + doctor --agents (plan T2)

## Context

Add `arggon init --agents <list>` / `--no-agents` (default: detected agents) and `arggon doctor --agents` (per-agent files present/stale/adopter-edited + gap rows)

## Acceptance

- [x] fixture matrix test over init flag combinations
- [x] `--json` reports written/skipped per artifact; adopter edits never overwritten
- [x] doctor output snapshot test
- [x] README + agents.md §init updated in same PR

## Notes

Implementation is on `feat/task-adapter-selection-flags` (PR opened from the worktree). Left `in_progress` for the coordinator's review/merge; the boxes above are ticked by the work that landed in that PR, and every gate was re-run green on its head.
