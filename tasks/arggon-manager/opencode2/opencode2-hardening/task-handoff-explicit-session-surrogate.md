---
type: task
status: in_progress
id: task-handoff-explicit-session-surrogate
title: handoff explicit --session cap is not surrogate-safe (astral split + U+FFFD in body)
assignee: Arggon
branch: feat/task-handoff-explicit-session-surrogate
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T21:03:59.150Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-handoff-explicit-session-surrogate
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-handoff-explicit-session-surrogate.md
  Leaves live only under a story. id is the filename stem: task-handoff-explicit-session-surrogate.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# handoff explicit --session cap is not surrogate-safe (astral split + U+FFFD in body)

## Context

F2 from the independent review of PR #349 (`task-opencode2-mcp-nits`), which
made the **meta-derived** session ID surrogate-safe. The explicit path still
uses the code-unit cut: `cli/src/handoff.ts` `capSession` (~:80-88) splits an
astral pair — probe with explicit `session: "😀".repeat(40)`: rendered session
`31×😀 + \ud83d + …` (64 units / 33 points, lone surrogate) and the written body
gains U+FFFD. Pre-existing (not introduced by #349), and explicit values retain
documented kernel semantics — but the fix pattern (`Array.from` back-off) now
exists in `cli/src/mcp-server.ts`.

## Acceptance

- [ ] `capSession` back-off is surrogate-safe (or the residual is explicitly
      documented with rationale); tests with astral/lone-surrogate explicit
      values assert no lone surrogate and no U+FFFD in the rendered value/body.
- [ ] Explicit non-empty precedence and the 64-cap semantics unchanged.
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Only matters for IDs that are not ASCII; OpenCode V2 IDs are `ses_…` ASCII.

### 2026-09-18 @Arggon
Worker evidence — draft PR #353 (feat/task-handoff-explicit-session-surrogate). STOP: no merge, no status flip.

1. `capSession` (cli/src/handoff.ts) is surrogate-safe: the 64-unit cut backs off one unit when it would land inside a surrogate pair (same pattern as `normalizeSessionID`, #349), and lone surrogates already present in the explicit value are dropped before capping — they cannot round-trip through the UTF-8 body write (the write emits U+FFFD); dropping keeps every valid code point the caller sent, and a value left empty by the drop counts as absent (like `normalizeSessionID`'s normalize-to-empty). Explicit non-empty precedence and the 64-cap semantics unchanged; no schema/envelope changes.
2. Tests (cli/src/handoff.test.ts): 3 new tests fail on the pre-fix source (3 failed / 17 passed) and pass with the fix (20/20) — astral 40xU+1F600 -> 31xU+1F600 + … (63 units / 32 code points), boundary pin for a pair at units 62-63, and lone-surrogate explicit values (mid high/low, lone ahead of a cut pair, lone inside an over-cap value, lone-only -> absent).

Evidence (real runHandoff, temp repo):

- astral: before 64 units / 33 points, lone surrogate in rendered, U+FFFD in body; after 63 units / 32 points, no lone surrogate, no U+FFFD.
- `"a".repeat(62) + "😀" + "x".repeat(10)`: before lone surrogate + body U+FFFD; after 62x`a` + `…`, clean.
- `ses_high<lone-high>more` -> `ses_highmore`; `ses_low<lone-low>more` -> `ses_lowmore`; lone-only values -> session omitted (no placeholder); both cases clean on disk (no lone surrogate, no U+FFFD).
- ASCII unchanged: `"s".repeat(70)` -> 63x`s` + `…` in both.

Gates post origin/opencode2 merge (bfd59cd): build ok; `npm test` 73 files / 1218 passed; lint clean; `arggon validate` ok (0 warnings); `arggon spec validate` ok (0 warnings).

Files: cli/src/handoff.ts, cli/src/handoff.test.ts (+ this tracker comment). No `comment.ts`/`comment.test.ts` change needed (shared body path untouched); no docs edit needed (user-visible contract unchanged; `docs/agents.md` §MCP server delimiter note concerns the meta path only).

### handoff 2026-09-18 @Arggon (session: ses_f49aac31cffelLHTjOh43g0tv9) — next: Review draft PR #353 (evidence in the comment above); if gates and review are green, merge to opencode2 and flip the item to done — reviewer owns merge and status.
- branch: feat/task-handoff-explicit-session-surrogate
- open questions: mid-value lone surrogates are dropped (not cut at the first one, as the meta path does) to keep the caller's valid code points — flag if meta-path consistency is preferred; docs unchanged because the…
