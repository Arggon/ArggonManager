---
type: task
status: in_progress
id: task-init-mcp-config
title: Init registers the arggon MCP server (.mcp.json)
assignee: Arggon
branch: feat/task-init-mcp-config-impl
parent: story-init-docs
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T12:37:29.366Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-init-mcp-config.md
  Leaves live only under a story. id is the filename stem: task-init-mcp-config.
  CLI `arggon create task init-mcp-config` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Init registers the arggon MCP server (.mcp.json)

## Context

The init bundles the arggon-cli skill (task-init-skill-bundle) but does not register the arggon MCP server with the adopter's tooling: adopters have to hand-write the .mcp.json config (Claude Code / Cursor / ZCode project-scoped standard: {"mcpServers": {"arggon": {command, args}}}). The init should generate it, same doctrine as the skill: generated from master templates, never overwriting existing files, entering the x-generated provenance state.

Design notes: the file must remain VALID JSON — the arggon:generated provenance marker (an HTML comment) would break MCP clients' parsers, so this template ships without the marker (checksum provenance still applies via x-generated). Command: "arggon" on PATH (documented).

## Acceptance

- [ ] arggon init generates .mcp.json (tier-1, valid JSON, mcpServers.arggon = {command: "arggon", args: ["mcp"]}, NO HTML marker inside), enters x-generated state, never overwrites, skipped[]/created[] reported
- [ ] Generated AGENTS.md mentions the registered MCP server (.mcp.json)
- [ ] Tests (valid JSON parse, no-overwrite, idempotent, x-generated entry) + README/docs/agents.md + SKILL.md sync
