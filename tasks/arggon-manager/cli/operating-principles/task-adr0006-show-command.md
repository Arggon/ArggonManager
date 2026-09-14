---
type: task
status: done
id: task-adr0006-show-command
title: "ADR 0006: arggon show <id> progressive-disclosure read path (CLI + MCP)"
assignee: Arggon
branch: feat/task-adr0006-show-command
parent: operating-principles
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-adr0006-show-command.md
  Leaves live only under a story. id is the filename stem: task-adr0006-show-command.
  CLI `arggon create task adr0006-show-command` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0006: arggon show task-adr0006-show-command progressive-disclosure read path (CLI + MCP)

## Context

Implements the structural quick win of accepted [ADR 0006](../../../docs/adr/0006-token-context-efficiency.md): today there is NO `arggon show <id>` — agents read whole item files via the filesystem, and comment tails grow the read unbounded (~226 B per comment, paid on every read). SPEC FIRST per the methodology.

## Acceptance

- [x] Spec (docs/specs/, arggon spec new) then implementation: `arggon show <id> [--meta] [--body] [--tail-comments N]` — default compact (frontmatter + last N comments), bounded reads; MCP `arggon_show` tool parity-tested (task-mcp-cli-parity harness)
- [x] Tests: bounded output, comment tailing, unknown id error; docs in README + docs/json-output.md (additive)

## Notes
