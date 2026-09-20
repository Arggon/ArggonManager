---
type: story
status: done
id: story-deps-schema
title: Dependency graph schema (v3)
assignee: Arggon
branch: feat/story-deps-schema
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

- [x] `depends_on` accepted on all types, `validate` rejects unknown ids, self-references and cycles
- [x] Convention v3 + JSON contract documented (task-deps-schema-docs)

## Notes

- Implemented in feat/story-deps-schema (task-deps-schema-kernel + task-deps-schema-docs).
- **Parsing is unconditional, not version-gated** (deviation from spec-deps-001 §2 wording "the field is ignored in v0-v2 trees"): `depends_on` parses on every tree regardless of the `tasks/.convention.yml` version, mirroring how `branch` (v1) and the `milestone` prototype shipped. Parsing is additive, so v0-v2 trees without the field load and validate exactly as before (covered by tests); trees that adopt the field early are legal too. What v3 changes: the field becomes official (no `UNKNOWN_KEY`/`RESERVED_KEY` findings), `init` scaffolds `version: 3`, and `validate` gains the graph rules.
- `blocked_by` stays a computed inverse view; the key remains reserved (never stored).
- Semantics stay advisory-only per ADR 0004: dependencies never block updates; they gate suggestions/queries later (story-deps-queries).
