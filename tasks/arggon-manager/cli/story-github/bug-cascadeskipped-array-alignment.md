---
type: bug
status: done
id: bug-cascadeskipped-array-alignment
title: "update --json: cascadeSkipped absent when empty while autoCompleted is always []"
assignee: Arggon
branch: fix/bug-cascadeskipped-array-alignment
parent: story-github
labels: [p3]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/bug-cascadeskipped-array-alignment.md
  Leaves live only under a story. id is the filename stem: bug-cascadeskipped-array-alignment.
  CLI `arggon create bug cascadeskipped-array-alignment` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# update --json: cascadeSkipped absent when empty while autoCompleted is always []

## Context

Feedback from the vencimientos adoption experiment (2026-09-15): in `update --json`, `autoCompleted` is always an array while `cascadeSkipped` is ABSENT when empty (the CLI/MCP spread it conditionally; a parser that defaults absent fields to null reports it as null). Cosmetic contract inconsistency — but this repo's whole posture is a stable, parity-tested JSON contract, and the ADR 0006 compact-envelope policy makes "absent means empty" a documented convention only for WorkItem fields, not for top-level payload fields like these. Align them one way and document it.

## Acceptance

- [x] `autoCompleted` and `cascadeSkipped` are emitted consistently (both always arrays, or both omitted-when-empty) across CLI and MCP `update` envelopes — pick one, document in docs/json-output.md (additive, schemaVersion unchanged)
- [x] Tests: empty-cascade envelope asserts the aligned shape (cli + mcp); parity harness unaffected or updated

## Notes
