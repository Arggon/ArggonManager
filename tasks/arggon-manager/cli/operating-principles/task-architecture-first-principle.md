---
type: task
status: in_progress
id: task-architecture-first-principle
title: "Architecture-first principle: good practices and sound architecture always matter"
assignee: Arggon
branch: feat/task-architecture-first-principle
parent: operating-principles
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T20:34:21.725Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-architecture-first-principle.md
  Leaves live only under a story. id is the filename stem: task-architecture-first-principle.
  CLI `arggon create task architecture-first-principle` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Architecture-first principle: good practices and sound architecture always matter

## Context

Operating principle 1 (2026-09-14): **code is cheap; good practices and sound
software architecture are always important.** This binds ArggonManager itself
AND every project that adopts it: speed of generation never justifies
structural debt — clear module boundaries, small surfaces, tests that travel
with behavior, and docs that travel with code are part of "done", everywhere.

This task institutionalizes the principle in the governing docs (this repo's
review bar) and in the docs `arggon init` generates for adopters, integrating
into EXISTING sections rather than duplicating them.

## Acceptance

- [x] docs/engineering.md integrates the principle into its review bar / methodology sections (architecture quality named explicitly as always-in-scope, not optional refactor-later work)
- [x] templates/docs/engineering.md carries the same principle for adopter projects (adopter-appropriate wording)
- [x] skills/arggon-cli/SKILL.md §Quality bar names architecture-first (one or two lines); generated .agents copy synced (parity formula) and checksum re-acked — doctor reports 0 modified / 0 drifted
- [x] No duplication: the principle is stated once per document, in the section where a reader already looks for quality rules

## Notes
