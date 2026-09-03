<!--
  Placement (v0): tasks/<initiative-id>/<epic-id>/<story-id>/task-<inner-slug>.md
  Leaves live only under a story. id is the filename stem: task-<inner-slug>.
  CLI `arggon create task <slug>` adds the `task-` prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->
---
type: task
status: todo
id: task-<slug>
title: ""
parent: <story-id>
labels: []
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
---

# <title>

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] <criterion>

## Notes

<!-- Optional. `arggon create` adds the `task-` prefix to the inner slug. -->
