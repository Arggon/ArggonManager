---
type: epic
status: todo
id: deps-graph
title: deps-graph
parent: agent-native
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/deps-graph/deps-graph.md (epic index; required).
  parent MUST be the initiative id. Container ids must not start with task-/bug-.
-->

# deps-graph

## Context

`depends_on` / `blocked_by` are reserved-for-later fields in v0 — the single most requested evolution (Beads' `bd ready` and Task Master's dependency-aware planning both prove the demand). With a DAG over work items, `arggon next` stops guessing by id order and starts suggesting genuinely unblocked work.

## Acceptance

- [ ] v3 convention (with ADR 0004) lands: `depends_on`/`blocked_by` with cycle and reference validation
- [ ] `next --ready` suggests only unblocked claimable items; board renders dependency edges
