---
type: story
status: done
id: story-mcp-server
title: Expose the CLI as an MCP server
assignee: Arggon
branch: feat/story-mcp-server
parent: agent-loop
labels: [integration]
created: "2026-09-11"
updated: "2026-09-11"
---
# Expose the CLI as an MCP server

## Context

Expose the shared kernel (`items.ts`, `status.ts`, `update.ts`) as MCP tools so any MCP-capable agent gets list/create/update with the same rules and the same JSON contract as the CLI — no shell glue, no private dialect.

## Acceptance

- [x] MCP tools for list, create, update mirror CLI semantics exactly
- [x] Playbook rules (claims, transitions, no agent reopen) enforced in one shared place
- [x] Contract tests run against both CLI and MCP entry points
