---
type: story
status: todo
id: story-filter-language
title: Query language for list
parent: views
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Query language for list

## Context

Daily questions like 'my open bugs in this epic' need compound filters. `--status`, `--type`, and `--assignee` only answer one dimension at a time.

## Acceptance

- [ ] Filter expressions combine status, type, assignee, label, and parent
- [ ] `@me` resolves exactly like `list --assignee @me`
- [ ] `--json` output honors filters identically to the table view
