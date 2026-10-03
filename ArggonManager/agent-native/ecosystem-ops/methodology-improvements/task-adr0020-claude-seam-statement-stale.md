---
type: task
status: in_progress
id: task-adr0020-claude-seam-statement-stale
title: "ADR 0020 now understates the Claude Code seam: `.mcp.json` → `arggon mcp` delivers 15 tools/envelopes, so \"remains docs + CLAUDE.md\" is no longer accurate"
assignee: Arggon
branch: feat/task-adr0020-claude-seam-statement-stale
parent: methodology-improvements
labels: [adr, docs]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T02:50:04.107Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr0020-claude-seam-statement-stale
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr0020-claude-seam-statement-stale.md
  Leaves live only under a story. id is the filename stem: task-adr0020-claude-seam-statement-stale.
  CLI `arggon create task adr0020-claude-seam-statement-stale` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0020 now understates the Claude Code seam: `.mcp.json` → `arggon mcp` delivers 15 tools/envelopes, so "remains docs + CLAUDE.md" is no longer accurate

## Context

Found by the reviewer of PR #600 (task-capability-matrix), 2026-10-02.

ADR 0020 (Accepted, this coordinator wrote it) states Claude Code "remains docs + `CLAUDE.md`". That is now understated: `.mcp.json` is committed and init-generated (`cli/src/docs.ts:278`, asserted `cli/src/init.test.ts:389`) and registers `arggon mcp` for any MCP client, so a Claude Code client already runs the full 15-tool surface with the same envelopes and kernel operations. The capability-matrix work proved this end to end, and three `claude` rows were corrected from `gap: true` to `gap: false` because of it.

The ADR is the durable record and it currently understates a shipped surface — the same class as ADR 0019's stale decision point that PR #598 just fixed. What genuinely IS missing on Claude Code is narrower and belongs in the ADR: no `.claude/` hook or permission config (so no client-side `PreToolUse` gate) and no session context hook. Amend the existing ADR with a dated amendment (do not rewrite, do not renumber).

## Acceptance

- [ ] A dated amendment to ADR 0020 corrects the Claude Code statement: name the `.mcp.json` → `arggon mcp` 15-tool surface as delivered, and state the actual gaps (no client-side hook/permission gate, no session context hook)
- [ ] The amendment is sourced to shipped code (`cli/src/docs.ts` init destination, `docs/agents.md` "still serves other clients"), not to the capability matrix's prose
- [ ] `Status: Accepted` and the ADR's number are untouched; nothing rewritten in place

## Notes
