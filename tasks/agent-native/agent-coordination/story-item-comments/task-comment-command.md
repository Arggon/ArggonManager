---
type: task
status: todo
id: task-comment-command
title: arggon comment command
parent: story-item-comments
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-item-comments/task-comment-command.md
  Leaves live only under a story. id is the filename stem: task-comment-command.
  CLI `arggon create task comment-command` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon comment command

## Context

Body-only append with the standard section format; author from `@me` resolution.

## Acceptance

- [ ] `### <date> <author>` sections append in order; multiline text supported
- [ ] MCP parity: `arggon_comment` tool; `validate` still passes with comment sections
