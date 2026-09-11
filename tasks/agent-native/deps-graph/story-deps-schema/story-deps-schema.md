---
type: story
status: todo
id: story-deps-schema
title: Dependency graph schema (v3)
parent: deps-graph
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/deps-graph/story-deps-schema/story-deps-schema.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Dependency graph schema (v3)

## Context

Dependency storage and validation is the kernel half of the graph. Fields stay simple (`depends_on`: list of ids this item waits for; `blocked_by` stays **computed**, never stored, so there is exactly one source of truth), while `validate` gains referential integrity (unknown ids, self-deps, cycles) and the convention bumps to v3 together with `milestone` (ADR 0004).

## Acceptance

- [ ] `depends_on` accepted on all types, `validate` rejects unknown ids, self-references and cycles
- [ ] Convention v3 + JSON contract documented (task-deps-schema-docs)
