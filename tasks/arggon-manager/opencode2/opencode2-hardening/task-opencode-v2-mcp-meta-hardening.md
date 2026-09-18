---
type: task
status: in_progress
id: task-opencode-v2-mcp-meta-hardening
title: "MCP meta hardening: normalize/cap the meta-derived author (F1) + edge tests (F3)"
assignee: Arggon
branch: feat/task-opencode-v2-mcp-meta-hardening
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T14:09:11.273Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode-v2-mcp-meta-hardening
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode-v2-mcp-meta-hardening.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-mcp-meta-hardening.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# MCP meta hardening: normalize/cap the meta-derived author (F1) + edge tests (F3)

## Context

Non-blocking findings from the independent review of PR #326
(`task-opencode-v2-mcp-meta`), which shipped `_meta.sessionID` as the default
`session`/`author` for `handoff`/`comment`.

- **F1 — unbounded/unsanitized meta-derived author.** The raw session ID is
  forwarded as `author`; the handoff `session` field is capped at 64 chars by
  the kernel, but `comment.author` is only trimmed. Repro: a 300-char ID yields
  a 300-char author and heading (the session field shows 64 + `…`); a value
  containing `\n### injected heading` writes a literal extra heading line.
  Exposure is low (OpenCode V2 IDs are ~29 chars) and explicit CLI args already
  allowed this, but the new **implicit default path** embeds a client-controlled
  value automatically and the `docs/json-output.md` bounded-output claim is not
  reconciled.
- **F3 — edge coverage.** Missing tests: whitespace-only `sessionID`, a long ID
  asserting the chosen bound, control characters, and the empty-explicit
  fallback (the fallback test lands with the PR #326 wording fix if cheap;
  otherwise include it here).

## Acceptance

- [x] The meta-derived value is normalized before it can reach an item body:
      single-line token (reject/trim at control characters or whitespace) and a
      documented cap (64 chars + `…`, consistent with the handoff `session`
      cap) **or** an explicit documented decision that the author is opaque and
      uncapped, with `docs/json-output.md`'s bounded claim updated to match.
- [x] Tests cover whatever is missing after PR #326: whitespace-only, long ID
      bound, control-character value, empty-explicit fallback.
- [x] `docs/agents.md` and `docs/json-output.md` consistent with the shipped
      behavior.
- [x] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Prefer normalizing at the boundary (`sessionIDFromMeta`) over per-consumer
  logic, so every future consumer inherits the invariant.

### 2026-09-18 @Arggon
## F1 + F3 delivered — meta author normalized at the boundary (PR pending)

**Decision (preferred path): normalize once in `sessionIDFromMeta`**, so every consumer (`handoff.session`, `comment.author`, `handoff` author) inherits the invariant instead of per-consumer logic. A value is a single-line token: trimmed, cut at the first whitespace/control/format character (`/[\s\p{Cc}\p{Cf}]/u`), capped at `HANDOFF_SESSION_CAP` (64) with `…` (63 + marker), and normalize-to-empty counts as absent (falls back to `@me` / no session). Explicit tool args keep their existing kernel semantics (comment trims; handoff caps `session` at 64) — unchanged, per the F1 scope note.

**Files:** `cli/src/mcp-server.ts` (`normalizeSessionID` + `sessionIDFromMeta`, module doc, tool descriptions), `cli/src/mcp-server.test.ts` (F3 edge tests), `docs/agents.md` §MCP server, `docs/json-output.md` (comment/handoff bounded claims + MCP paragraph).

**Gates:** full suite **69 files / 1130 tests passed** (incl. `mcp-parity.test.ts`; schema additive-only); `npm run lint` clean; `npm run build` clean; `arggon validate` `{ok:true,errors:[]}`; `arggon spec validate` `{ok:true,errors:[]}`.

**Raw stdio probe** (`tools/call` JSON-RPC lines into `arggon mcp` from source, throwaway fixture tree, `GITHUB_USER=fallback-user` pins `@me`; expected vs observed):

| case (meta / args) | expected | before | after |
| --- | --- | --- | --- |
| handoff, `ses_meta_ok` | unchanged | author+session `ses_meta_ok` ✅ | same ✅ |
| handoff, 300×`s` | both bounded | author **300 chars**, session 64 (`63×s…`) | author+session 64 (`63×s…`) ✅ |
| comment, 300×`s` | author bounded | author **300 chars** | author 64 (`63×s…`) ✅ |
| comment, `ses_safe\n### injected heading` | `ses_safe`, no injected line | author raw 29 chars, **literal `### injected heading` line** (2 headings) | `@ses_safe`, 1 heading ✅ |
| comment, `\u0000\u0001` (control-only) | absent | author raw control chars | `fallback-user` ✅ |
| comment, `"   "` (whitespace-only) | absent | `fallback-user` | `fallback-user` ✅ |
| comment, meta absent | `@me` | `fallback-user` | `fallback-user` ✅ |
| comment, explicit `author:""` + meta | meta wins (PR #326) | `ses_meta_empty_explicit` | same ✅ |
| handoff, explicit session/author + meta | explicit wins | `explicit-user` / `sess_explicit` | same ✅ |

Probe: `/tmp/opencode/mcp-meta-probe.mts` + `mcp-meta-probe-{before,after}.json` (local run artifacts, not committed).

**Notes:**
- A raw U+2028/U+2029 inside a JSON-RPC line is treated as a line terminator by `node:readline`, so it can never reach `sessionIDFromMeta` over stdio (the server sees two parse errors); the edge tests therefore pin `\r`, `\t`, NUL and U+200B (all escaped/valid inside JSON strings) while `\s` still covers U+2028/U+2029 for non-stdio transports (e.g. Streamable HTTP).
- `docs/json-output.md` bounded claims reconciled: the meta-derived default carries the same 64-char single-line bound as `handoff.session`, so the ~800-char handoff section bound holds for meta-attributed MCP calls too.

### handoff 2026-09-18 @Arggon (session: ses_f4b26f46dffeWx74XM6jc8Ey4V) — next: Review draft PR (F1 normalization in sessionIDFromMeta + F3 edge tests + docs bounded claims), re-run gates, merge, then flip this item to done.
- branch: feat/task-opencode-v2-mcp-meta-hardening
