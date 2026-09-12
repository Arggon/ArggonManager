---
type: task
status: in_progress
id: task-start-worktree
title: start --worktree isolation
assignee: Arggon
parent: story-start-worktree
labels: []
created: "2026-09-11"
updated: "2026-09-12"
claimed_at: "2026-09-12T00:02:44.311Z"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/task-start-worktree.md
  Leaves live only under a story. id is the filename stem: task-start-worktree.
  CLI `arggon create task start-worktree` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# start --worktree isolation

## Context

Worktree creation wired into `start`, reusing the existing claim/branch/push pipeline; `worktree_path` is additive on the contract.

## Acceptance

- [ ] `start --worktree` creates the worktree, records `worktree_path`, and runs all follow-up commands from it
- [ ] Idempotent: existing worktree path attaches; non-git trees fail with `START_FAILED`
