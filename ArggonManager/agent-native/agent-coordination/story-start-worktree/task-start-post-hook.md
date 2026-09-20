---
type: task
status: done
id: task-start-post-hook
title: Configurable post-start hook for worktree bootstrap
assignee: Arggon
branch: feat/task-start-post-hook
parent: story-start-worktree
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/task-start-post-hook.md
  Leaves live only under a story. id is the filename stem: task-start-post-hook.
  CLI `arggon create task start-post-hook` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Configurable post-start hook for worktree bootstrap

## Context

cuentas-claras feedback: worktrees do not share node_modules — the agent ran npm install 6-7 times. A configurable post-start hook removes the repetition generically (no node_modules-sharing corner cases).

## Acceptance

- [x] `x-worktree.post-start` (shell command) in tasks/.convention.yml runs inside the worktree after a successful start (e.g. `npm ci`); failure is reported, not fatal; flag --no-hook to skip
- [x] Test: hook executed in the worktree cwd; failure reported; absent config = no-op
