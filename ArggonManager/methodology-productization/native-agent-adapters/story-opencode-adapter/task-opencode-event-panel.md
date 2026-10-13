---
type: task
status: in_progress
id: task-opencode-event-panel
title: OpenCode board panel event-driven refresh (plan T4)
assignee: arggon-delivery-lead
branch: feat/task-opencode-event-panel
parent: story-opencode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-13"
claimed_at: "2026-10-13T13:29:13.322Z"
depends_on: [task-adapter-selection-flags, task-capability-matrix]
worktree_path: /home/arggon/Projects/ArggonManager-task-opencode-event-panel
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/task-opencode-event-panel.md
  Leaves live only under a story. id is the filename stem: task-opencode-event-panel.
  CLI `arggon create task opencode-event-panel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode board panel event-driven refresh (plan T4)

## Context

Board panel refreshes from the OpenCode event stream instead of polling

## Acceptance

- [ ] unit test for event→refresh path
- [ ] headless smoke evidence
- [ ] no polling fallback regression

## Notes
