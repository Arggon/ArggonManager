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
