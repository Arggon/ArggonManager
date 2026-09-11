---
type: task
status: todo
id: task-deps-schema-kernel
title: Kernel and validate for depends_on/blocked_by
parent: story-deps-schema
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/deps-graph/story-deps-schema/task-deps-schema-kernel.md
  Leaves live only under a story. id is the filename stem: task-deps-schema-kernel.
  CLI `arggon create task deps-schema-kernel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Kernel and validate for depends_on/blocked_by

## Context

Kernel: parse `depends_on` from frontmatter (list of kebab ids), expose on `WorkItem`, and extend `validate` with graph rules. Cascade stays orthogonal: dependencies gate *suggestions*, never the container auto-completion (documented decision).

## Acceptance

- [ ] `depends_on` round-trips, unknown-key warning suppressed as a v3 official field behind the convention version
- [ ] `validate` reports `UNKNOWN_DEPENDENCY`, `SELF_DEPENDENCY`, `DEPENDENCY_CYCLE` with item paths
- [ ] `v0`-`v2` trees stay valid unchanged (version-gated parsing)
