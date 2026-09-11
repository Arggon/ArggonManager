---
type: task
status: done
id: task-container-auto-done
title: Auto-complete containers when all internal work closes
assignee: Arggon
branch: feat/task-container-auto-done
parent: story-container-rollup
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-container-rollup/task-container-auto-done.md
  Leaves live only under a story. id is the filename stem: task-container-auto-done.
  CLI `arggon create task container-auto-done` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Auto-complete containers when all internal work closes

## Context

Containers (story/epic/initiative) stay `todo` forever in practice: closing the last leaf never touches the parent (v0 no-rollup), and `todo -> done` is not a legal transition, so humans must manually chain two updates per container. This task adds automatic container completion to the kernel update path shared by CLI, MCP and the board serve route: when an item reaches a terminal state (`done`/`cancelled`) and every sibling under a parent is also terminal, that parent completes too, cascading up the chain.

## Acceptance

- [x] Closing the last open descendant flips each ancestor container to `done` automatically (recursively up to the initiative; cascade.test.ts covers task→story→epic→initiative)
- [x] Containers stuck in `todo`/`blocked` complete directly to `done` (documented in convention.md; covered by the todo-story test)
- [x] Containers with any open descendant never flip (subtree check at any depth); already-`done`/`cancelled` containers are never touched (explicit-cancel wins; skip-but-continue test)
- [x] Opt-out: `arggon update <id> --status done --no-cascade` leaves ancestors untouched (`cascade: false` in the kernel)
- [x] `--json` reports the auto-completed ids as an additive `autoCompleted` field (CLI and MCP parity); human output prints `auto-completed: ...`
- [x] Works identically through the shared `runUpdate` (CLI, MCP tool, board serve endpoint); convention.md + json-output.md updated

## Notes
