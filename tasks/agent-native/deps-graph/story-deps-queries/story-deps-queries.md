---
type: story
status: todo
id: story-deps-queries
title: Dependency-aware queries and board
parent: deps-graph
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/deps-graph/story-deps-queries/story-deps-queries.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Dependency-aware queries and board

## Context

The payoff of the graph: `arggon next` becomes dependency-aware — an item is *ready* when it is an unclaimed `todo` whose `depends_on` are all `done`/`cancelled`. Filters compose with the existing filter engine; the board draws edges so humans see the same graph agents walk.

## Acceptance

- [ ] `arggon next` (and `--ready`) ranks unblocked items first, with the blocking chain in `reason`
- [ ] `list --filter depends-on:<id>` / `blocked-by:<id>` predicates
- [ ] Static and served boards render dependency edges
