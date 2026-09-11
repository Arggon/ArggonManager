---
type: task
status: todo
id: task-worktree-cleanup
title: arggon cleanup for merged worktrees
parent: story-start-worktree
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/task-worktree-cleanup.md
  Leaves live only under a story. id is the filename stem: task-worktree-cleanup.
  CLI `arggon create task worktree-cleanup` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon cleanup for merged worktrees

## Context

Reaper for worktrees of closed work.

## Acceptance

- [ ] `arggon cleanup` lists worktrees whose items are `done`/`cancelled` with merged branches
- [ ] `--prune` removes them (git worktree remove + branch delete), `--json` reports what it did
