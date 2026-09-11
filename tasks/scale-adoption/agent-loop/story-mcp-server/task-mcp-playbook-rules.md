---
type: task
status: todo
id: task-mcp-playbook-rules
title: Encode agent playbook rules in the MCP layer
parent: story-mcp-server
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Encode agent playbook rules in the MCP layer

## Context

Agents must not reopen done/cancelled, must not steal claims, and unclaim clears assignee and branch. Encode these once so CLI and MCP inherit them.

## Acceptance

- [ ] Rules live in one module imported by both CLI and MCP
- [ ] Agent-flagged callers cannot reopen or force-steal
- [ ] Rule tests cover the forbidden paths
