---
type: bug
status: todo
id: bug-goal-mode-refusal-tests-not-hermetic
title: "Three goal-mode refusal assertions are not hermetic: they omit the caller identity, so CI's ambient identity fires GOAL_FOREIGN_CLAIM and masks GOAL_WORKTREE_MISMATCH / GOAL_WORKTREE_MISSING / GOAL_TEMPLATE_UNAVAILABLE"
parent: tooling-and-environment
labels: [tests, ci, hermeticity]
created: "2026-10-09"
updated: "2026-10-09"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-goal-mode-refusal-tests-not-hermetic.md
  Leaves live only under a story. id is the filename stem: bug-goal-mode-refusal-tests-not-hermetic.
  CLI `arggon create bug goal-mode-refusal-tests-not-hermetic` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Three goal-mode refusal assertions are not hermetic: they omit the caller identity, so CI's ambient identity fires GOAL_FOREIGN_CLAIM and masks GOAL_WORKTREE_MISMATCH / GOAL_WORKTREE_MISSING / GOAL_TEMPLATE_UNAVAILABLE

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
