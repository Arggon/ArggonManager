---
type: task
status: todo
id: task-stale-detect
title: Stale-claim detection and supervised steal
parent: story-claim-leases
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-claim-leases/task-stale-detect.md
  Leaves live only under a story. id is the filename stem: task-stale-detect.
  CLI `arggon create task stale-detect` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Stale-claim detection and supervised steal

## Context

Staleness reporting and the supervised escape hatch.

## Acceptance

- [ ] `arggon list --stale --older-than <duration>` filters claimed items past the threshold
- [ ] `arggon update <id> --steal --reason "..."` is human-only (agent callers refused, like `--force`) and writes the reason into the item body Notes
