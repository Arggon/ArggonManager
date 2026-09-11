---
type: task
status: done
id: task-filter-parser
title: Parse filter expressions
assignee: arggondev
branch: feat/task-filter-parser
parent: story-filter-language
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Parse filter expressions

## Context

Core of the filter language: parse a compact expression like `status:todo assignee:@me label:security` into the same predicates the CLI already applies.

## Acceptance

- [x] Tokens supported: `status:`, `type:`, `assignee:`, `label:`, `parent:`
- [x] Quoted values allow spaces; unknown field is a usage error, not a silent ignore
- [x] Unit tests cover combined and negated (`!`) filters

## Notes

Closed by @Arggon (authorized): work landed via PR #63; item left stale in `in_progress`.
