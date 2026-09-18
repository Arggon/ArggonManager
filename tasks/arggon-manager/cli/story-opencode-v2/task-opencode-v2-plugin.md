---
type: task
status: todo
id: task-opencode-v2-plugin
title: "Optional OpenCode V2 plugin: MCP auto-registration and item context"
priority: p3
depends_on: [task-opencode-v2-adr]
parent: story-opencode-v2
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-opencode-v2/task-opencode-v2-plugin.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-plugin.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Optional OpenCode V2 plugin: MCP auto-registration and item context

## Context

Phase 2 of [story-opencode-v2](./story-opencode-v2.md). The research
([exploration-opencode-v2-native-009](../../../../docs/explorations/exploration-opencode-v2-native-009.md))
found behaviors that only a plugin can provide: MCP auto-registration via
`ctx.mcp.transform`, bounded current-item context injection via
`session.hook("context")`, and compaction-safe re-injection. V2 loads
`.opencode/plugins/*` with zero config, and `session.hook("prompt" | "context"
| "compaction")`, `tool.hook`, `permission.hook` and the documented transforms
are non-experimental surfaces (V2 docs, accessed 2026-09-17). Distribution
(published package vs vendored template) is decided by task-opencode-v2-adr.

## Acceptance

- [ ] Plugin skeleton per the ADR decision, thin and optional: `id`, `setup`,
      cleanup; a load or runtime failure must never block the CLI/MCP surfaces.
- [ ] MCP auto-registration: `ctx.mcp.transform` sets the arggon server only
      when `editor.get("arggon")` is absent (never clobber a configured server).
- [ ] Bounded current-item context: resolve the session's branch (or an
      explicit env override) to a work item and inject an `arggon show --json`
      summary through `session.hook("context")`; no unbounded reads; no-op
      outside arggon repos; documented in the playbook.
- [ ] Compaction-safe: the item block is re-injected after a checkpoint
      (`compaction` hook and/or the next `context` call); verified in a long
      session smoke with evidence in the review verdict.
- [ ] Optional tracker-hygiene signal: after shell commands that commit, a
      failing `arggon validate --json` surfaces a warning — never a blocking
      gate (the pre-commit/CI gates stay authoritative).
- [ ] Smoke evidence for the plugin-present path and the plugin-absent path;
      tests for the guard logic; docs updated (playbook + agents.md).
- [ ] No rule duplication: the plugin calls the CLI/MCP kernel; it never
      decides status transitions itself.

## Notes

- Version-pin `@opencode/plugin` and feature-detect; record API-drift findings
  as follow-ups rather than chasing V2 releases.
- Deliberately excluded: a plugin worktree strategy (`arggon start --worktree`
  stays authoritative) and `experimental.ws.*` hooks.
