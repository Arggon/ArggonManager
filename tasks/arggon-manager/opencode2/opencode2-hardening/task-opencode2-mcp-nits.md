---
type: task
status: in_progress
id: task-opencode2-mcp-nits
title: "MCP attribution nits: surrogate-safe cap + session table-row wording"
assignee: Arggon
branch: feat/task-opencode2-mcp-nits
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T17:28:18.190Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-mcp-nits
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-opencode2-mcp-nits.md
  Leaves live only under a story. id is the filename stem: task-opencode2-mcp-nits.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# MCP attribution nits: surrogate-safe cap + session table-row wording

## Context

Informational findings from the independent review of PR #335
(`task-opencode-v2-mcp-meta-hardening`), filed per the repo rule.

- **Astral truncation.** `normalizeSessionID` uses UTF-16 code units, so the
  64-cap can split a surrogate pair (40×😀 → lone high surrogate + `…`) and a
  lone surrogate passes the delimiter class (no `\p{Cs}`). Cosmetic only; the
  single-line and ≤64 invariants hold, and the arithmetic mirrors the
  pre-existing `capSession` in `cli/src/handoff.ts`. Fix only if
  arbitrary-Unicode IDs ever need clean round-trip: iterate code points
  (`Array.from`) or add `\p{Cs}` to the delimiter.
- **Table-row wording.** `docs/json-output.md` `handoff.session` row says
  "Present when `--session` was given or the client sent `_meta.sessionID`";
  a meta value that normalizes to empty was sent yet correctly yields no
  session. Say "a non-empty normalized value".

## Acceptance

- [ ] Cap truncation is surrogate-safe (or the decision to keep code-unit
      semantics is recorded with rationale) + a test with astral input.
- [ ] `docs/json-output.md` row wording corrected.
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Both are cosmetic; explicit-argument pass-through and the U+2028 stdio
  framing limit are documented by-design scope, not gaps.
