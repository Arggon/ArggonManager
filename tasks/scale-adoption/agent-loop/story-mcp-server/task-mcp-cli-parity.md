---
type: task
status: todo
id: task-mcp-cli-parity
title: "MCP and CLI stay in sync: parity-tested tool surface"
parent: story-mcp-server
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/scale-adoption/agent-loop/story-mcp-server/task-mcp-cli-parity.md
  Leaves live only under a story. id is the filename stem: task-mcp-cli-parity.
  CLI `arggon create task mcp-cli-parity` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# MCP and CLI stay in sync: parity-tested tool surface

## Context

Requirement (2026-09-14): **the MCP server and the CLI must always stay in
sync.** The MCP tools (`arggon_list`, `arggon_create`, `arggon_update`,
`arggon_comment`) wrap the same kernel as the CLI, but the sync is only
conventional today — every CLI wave can (and did) leave the MCP surface
behind: `update --parent` landed CLI-only in PR #165 and needed a separate PR
(#179) to reach `arggon_update`; `list --parent` (also #179) may still be
missing from `arggon_list`'s schema. "Always" must be enforced by a test, not
remembered.

A parity harness already exists (cli/src/mcp-parity.test.ts) — extend it into
the standing invariant.

## Acceptance

- [ ] mcp-parity.test.ts derives the CLI option surface for the four wrapped commands (list, create, update, comment — from the commander definitions or the kernel option types) and fails when a CLI option has no counterpart in the MCP tool input schema (or vice versa), with a maintained explicit exception list where the CLI surface is intentionally interactive-only (e.g. --no-commit defaults, TTY-only gates)
- [ ] Current drift fixed so the parity test is green WITHOUT exceptions beyond the documented list — known candidate: `arggon_list` schema lacks `parent` (and any other flag parity flags)
- [ ] The invariant is documented: docs/agents.md §MCP server and docs/json-output.md state that MCP tool schemas are parity-tested against the CLI (additive changes only; breaking changes bump schemaVersion)

## Notes

- File 2026-09-14 by the coordinator; origin: requirement "el mcp y el cli deben estar en sync siempre".
- Related: task-list-parent-flag (#179) fixed one instance of the drift; this item makes the class impossible to reintroduce silently.

## Notes
