---
type: task
status: todo
id: task-claimed-at
title: claimed_at field set by start
parent: story-claim-leases
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-claim-leases/task-claimed-at.md
  Leaves live only under a story. id is the filename stem: task-claimed-at.
  CLI `arggon create task claimed-at` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# claimed_at field set by start

## Context

Additive field, same treatment as `branch`: written by `start` and by claim updates, cleared on unclaim, present (nullable) on the contract.

## Acceptance

- [ ] `claimed_at` (date-time) written on claim, cleared on `todo`; `WorkItem.claimed_at` in the JSON contract
- [ ] Update rules unaffected: `claimed_at` never gates transitions, only reporting
