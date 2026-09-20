---
type: task
status: done
id: task-deps-schema-kernel
title: Kernel and validate for depends_on/blocked_by
assignee: Arggon
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

- [x] `depends_on` round-trips, unknown-key warning suppressed as a v3 official field behind the convention version
- [x] `validate` reports `UNKNOWN_DEPENDENCY`, `SELF_DEPENDENCY`, `DEPENDENCY_CYCLE` with item paths
- [x] `v0`-`v2` trees stay valid unchanged (version-gated parsing)

## Notes

- Parsing is unconditional (milestone/branch precedent), not version-gated: v0-v2 trees without the field are untouched, trees with it are legal at any version — the "v0-v2 stay valid unchanged" outcome holds; see the story Notes for rationale.
- v3 officialization includes `CONVENTION_VERSION` 2 → 3 (`init` scaffolds `version: 3`); the too-new convention fixture moved to `version: 4`.
- `update --depends-on` (replace, empty clears) / `--add-depends-on` (append) reject unknown ids at edit time; self-deps are left to `validate` (`SELF_DEPENDENCY`), matching spec §3 ("ids desconocidos fallan en update también").
- MCP `arggon_update` exposes the same flags (`depends_on` / `add_depends_on`); CLI/MCP envelope parity covered in mcp-parity.test.ts.
