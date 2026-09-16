---
type: task
status: in_progress
id: task-push-main-after-mutations
title: "SKILL pitfall extension: push main immediately after primary-checkout tracker mutations"
assignee: Arggon
branch: feat/task-push-main-after-mutations
parent: story-tracker-hygiene
labels: [p3]
created: "2026-09-15"
updated: "2026-09-16"
claimed_at: "2026-09-16T01:27:28.356Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/task-push-main-after-mutations.md
  Leaves live only under a story. id is the filename stem: task-push-main-after-mutations.
  CLI `arggon create task push-main-after-mutations` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# SKILL pitfall extension: push main immediately after primary-checkout tracker mutations

## Context

Follow-up from the casa-pendiente experiment (2026-09-15), extending the landed task-autocommit-squash-divergence pitfall (PR #219): the agent hit the local-main divergence TWICE and empirically found the preventive discipline that avoids it entirely: **push main immediately after every tracker mutation made from the primary checkout** (arggon comment/update/create auto-commits land on local main; if the PR merge reaches origin first, the pull diverges). Also folded: the cleanup --prune auto-commit (worktree_path clearing) traveled as contraband on a branch cut before pushing main — same root.

## Acceptance

- [x] The squash-divergence SKILL pitfall gains the preventive line: push main right after primary-checkout tracker mutations (before opening/merging any PR)
- [x] docs/agents.md §0 tracker-hygiene paragraph mentions the same discipline

## Notes
