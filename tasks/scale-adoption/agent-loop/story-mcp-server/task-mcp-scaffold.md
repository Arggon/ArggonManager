---
type: task
status: todo
id: task-mcp-scaffold
title: Scaffold stdio MCP server
parent: story-mcp-server
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Scaffold stdio MCP server

## Context

Stdio MCP server entry point wired to the existing shared kernel modules.

## Acceptance

- [ ] `arggon-mcp` bin or `arggon mcp` starts a stdio server
- [ ] Handshake works with at least two MCP clients
- [ ] Zero new schema logic — kernel imports only
