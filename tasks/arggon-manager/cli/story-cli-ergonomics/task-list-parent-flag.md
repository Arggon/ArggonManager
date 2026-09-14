---
type: task
status: done
id: task-list-parent-flag
title: first-class list --parent flag; MCP arggon_update lacks parent
assignee: Arggon
branch: feat/task-list-parent-flag
parent: story-cli-ergonomics
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-cli-ergonomics/task-list-parent-flag.md
  Leaves live only under a story. id is the filename stem: task-list-parent-flag.
  CLI `arggon create task list-parent-flag` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# first-class list --parent flag; MCP arggon_update lacks parent

## Context

From the task-update-reparent review (PR #165): `arggon list` has no
first-class `--parent <id>` flag — subtree queries go through the
`parent:`/`ancestor:` filter predicates (task-ancestor-filter). Also the MCP
server's `arggon_update` tool does not expose `parent`, so MCP callers cannot
reparent (CLI-only today; the validation is kernel-level, so exposure is
mechanical).

## Acceptance

- [x] Decide: add `--parent <id>` to `arggon list` (sugar over the predicate) or document predicates as the only path — either way documented
- [x] MCP `arggon_update` exposes `parent` with the same edge validation as the CLI (or the exclusion is documented deliberately)

## Notes
