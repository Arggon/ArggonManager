---
type: task
status: in_progress
id: task-mcp-spec-2026-eval
title: "MCP spec 2026-07-28 adoption evaluation (Tasks, Extensions, stateless)"
assignee: Arggon
branch: feat/task-mcp-spec-2026-eval
parent: story-mcp-server
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T22:23:23.539Z"
---
<!--
  Placement (v0): tasks/scale-adoption/agent-loop/story-mcp-server/task-mcp-spec-2026-eval.md
  Leaves live only under a story. id is the filename stem: task-mcp-spec-2026-eval.
  CLI `arggon create task mcp-spec-2026-eval` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# MCP spec 2026-07-28 adoption evaluation (Tasks, Extensions, stateless)

## Context

Candidate #4 of the product-discovery research round (2026-09-15): MCP specification 2026-07-28 is the biggest protocol overhaul — stateless core, Extensions framework, Tasks for long-running operations, MCP Apps, multi round-trip requests, cacheable list endpoints, updated SDKs (modelcontextprotocol.io, 2026-09-15). ArggonManager's stdio server (9 tools, sync JSON-RPC) predates it. RESEARCH + EVALUATION task: decide what adoption means for us, via exploration + ADR. Spec/code changes are follow-ups.

## Acceptance

- [x] Exploration recorded via `arggon stack explore` (docs/explorations/, dated sources from modelcontextprotocol.io + blog + Cloudflare): map each new capability to our server (stateless: already?; Tasks: our tools are fast — would long-running candidates be init/adopt/report --trend?; Extensions: declare ArggonManager?; cacheable list endpoints: our list is cheap) — docs/explorations/exploration-mcp-2026-07-28-004.md
- [x] ADR (next number, Proposed in PR): adopt / partial-adopt / defer per capability, with the SDK story (stdio JSON-RPC vs new transports) and consequences — docs/adr/0007-mcp-2026-07-28-adoption.md (Proposed)
- [x] No product code changes — implementation lands via follow-up items if the ADR adopts anything

## Notes
