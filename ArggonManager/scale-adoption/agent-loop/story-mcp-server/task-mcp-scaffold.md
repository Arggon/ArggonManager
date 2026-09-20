---
type: task
status: done
id: task-mcp-scaffold
title: Scaffold stdio MCP server
assignee: Arggon
parent: story-mcp-server
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Scaffold stdio MCP server

## Context

Stdio MCP server entry point wired to the existing shared kernel modules.

## Acceptance

- [x] `arggon mcp` starts a stdio server
- [x] Handshake works with at least two MCP clients
- [x] Zero new schema logic — kernel imports only
