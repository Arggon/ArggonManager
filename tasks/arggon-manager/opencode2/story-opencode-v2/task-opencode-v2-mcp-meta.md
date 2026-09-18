---
type: task
status: done
id: task-opencode-v2-mcp-meta
title: "MCP: session attribution from _meta.sessionID"
assignee: Arggon
branch: feat/task-opencode-v2-mcp-meta
parent: story-opencode-v2
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode-v2-mcp-meta
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

- [x] `cli/src/mcp-server.ts` reads `params._meta.sessionID` (absent-safe,
      typed as unknown and narrowed) and passes it as the **default**
      `session` for `arggon_handoff` and the **default** `author` for
      `arggon_comment`/`arggon_handoff`; explicit tool arguments always win.
- [x] Attribution is documented as opaque correlation only (never auth), with
      the V2 source, in `docs/agents.md` §MCP server.
- [x] Additive only: no tool schema break; `mcp-parity.test.ts` stays green;
      new tests cover meta present, meta absent, and explicit-arg precedence.
- [x] `docs/json-output.md` updated if any documented envelope text changes
      (comment/handoff payloads should stay identical).

## Notes

- The raw session ID may be long; do not embed it into item bodies beyond the
  existing `session` field semantics, and never log it.
- This is the only place V2 session context reaches the kernel today; do not
  expand it into hidden behavior (e.g. auto-claim) — the CLI rules module stays
  the only path for state transitions.

### 2026-09-18 @Arggon
## W3 delivered — PR #326 (draft; coordinator review + merge pending)

Scope: `arggon mcp` reads `CallToolRequest.params._meta.sessionID` (OpenCode V2 session context, absent-safe, narrowed from `unknown`) and uses it as the **default** `session` for `arggon_handoff` and the **default** `author` for `arggon_comment`/`arggon_handoff`; explicit tool arguments always win. Opaque correlation only — never auth, never logged, no state transitions (`cli/src/rules.ts` stays the only update path), tool input schemas unchanged.

Files: `cli/src/mcp-server.ts`, `cli/src/mcp-server.test.ts`, `docs/agents.md` (§MCP server paragraph). `docs/json-output.md` intentionally unchanged — no documented envelope shape or text changed.

Gates: `mcp-server.test.ts` 22 passed; full suite 68 files / 1087 tests passed (incl. `mcp-parity.test.ts`); `npm run lint` clean; `npm run build` clean; `arggon validate` ok; `arggon spec validate` ok (16 docs, 0 warnings).

Raw stdio probe (expected vs observed): fixture tree + JSON-RPC `tools/call` lines piped into `arggon mcp` over real stdio, `GITHUB_USER=probe-fallback` pins the @me fallback.

- handoff + `params._meta.sessionID=ses_probe_123` → observed `comment.author: ses_probe_123`, `handoff.session: ses_probe_123` (expected ✅), body heading `@ses_probe_123 (session: ses_probe_123)`.
- comment + meta → observed `comment.author: ses_probe_123` (expected ✅).
- handoff/comment without `_meta` → observed `comment.author: probe-fallback`, no `session` key (unchanged behavior ✅).
- explicit `session`/`author` + ignored meta → observed `explicit-user` / `sess_explicit` (explicit wins ✅).

Repro script: `/tmp/opencode/mcp-meta-probe/probe.sh` (local evidence, not committed). Full raw output is in the PR body of #326.

### handoff 2026-09-18 @Arggon (session: ses_f4dadcc7fffehkUkI3RuIzyXRk) — next: Coordinator: review PR #326 (draft, base opencode2) against the W3 contract, then tick the acceptance checklist and flip to done after merge.
- branch: feat/task-opencode-v2-mcp-meta
- open questions: None; docs/json-output.md intentionally unchanged (no envelope contract change).

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; the F2 docs-precision fix landed (4085642: explicit NON-EMPTY args win + empty-explicit fallback test); merged with cli pass. F1/F3 deferred to task-opencode-v2-mcp-meta-hardening.
