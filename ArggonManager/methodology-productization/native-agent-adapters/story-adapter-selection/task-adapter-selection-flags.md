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

- [ ] fixture matrix test over init flag combinations
- [ ] `--json` reports written/skipped per artifact; adopter edits never overwritten
- [ ] doctor output snapshot test
- [ ] README + agents.md §init updated in same PR

## Notes
