---
type: bug
status: todo
id: bug-claim-pool-computed-from-main-misses-branch-claims
title: "`list`/`next` compute the claimable pool from `main`, but a claim made in a worktree rides its branch — so every in-flight item reads `todo`/unassigned on main and is offered to an agent that `start` then refuses"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [tracker-schema, worktree, hygiene, claims]
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-claim-pool-computed-from-main-misses-branch-claims.md
  Leaves live only under a story. id is the filename stem: bug-claim-pool-computed-from-main-misses-branch-claims.
  CLI `arggon create bug claim-pool-computed-from-main-misses-branch-claims` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `list`/`next` compute the claimable pool from `main`, but a claim made in a worktree rides its branch — so every in-flight item reads `todo`/unassigned on main and is offered to an agent that `start` then refuses

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
