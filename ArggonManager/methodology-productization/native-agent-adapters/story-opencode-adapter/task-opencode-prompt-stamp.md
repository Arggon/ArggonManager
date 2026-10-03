---
type: task
status: todo
id: task-opencode-prompt-stamp
title: OpenCode prompt-admission stamp + compaction retention (plan T4)
parent: story-opencode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-adapter-selection-flags, task-capability-matrix]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/task-opencode-prompt-stamp.md
  Leaves live only under a story. id is the filename stem: task-opencode-prompt-stamp.
  CLI `arggon create task opencode-prompt-stamp` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode prompt-admission stamp + compaction retention (plan T4)

## Context

OpenCode session `prompt` hook stamps branch/item metadata on admission; `compaction` hook retains the item block

## Acceptance

- [ ] unit tests for the hook rewrite contract
- [ ] headless smoke evidence (expected vs observed in verdict)
- [ ] permission rules unchanged

## Notes
