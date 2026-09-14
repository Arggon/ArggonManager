---
type: task
status: done
id: task-init-convention-extensions
title: "Generated docs/convention.md should document or point to the x-* extensions"
assignee: Arggon
branch: feat/task-init-convention-extensions
parent: story-init-docs
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-init-convention-extensions.md
  Leaves live only under a story. id is the filename stem: task-init-convention-extensions.
  CLI `arggon create task init-convention-extensions` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Generated docs/convention.md should document or point to the x-* extensions

## Context

Found by the estanteria MCP-first experiment (2026-09-13): the SKILL says docs/convention.md is the source of truth for schema, and the adopter's generated docs/convention.md is where an agent looks first — but the generated (adopter-local) template documents none of the x-* namespaced extensions (x-views value syntax, x-import.label-types, x-worktree.post-start[-shell], x-tracker, x-generated). The agent's first x-views attempt failed with a misleading error and had to read convention.ts to discover views are name: "<predicate expression>" mappings.

## Acceptance

- [x] templates/docs/convention.md gains a "Namespaced extensions" section: the x-* list with one-line what/where, pointing to ArggonManager docs/convention.md as the full reference
- [x] init-docs test asserts the section exists in the generated file
