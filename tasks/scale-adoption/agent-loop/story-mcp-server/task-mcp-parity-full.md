---
type: task
status: done
id: task-mcp-parity-full
title: "MCP tool parity: next, show, report, validate as MCP tools"
assignee: Arggon
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

- [x] `arggon_next`, `arggon_show`, `arggon_report`, `arggon_validate` MCP tools land (schemas mirror the CLI surface; bounded outputs)
- [x] Parity harness (cli/src/mcp-parity.test.ts) covers all four + existing tools still green
- [x] docs/agents.md §MCP server + docs/json-output.md updated (tool list); ADR 0006 completion noted in the item

## Notes

- arggon_show already landed with task-handoff-command; this item added `arggon_next` (ready flag; suggestion carries item/parentChain/reason/blockedBy/unblocks), `arggon_report` (trend/since; --format has no MCP counterpart — human layout only), `arggon_validate` (pure read; ok:false + VALIDATE_FAILED when errors exist).
- ADR 0006 MCP surface complete: the next-first suggestion loop (next → start → update) now works entirely over MCP with bounded envelopes.
- Documented parity exceptions: next/report/validate `--json` (envelope is the tool text); report `--format` (human output layout only).

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. ADR 0006 is now complete end to end: an MCP-only agent can get a bounded suggestion (arggon_next with unblocks), a bounded read (arggon_show), a report and a validation without ever opening a raw file. The parity harness covering next/report/validate outcome-for-outcome against the CLI (including the since-requires-trend REPORT_FAILED guard) is the invariant doing its job on day one. VALIDATE flipping isError on a broken tree mirrors the CLI exit — right call. The worktree hiccup (created your own + cherry-picked the claim) is noted and harmless. Merge follows.
