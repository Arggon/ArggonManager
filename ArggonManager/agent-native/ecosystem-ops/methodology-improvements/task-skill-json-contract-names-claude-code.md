---
type: task
status: todo
id: task-skill-json-contract-names-claude-code
title: "`skills/arggon-cli/references/json-contract.md` §MCP surface names ZCode as the no-code-mode client but not Claude Code, which now gets the same 15-tool MCP surface"
parent: methodology-improvements
labels: [docs, skills]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-skill-json-contract-names-claude-code.md
  Leaves live only under a story. id is the filename stem: task-skill-json-contract-names-claude-code.
  CLI `arggon create task skill-json-contract-names-claude-code` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `skills/arggon-cli/references/json-contract.md` §MCP surface names ZCode as the no-code-mode client but not Claude Code, which now gets the same 15-tool MCP surface

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #610 (task-adr0020-claude-seam-statement-stale), 2026-10-03.

`skills/arggon-cli/references/json-contract.md` §MCP surface names **ZCode** as the client that has no code mode and must use the MCP server. It does not name **Claude Code** — which now gets the identical 15-tool `arggon mcp` surface via the init-generated `.mcp.json` (corrected in ADR 0021 by PR #610, and already reflected in the committed capability matrix's `claude:mcp` rows).

So the agent-facing skill under-describes where the methodology applies, and an agent reading it could reasonably conclude Claude Code is not a supported client. The capability matrix says otherwise, which means **the skill and the shipped data disagree**.

Both the source (`skills/arggon-cli/`) and the byte-equal mirror (`.agents/skills/`) need the update in one PR, plus `npm run skills:sync` so the mirror regenerates rather than being hand-edited — and, since the seam drift gate became branch-aware in PR #607, any committed generated copy must be regenerated rather than left stale.

Acceptance:
- [ ] §MCP surface names BOTH clients that reach the kernel over MCP (ZCode and Claude Code), with the mechanism for each (`.mcp.json` init destination; the ZCode plugin bundle)
- [ ] The statement stays true after the S6 Claude Code adapter lands — phrase it so adding a client is an edit, not a contradiction
- [ ] `skills/arggon-cli/` and `.agents/skills/` byte-equal, mirror regenerated via `npm run skills:sync` (not hand-copied)
- [ ] Beam consistent with the shipped capability matrix rows (no skill/matrix disagreement)
- [ ] Carrier change → state the impact class per `docs/agents.md` §Changing the methodology

### 2026-10-09 @Arggon
verdict: approve
PR https://github.com/Arggon/ArggonManager/pull/668 merged by the wave runner after a standards-review approve.
Maker summary: review approved; waiting on CI for https://github.com/Arggon/ArggonManager/pull/668
Flip not attempted (acceptance incomplete) — item stays open.
