---
type: task
status: todo
id: task-filter-views
title: Named saved views for list
parent: story-filter-language
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Named saved views for list

## Context

Linear's saved views: name a filter once, reuse it forever. Store views under a namespaced extension key (`x-views`) so v0's ignore-unknown policy keeps older trees valid.

## Acceptance

- [ ] `list --view <name>` resolves from `tasks/.convention.yml` `x-views`
- [ ] Explicit flags combine with the view filter (AND)
- [ ] Unknown view name fails with the list of known views
