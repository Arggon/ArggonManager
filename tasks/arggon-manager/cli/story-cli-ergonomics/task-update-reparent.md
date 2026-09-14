---
type: task
status: todo
id: task-update-reparent
title: "update --parent: reparent items without moving files by hand"
parent: story-cli-ergonomics
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-cli-ergonomics/task-update-reparent.md
  Leaves live only under a story. id is the filename stem: task-update-reparent.
  CLI `arggon create task update-reparent` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# update --parent: reparent items without moving files by hand

## Context

convention.md documents reparenting as move-dir + update parent references, but the CLI has no --parent on update: imported items (import-issues pins them under the adoption story) cannot be moved to their real home without hand-editing files and paths.

## Acceptance

- [ ] `arggon update <id> --parent <new-parent>` validates the edge (expected parent type), rewrites frontmatter, MOVES the file/directory per the folder layout rules (leaves move file; containers move their whole directory), and refuses invalid edges
- [ ] Tests: leaf reparent, container reparent with children (paths updated), invalid edge refusal, cascade/report consistency after move
