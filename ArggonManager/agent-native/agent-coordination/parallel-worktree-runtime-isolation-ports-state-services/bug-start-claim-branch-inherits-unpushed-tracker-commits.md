---
type: bug
status: todo
id: bug-start-claim-branch-inherits-unpushed-tracker-commits
title: "`start --worktree` cuts the claim branch from the primary checkout's LOCAL HEAD, so a PR inherits every unpushed tracker auto-commit as unrelated diff churn — and the contamination is invisible until the PR is open"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, claims, tracker-merge]
created: "2026-10-11"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-start-claim-branch-inherits-unpushed-tracker-commits.md
  Leaves live only under a story. id is the filename stem: bug-start-claim-branch-inherits-unpushed-tracker-commits.
  CLI `arggon create bug start-claim-branch-inherits-unpushed-tracker-commits` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `start --worktree` cuts the claim branch from the primary checkout's LOCAL HEAD, so a PR inherits every unpushed tracker auto-commit as unrelated diff churn — and the contamination is invisible until the PR is open

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
