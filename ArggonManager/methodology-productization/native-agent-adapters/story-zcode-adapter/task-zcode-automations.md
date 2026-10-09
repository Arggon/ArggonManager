---
type: task
status: in_progress
id: task-zcode-automations
title: "ZCode automation templates (spec-drift scan, stale-claim sweep) (plan T5)"
assignee: arggon-delivery-lead
branch: feat/task-zcode-automations
parent: story-zcode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-09"
claimed_at: "2026-10-09T19:26:48.474Z"
depends_on: [task-adapter-selection-flags, task-capability-matrix]
worktree_path: /home/arggon/Projects/ArggonManager-task-zcode-automations
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-zcode-adapter/task-zcode-automations.md
  Leaves live only under a story. id is the filename stem: task-zcode-automations.
  CLI `arggon create task zcode-automations` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ZCode automation templates (spec-drift scan, stale-claim sweep) (plan T5)

## Context

Opt-in automation templates: daily spec-drift scan, weekly stale-claim sweep — read-only or item-filing only

## Acceptance

- [ ] templates carry claim/branch preconditions
- [ ] scans run read-only; findings filed via arggon create
- [ ] documented as opt-in

## Notes
