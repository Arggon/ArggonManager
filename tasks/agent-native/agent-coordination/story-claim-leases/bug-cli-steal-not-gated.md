---
type: bug
status: todo
id: bug-cli-steal-not-gated
title: "CLI --steal is not agent-gated: the human-only guarantee is false in the main interface"
parent: story-claim-leases
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-claim-leases/bug-cli-steal-not-gated.md
  Leaves live only under a story. id is the filename stem: bug-cli-steal-not-gated.
  CLI `arggon create bug cli-steal-not-gated` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CLI --steal is not agent-gated: the human-only guarantee is false in the main interface

## Context

Found by the guardian adoption agent (2026-09-13, verified with a clean repro): `arggon update <id> --steal --reason ... --assignee X` executed by an AGENT via the CLI succeeded (ok:true, claim refreshed). The skill/docs/docs/claim.md guarantee `--steal` is HUMAN-only. Root cause: `rules.ts` refuses steal only when `caller === "agent"`, and the ONLY caller that passes `agent: true` is the MCP server (`mcp-server.ts`) — and its `arggon_update` schema doesn't even expose `steal`. The CLI never sets `agent: true` (`cli.ts` update action), so the guard is unreachable in the main interface. Reproduced in a clean temp tree: claimed item (alice) -> steal by "agent" -> ok, assignee becomes mallory.

Impact: the multi-agent governance guarantee (dead-agent claims can only be taken over by a supervised human) is unenforceable in the CLI. The guardian experiment left exactly this exploit open.

## Acceptance

- [ ] A design decision lands for CLI caller identity — candidates: (a) interactive TTY confirmation for --steal (agents are non-interactive; humans confirm with y/N), (b) opt-in config `x-tracker.allow-steal: true` required to arm the flag, (c) env/flag-based agent marking with docs. Whatever lands, the guard must be test-enforced in BOTH entry points.
- [ ] Tests: steal via CLI blocked/confirmed per the landed design; steal via MCP still refused; docs updated (skill, claim.md, agents.md)
