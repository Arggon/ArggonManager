---
type: epic
status: done
id: agent-coordination
title: agent-coordination
parent: agent-native
labels: []
created: "2026-09-11"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/agent-coordination.md (epic index; required).
  parent MUST be the initiative id. Container ids must not start with task-/bug-.
-->

# agent-coordination

## Context

Claims are the coordination primitive, but today a dead agent leaves an eternal claim, worktree isolation is manual playbook discipline, and agent handoff notes have no home. This epic hardens the loop the 2026 ecosystem standardized: leases, worktrees, and per-item handoff comments — all stateless-side, all in git.

## Acceptance

- [ ] Claims carry timestamps and staleness is visible and actionable
- [ ] `arggon start --worktree` isolates filesystem per claim; cleanup is one command
- [ ] Items accept timestamped comments for handoff context
