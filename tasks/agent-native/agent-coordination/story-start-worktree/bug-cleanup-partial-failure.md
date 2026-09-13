---
type: bug
status: todo
id: bug-cleanup-partial-failure
title: cleanup --prune leaves partial state when git branch -d fails
parent: story-start-worktree
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/bug-cleanup-partial-failure.md
  Leaves live only under a story. id is the filename stem: bug-cleanup-partial-failure.
  CLI `arggon create bug cleanup-partial-failure` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --prune leaves partial state when git branch -d fails

## Context

Found by the guardian adoption agent (2026-09-13): `cleanup --prune` removed the worktree but then `git branch -d` failed (branch's upstream was divergent: the agent's final push never reached the remote), leaving CLEANUP_FAILED with the `worktree_path` record orphaned on the item. Partial-state mutation on failure.

## Acceptance

- [ ] Cleanup is transactional per candidate: verify BOTH conditions (item terminal + branch fully merged locally AND on the tracked remote) before removing anything; on any failure, either complete or roll back without orphaning state
- [ ] Tests: divergent-upstream scenario -> worktree kept, item state consistent, actionable error
