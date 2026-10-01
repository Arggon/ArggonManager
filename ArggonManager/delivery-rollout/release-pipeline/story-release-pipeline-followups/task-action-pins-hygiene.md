---
type: task
status: in_progress
id: task-action-pins-hygiene
title: "Pin-hygiene sweep: SHA-pin remaining tag-pinned actions across .github/workflows"
assignee: Arggon
parent: story-release-pipeline-followups
labels: [ci, supply-chain]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T23:59:51.427Z"
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline-followups/task-action-pins-hygiene.md
  Leaves live only under a story. id is the filename stem: task-action-pins-hygiene.
  CLI `arggon create task action-pins-hygiene` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Pin-hygiene sweep: SHA-pin remaining tag-pinned actions across .github/workflows

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the task-release-action-sha-pin review (#563): actions/checkout@v4 remains tag-pinned in release-please.yml; sweep ALL .github/workflows for tag-pinned `uses:` and SHA-pin each with a human-readable version comment (the #563 pattern). Acceptance: every `uses:` pinned to a full SHA + version comment; a grep gate preventing new floating tags; workflows functionally unchanged (actionlint/yaml parse).
