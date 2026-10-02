---
type: task
status: todo
id: task-native-cleanup-compose-parity
title: "Native cleanup parity: the plugin's nativeCleanup prune loop should reap declared Compose projects like the CLI"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, opencode-seam, parity]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-native-cleanup-compose-parity.md
  Leaves live only under a story. id is the filename stem: task-native-cleanup-compose-parity.
  CLI `arggon create task native-cleanup-compose-parity` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native cleanup parity: the plugin's nativeCleanup prune loop should reap declared Compose projects like the CLI

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-01 @Coordinator
Filed from the task-cleanup-declared-services review (PR #569): the CLI's `cleanup --prune` reaps declared per-worktree Compose projects (x-worktree.services manifest; ADR 0019 command shape) BEFORE git worktree remove — but the plugin's nativeCleanup prune loop does NOT (safe today: report-only omission; the MCP arggon_cleanup tool spawns the CLI and DOES reap, so MCP callers get the behavior transitively). The kernel helper `worktreeComposeProject` is already exported, so plugin adoption is trivial per the worker.

## Acceptance
- [ ] nativeCleanup prune loop reaps the declared Compose project for each removable entry (same ADR 0019 command shape, same no-op semantics, same bounded failure reporting), before the worktree removal.
- [ ] Parity test: CLI and native prune envelopes byte-comparable on the same fixture (modulo the documented surface differences).
- [ ] Absent-docker degradation matches the CLI's run-wide report-only shape.
