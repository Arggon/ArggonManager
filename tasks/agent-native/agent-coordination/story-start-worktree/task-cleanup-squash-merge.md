---
type: task
status: in_progress
id: task-cleanup-squash-merge
title: "cleanup --prune: support squash-merged branches"
assignee: Arggon
parent: story-start-worktree
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T03:41:07.503Z"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/task-cleanup-squash-merge.md
  Leaves live only under a story. id is the filename stem: task-cleanup-squash-merge.
  CLI `arggon create task cleanup-squash-merge` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --prune: support squash-merged branches

## Context

Second experiment hitting the same limitation (arggon-cv noted it, racha confirmed it hard: `cleanup --prune` pruned 0/9 worktrees with "branch not fully merged" — the projects squash-merge their PRs, and a squash commit is never an ancestor of the feature branch, so the ancestry check can never pass). Every experiment since arggon-cv ended with manual `git worktree remove --force` + `git branch -D`, verifying merge state PR-by-PR by hand.

## Acceptance

- [ ] When the ancestry check fails, cleanup queries gh for a MERGED PR whose head branch matches (gh pr list --state merged --head <branch>), and treats "PR merged" as prunable (optional --require-pr flag to make gh optional)
- [ ] Tests: squash-merged branch (remote merge commit, no ancestry) gets pruned with --require-pr + fake gh; no matching PR → still skipped
