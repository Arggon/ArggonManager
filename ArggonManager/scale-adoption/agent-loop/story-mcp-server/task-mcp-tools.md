---
type: task
status: done
id: task-mcp-tools
title: "Expose list, create, update as MCP tools"
assignee: Arggon
parent: story-mcp-server
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# "Expose list, create, update as MCP tools"

## Context

Map list/create/update onto MCP tool schemas using the existing `--json` objects.

## Acceptance

- [x] Tool results reuse the documented JSON contract shapes
- [x] Errors surface as tool errors with the CLI's message text
- [x] Parity tests: same inputs produce same outcomes via CLI and MCP
