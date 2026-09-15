---
type: task
status: todo
id: task-mcp-parity-full
title: "MCP tool parity: next, show, report, validate as MCP tools"
parent: story-mcp-server
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
depends_on: [task-handoff-command]
---
<!--
  Placement (v0): tasks/scale-adoption/agent-loop/story-mcp-server/task-mcp-parity-full.md
  Leaves live only under a story. id is the filename stem: task-mcp-parity-full.
  CLI `arggon create task mcp-parity-full` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# MCP tool parity: next, show, report, validate as MCP tools

## Context

Candidate #1 of [product discovery](docs/explorations/exploration-product-discovery-002.md) — TOP ranked: MCP-only agents fall back to raw file reads (unbounded context) or cannot get a suggestion at all; the ADR 0006 `next`-first win stops at the CLI. Orchestrator tools ship MCP as the agent surface (codeagentswarm.com, 2026-09-15). Effort M; principle: token-context (completes ADR 0006). MUST land after task-next-dependency-ranking and task-handoff-command (parity wraps their final behavior).

## Acceptance

- [ ] `arggon_next`, `arggon_show`, `arggon_report`, `arggon_validate` MCP tools land (schemas mirror the CLI surface; bounded outputs)
- [ ] Parity harness (cli/src/mcp-parity.test.ts) covers all four + existing tools still green
- [ ] docs/agents.md §MCP server + docs/json-output.md updated (tool list); ADR 0006 completion noted in the item

## Notes
