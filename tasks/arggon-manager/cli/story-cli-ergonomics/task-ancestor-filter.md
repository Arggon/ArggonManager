---
type: task
status: done
id: task-ancestor-filter
title: Ancestor/initiative filter predicate for filters and saved views
assignee: Arggon
branch: feat/task-ancestor-filter
parent: story-cli-ergonomics
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-cli-ergonomics/task-ancestor-filter.md
  Leaves live only under a story. id is the filename stem: task-ancestor-filter.
  CLI `arggon create task ancestor-filter` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Ancestor/initiative filter predicate for filters and saved views

## Context

filter.ts:155 — `parent:` matches the DIRECT parent only; no OR, no ancestor predicate. Saved views cannot express "everything under this initiative" (the estanteria agent's per-frente views stopped at epic level).

## Acceptance

- [x] `ancestor:<id>` predicate (true when id appears anywhere in the item's parent chain) works in filters and x-views; or an equivalent `initiative:<id>` resolution — document which landed — **`ancestor:<id>` landed** (chain only: the item itself never matches; unknown ids match silently)
- [x] Table-driven tests: nested chains, negation, composition
