---
type: task
status: in_progress
id: task-handoff-field-cap-surrogate
title: "handoff capField surrogate-safety: astral pairs split at the 199/200 boundary (U+FFFD on disk)"
assignee: Arggon
branch: feat/task-handoff-field-cap-surrogate
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T21:42:19.079Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-handoff-field-cap-surrogate
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-handoff-field-cap-surrogate.md
  Leaves live only under a story. id is the filename stem: task-handoff-field-cap-surrogate.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# handoff capField surrogate-safety: astral pairs split at the 199/200 boundary (U+FFFD on disk)

## Context

F1 from the independent review of PR #353 (`task-handoff-explicit-session-surrogate`),
which fixed `capSession` but not its sibling. `capField`
(`cli/src/handoff.ts:67-77`) is still a raw code-unit cut at
`HANDOFF_FIELD_CAP` for `next` / `branch` / `openQuestions`: an astral pair
straddling the 199/200-unit boundary manufactures a lone surrogate that becomes
U+FFFD on disk. Repro (real `runHandoff`, on-disk read):
`next = "x".repeat(198) + "😀" + "y".repeat(10)` → rendered 200 units with a
lone surrogate in the tail and U+FFFD in the body.

## Acceptance

- [ ] `capField` gets the same surrogate-safe treatment as `capSession`
      (back-off at the cut; lone surrogates cannot reach the body) — or a shared
      helper serves both.
- [ ] Tests for `next`/`branch`/`openQuestions` with a pair at the boundary;
      ordinary (ASCII/BMP) output byte-identical; no U+FFFD on disk.
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Provenance-only fields; cosmetic/hygiene, no security impact. The fix pattern
  exists in `capSession` and `normalizeSessionID`.
