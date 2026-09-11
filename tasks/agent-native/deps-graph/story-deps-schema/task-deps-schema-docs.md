---
type: task
status: done
id: task-deps-schema-docs
title: Convention v3 docs for dependency fields
assignee: Arggon
parent: story-deps-schema
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/deps-graph/story-deps-schema/task-deps-schema-docs.md
  Leaves live only under a story. id is the filename stem: task-deps-schema-docs.
  CLI `arggon create task deps-schema-docs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Convention v3 docs for dependency fields

## Context

Docs for the schema wave, per the maintenance rules in `docs/agents.md`.

## Acceptance

- [x] `docs/convention.md`: v3 section (fields, validation, migration from v0-v2)
- [x] `docs/json-output.md`: `depends_on: string[]` on `WorkItem`, `command` enum unchanged

## Notes

- `docs/convention.md`: new "Dependency graph (v3)" section (fields, DAG validation codes, advisory semantics, CLI flags), `depends_on` added to the field table, removed from the reserved list, tree-version example bumped to 3, and the v0→v1 ladder gained the **v3** bullet with the additive migration note.
- `README.md` (update flags) and `skills/arggon-cli/SKILL.md` (pitfall) kept in sync per docs/agents.md maintenance rules.
