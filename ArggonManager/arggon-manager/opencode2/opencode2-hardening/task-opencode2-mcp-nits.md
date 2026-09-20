---
type: task
status: done
id: task-opencode2-mcp-nits
title: "MCP attribution nits: surrogate-safe cap + session table-row wording"
assignee: Arggon
branch: feat/task-opencode2-mcp-nits
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-19"
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

- [x] Cap truncation is surrogate-safe (or the decision to keep code-unit
      semantics is recorded with rationale) + a test with astral input.
- [x] `docs/json-output.md` row wording corrected.
- [x] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Both are cosmetic; explicit-argument pass-through and the U+2028 stdio
  framing limit are documented by-design scope, not gaps.

### 2026-09-18 @Arggon
Worker evidence — draft PR #349 (feat/task-opencode2-mcp-nits). STOP: no merge, no status flip.

1) Surrogate-safe cap (cli/src/mcp-server.ts): META_TOKEN_DELIMITER += \p{Cs} (under /u only lone/unpaired surrogates match); the 64-unit cut backs off one unit when it would land inside a pair (same pattern as sanitize.ts clipHumanValue), so the value keeps the handoff capSession bound and never carries a lone surrogate.
2) docs/json-output.md handoff.session row: now "a _meta.sessionID with a non-empty normalized value".
3) #335 semantics untouched: trim -> cut at first delimiter -> cap; normalize-to-empty = absent; explicit non-empty wins; schemas untouched (parity tests included in the suite).

Evidence:
- Both new unit tests fail on origin/opencode2 (28 tests | 2 failed) and pass with the fix.
- Astral: 40xU+1F600 -> 31xU+1F600 + … (63 code units / 32 code points), no lone surrogate in comment author, handoff session or written body (no U+FFFD).
- Lone surrogate: ses_high<lone-high>more -> ses_high; ses_low<lone-low>more -> ses_low; surrogate-only values -> absent (@me fallback), handoff session omitted.
- Raw stdio probe (built dist, temp repo): astral observedAuthor 63 code units / 32 code points / loneSurrogate false; mid-value lone surrogate observedAuthor "ses_lone"; written body has no U+FFFD and no lone surrogate.

Gates post-merge with origin/opencode2: build ok; npm test 73 files / 1206 passed; lint clean; arggon validate ok (0 errors, 0 warnings); arggon spec validate ok (0/0).

Note: docs/agents.md section MCP server enumerates the delimiter as whitespace/control/format and does not mention the added surrogate class; that file is outside this item's file ownership, flagged in the PR body for the reviewer.

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict NO-MERGE→fixed (07bf1a8: both delimiter enumerations now include the lone-surrogate class; handoff.session row aligned to resolve-to-non-empty). Code approved by the reviewer: surrogate-safe cap verified (astral 31×😀+…, mid-value/lone/surrogate-only cases, no U+FFFD on the meta path), tests fail pre-fix, #335 semantics intact, parity green; CI pass. F2 (explicit-session cap) filed as task-handoff-explicit-session-surrogate. Closing.
