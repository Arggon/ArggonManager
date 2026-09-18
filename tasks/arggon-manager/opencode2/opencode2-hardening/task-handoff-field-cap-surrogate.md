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

- [x] `capField` gets the same surrogate-safe treatment as `capSession`
      (back-off at the cut; lone surrogates cannot reach the body) — or a shared
      helper serves both.
- [x] Tests for `next`/`branch`/`openQuestions` with a pair at the boundary;
      ordinary (ASCII/BMP) output byte-identical; no U+FFFD on disk.
- [x] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Provenance-only fields; cosmetic/hygiene, no security impact. The fix pattern
  exists in `capSession` and `normalizeSessionID`.
- PR: https://github.com/Arggon/ArggonManager/pull/355 (draft).

### 2026-09-18 @Arggon
## capField surrogate-safety — implemented, gates green, draft PR #355

**Fix (cli/src/handoff.ts).** `capField` and `capSession` now share `capUnits(token, cap)`: it drops lone surrogates anywhere in the value first, then caps with a one-unit back-off when the cut would split a valid pair (marker counts against the cap). Policy choice for pre-existing lone surrogates is the same as `capSession` — **drop, not cut**: fields are caller-supplied UTF-16 with no delimiter to sanitize, and dropping preserves every valid code point. A value left empty by the drop counts as absent; for the required `next` this now raises the documented `handoff requires --next` error (previously a lone-surrogate-only value was accepted and written as U+FFFD).

**Repro evidence (real `runHandoff`, on-disk read).** Before → after for `next = "x".repeat(198) + "😀" + "y".repeat(10)` and the same pair-at-199/200 shape in the other two fields:

| field | units | lone surrogate | U+FFFD on disk |
| --- | --- | --- | --- |
| `next` | 200 → 199 | true → false | true → false |
| `branch` (`198×b + 😀 + z…`) | 200 → 199 | true → false | true → false |
| `openQuestions` (`198×q + 😀 + r…`) | 200 → 199 | true → false | true → false |

**Ordinary path byte-identical** (sha256 of appended section, before → after): pair-kept-whole `5b175e11…` = `5b175e11…`; over-cap ASCII `70bcf82e…` = `70bcf82e…`; over-cap BMP `3dc7a502…` = `3dc7a502…`; astral under cap `d480de0a…` = `d480de0a…`. Over-cap ASCII/BMP still renders exactly the legacy `slice(0, 199) + "…"` (200 units).

**Tests** (`cli/src/handoff.test.ts`, +5): boundary for all three fields (pair split, no U+FFFD on disk), pair-kept-whole + astral under cap pin, lone-surrogate drop/absence policy, legacy byte-identity.

**Gates:** full suite 1223/1223 (private TMPDIR), lint, build, `validate` ok, `spec validate` ok.

**Deliverable:** draft PR https://github.com/Arggon/ArggonManager/pull/355 to `opencode2` — only `cli/src/handoff.ts` + `cli/src/handoff.test.ts` + tracker; no merge, no status flip (worker).

### handoff 2026-09-18 @Arggon (session: ses_f4987ad2effd6z23DBBS0MxdV1) — next: Review draft PR #355 (handoff capField surrogate-safety); verify evidence, then merge to opencode2 and flip the item done.
- branch: feat/task-handoff-field-cap-surrogate
