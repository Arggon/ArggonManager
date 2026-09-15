---
type: task
status: in_progress
id: task-next-pool-stories
title: next suggestion pool includes unclaimed stories (surprising for implement-next)
assignee: Arggon
parent: story-cli-ergonomics
labels: []
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T16:28:59.112Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-cli-ergonomics/task-next-pool-stories.md
  Leaves live only under a story. id is the filename stem: task-next-pool-stories.
  CLI `arggon create task next-pool-stories` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# next suggestion pool includes unclaimed stories (surprising for implement-next)

## Context

Follow-up from the task-mcp-parity-full review (PR #237): `arggon next`'s ready pool includes unclaimed STORIES, so on a fresh tree the suggestion is the story itself rather than a leaf task — deterministic, but surprising for the dominant "what do I implement next" use case. With dependency-weighted ranking landed, the pool semantics are the remaining rough edge.

## Acceptance

- [ ] Decision + landing: either stories leave the default pool (flag/`--include-stories` to opt in) or the ranking demotes them explicitly below leaf tasks — decided and documented
- [ ] Tests for both pools; reason line reflects the chosen semantics

## Notes
