<!--
  Placement (v0): tasks/<initiative-id>/<epic-id>/<story-id>/bug-<inner-slug>.md
  Leaves live only under a story. id is the filename stem: bug-<inner-slug>.
  CLI `arggon create bug <slug>` adds the `bug-` prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->
---
type: bug
status: todo
id: bug-<slug>
title: ""
parent: <story-id>
labels: []
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
---

# <title>

## Context

<!-- Why this bug exists / how to reproduce. -->

## Acceptance

- [ ] <criterion>

## Notes

<!-- Optional. `arggon create` adds the `bug-` prefix to the inner slug. -->
