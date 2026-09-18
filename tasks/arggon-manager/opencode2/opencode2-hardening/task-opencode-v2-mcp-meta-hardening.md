---
type: task
status: todo
id: task-opencode-v2-mcp-meta-hardening
title: "MCP meta hardening: normalize/cap the meta-derived author (F1) + edge tests (F3)"
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
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

- [ ] The meta-derived value is normalized before it can reach an item body:
      single-line token (reject/trim at control characters or whitespace) and a
      documented cap (64 chars + `…`, consistent with the handoff `session`
      cap) **or** an explicit documented decision that the author is opaque and
      uncapped, with `docs/json-output.md`'s bounded claim updated to match.
- [ ] Tests cover whatever is missing after PR #326: whitespace-only, long ID
      bound, control-character value, empty-explicit fallback.
- [ ] `docs/agents.md` and `docs/json-output.md` consistent with the shipped
      behavior.
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Prefer normalizing at the boundary (`sessionIDFromMeta`) over per-consumer
  logic, so every future consumer inherits the invariant.
