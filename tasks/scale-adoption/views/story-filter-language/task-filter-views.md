---
type: task
status: done
id: task-filter-views
title: Named saved views for list
assignee: Arggon
parent: story-filter-language
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Named saved views for list

## Context

Linear's saved views: name a filter once, reuse it forever. Store views under a namespaced extension key (`x-views`) so v0's ignore-unknown policy keeps older trees valid.

## Acceptance

- [x] `list --view <name>` resolves from `tasks/.convention.yml` `x-views`
- [x] Explicit flags combine with the view filter (AND)
- [x] Unknown view name fails with the list of known views
