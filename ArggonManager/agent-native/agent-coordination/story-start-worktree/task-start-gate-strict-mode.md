---
type: task
status: todo
id: task-start-gate-strict-mode
title: "Opt-in strict start gate: fail the claim commit when a reported gate bin resolves outside the worktree (x-tracker flag)"
parent: story-start-worktree
labels: [worktree, opencode-seam]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/task-start-gate-strict-mode.md
  Leaves live only under a story. id is the filename stem: task-start-gate-strict-mode.
  CLI `arggon create task start-gate-strict-mode` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Opt-in strict start gate: fail the claim commit when a reported gate bin resolves outside the worktree (x-tracker flag)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the bug-start-worktree-npm-ci-claim review (PR #517): readiness reporting is deliberately report-only (claim commit authoritative; honest-receipt design). This item: an opt-in x-tracker flag that HARD-FAILS the claim commit when inspectGateBinResolution reports any gate bin resolving outside the worktree. Acceptance: flag documented (convention.md + json-output.md), default behavior unchanged, smoke:native-start-cold covers both modes, tests pin the failure path. Context: the full strict-mode question was truncated by the handoff field cap — recorded here in full instead.
