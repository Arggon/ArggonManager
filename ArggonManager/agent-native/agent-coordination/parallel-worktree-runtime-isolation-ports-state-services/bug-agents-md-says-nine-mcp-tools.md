---
type: bug
status: in_progress
id: bug-agents-md-says-nine-mcp-tools
title: "`docs/agents.md:410` says `arggon mcp` exposes NINE tools; shipped is FIFTEEN — and `agents.md:586` contradicts its own line 410"
assignee: Arggon
branch: fix/bug-agents-md-says-nine-mcp-tools
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [docs, mcp]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T10:44:59.713Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-agents-md-says-nine-mcp-tools
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-agents-md-says-nine-mcp-tools.md
  Leaves live only under a story. id is the filename stem: bug-agents-md-says-nine-mcp-tools.
  CLI `arggon create bug agents-md-says-nine-mcp-tools` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/agents.md:410` says `arggon mcp` exposes NINE tools; shipped is FIFTEEN — and `agents.md:586` contradicts its own line 410

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the worker on PR #610 (task-adr0020-claude-seam-statement-stale), 2026-10-03, reported rather than fixed because `docs/agents.md` is a methodology CARRIER and editing it inside a one-file ADR PR would have widened the blast radius.

**The defect.** `ArggonManager/docs/agents.md:410` (the MCP server section) says `arggon mcp` exposes **nine** tools. Shipped is **fifteen** — ADR 0014 grew the surface (priority, sync, import_issues, start, branch, cleanup) — and **`:586` in the same file already says fifteen**. So the carrier contradicts itself, and an agent reading the §MCP server section is told a third of the surface exists.

This is a carrier change, so per `docs/agents.md` §Changing the methodology it is **Behavioral** with an ADR 0016 reference, and the skill's copies must stay byte-equal in the same PR. That is exactly why the worker was right to file it rather than absorb it.

Note the shape: this is the same drift class as `bug-engineering-doc-stale-adr-statuses` (an ADR status claim in a carrier) and `bug-mcp-budget-contradicted-across-docs` (a budget figure stated twice with different numbers). Three this session, all "a carrier restates a fact that changed elsewhere, and the restatement was never updated."

Acceptance:
- [ ] `agents.md:410` corrected to the shipped count, sourced from `cli/src/mcp-server.ts` (the tool registry) rather than a copy of another number
- [ ] The whole carrier swept for any other stale MCP tool count or tool-name list
- [ ] `skills/arggon-cli/` and its byte-equal `.agents/skills/` copy updated in the SAME PR (Behavioral → adopter-upgrade channel per ADR 0016)
- [ ] A check pins the documented count to the registry so this cannot drift again — a doc-contract test is the pattern the repo already uses (`adr-index-parity`, `opencode2-doc-contract`)
- [ ] State the impact class (Behavioral) in the PR and as an item comment
