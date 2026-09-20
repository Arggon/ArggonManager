---
type: story
status: done
id: story-milestones
title: Milestones
assignee: Arggon
branch: feat/story-milestones
parent: reporting
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Milestones

## Context

Backlog.md milestones and Jira roadmap targets both give work a deadline frame. Design a milestone concept for v3 that respects forward compatibility and the reserved-field policy.

## Acceptance

- [x] ADR proposing the field(s), validation rules, and migration (docs/adr/0003-milestone-field.md)
- [x] Board grouping prototype behind a flag (`board --group-by milestone`)
- [x] v0 trees remain valid with and without milestones (validate ok, no UNKNOWN_KEY warning; milestone is a forward-declared prototype key)
