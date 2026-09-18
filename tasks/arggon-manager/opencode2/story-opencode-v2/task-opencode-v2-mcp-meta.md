---
type: task
status: todo
id: task-opencode-v2-mcp-meta
title: "MCP: session attribution from _meta.sessionID"
priority: p2
parent: story-opencode-v2
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-opencode-v2/task-opencode-v2-mcp-meta.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-mcp-meta.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# MCP: session attribution from _meta.sessionID

## Context

OpenCode V2 sends the invoking session ID in
`CallToolRequest.params._meta.sessionID` for calls made on behalf of a session,
over every transport, and documents it as an opaque correlation value — the
docs explicitly warn not to use it for authentication or authorization
(https://opencode.ai/v2/docs/mcp-servers/, accessed 2026-09-17). ArggonManager
already accepts `session` on `handoff` and `author` on `comment`/`handoff`; a
caller that omits them today gets no attribution. Reading `_meta.sessionID`
lets every MCP client that provides it get attribution for free, while the CLI
stays unchanged.

## Acceptance

- [ ] `cli/src/mcp-server.ts` reads `params._meta.sessionID` (absent-safe,
      typed as unknown and narrowed) and passes it as the **default**
      `session` for `arggon_handoff` and the **default** `author` for
      `arggon_comment`/`arggon_handoff`; explicit tool arguments always win.
- [ ] Attribution is documented as opaque correlation only (never auth), with
      the V2 source, in `docs/agents.md` §MCP server.
- [ ] Additive only: no tool schema break; `mcp-parity.test.ts` stays green;
      new tests cover meta present, meta absent, and explicit-arg precedence.
- [ ] `docs/json-output.md` updated if any documented envelope text changes
      (comment/handoff payloads should stay identical).

## Notes

- The raw session ID may be long; do not embed it into item bodies beyond the
  existing `session` field semantics, and never log it.
- This is the only place V2 session context reaches the kernel today; do not
  expand it into hidden behavior (e.g. auto-claim) — the CLI rules module stays
  the only path for state transitions.
