---
type: task
status: done
id: task-mcp-playbook-rules
title: Encode agent playbook rules in the MCP layer
assignee: Arggon
parent: story-mcp-server
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Encode agent playbook rules in the MCP layer

## Context

Agents must not reopen done/cancelled, must not steal claims, and unclaim clears assignee and branch. Encode these once so CLI and MCP inherit them.

## Acceptance

- [x] Rules live in one module imported by both CLI and MCP
- [x] Agent-flagged callers cannot reopen or force-steal
- [x] Rule tests cover the forbidden paths
