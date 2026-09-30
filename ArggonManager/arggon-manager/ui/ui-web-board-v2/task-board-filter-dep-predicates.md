---
type: task
status: in_progress
id: task-board-filter-dep-predicates
title: "Web board filter: enable parent:, depends-on:, blocked-by: and readiness"
assignee: Arggon
branch: feat/task-board-filter-dep-predicates
parent: ui-web-board-v2
labels: [viewer, board, ui]
priority: p3
created: "2026-09-23"
updated: "2026-09-30"
claimed_at: "2026-09-30T17:01:14.394Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-board-filter-dep-predicates
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-web-board-v2/task-board-filter-dep-predicates.md
  Leaves live only under a story. id is the filename stem: task-board-filter-dep-predicates.
  CLI `arggon create task board-filter-dep-predicates` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Web board filter: enable parent:, depends-on:, blocked-by: and readiness

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-23 @ses_f34ba048bffeDqO6XhG0C62Nw6
## Context

`task-board-filter-lenses` (merged, PR #406) shipped the board lens with a documented v1 exclusion: `parent:`, `depends-on:`, `blocked-by:` and readiness are refused with a pointer to `arggon list --filter`, because the board renders contract items (`depends_on`) while the kernel lens read `dependsOn`. `task-ui-viewmodel-contract-deps` (merged, PR #404) removed that blocker: `applyViewLens`/`readyTodoCount` now accept both shapes (`dependsOn ?? depends_on`, kernel field wins), and the display helper rule is `item.dependsOn ?? item.depends_on ?? []`.

Consumption form (from the merged item): pass contract items straight into `applyViewLens(items, lens)` — `blocked-by:`/`depends-on:` and the `ready` lens read either shape.

## Acceptance

- [x] The board's embedded `applyBoardFilter` mirror drops the v1 refusal for `parent:`, `depends-on:`, `blocked-by:` and the readiness lens, reading contract items (`depends_on`) with the same precedence rule; kernel-only refusal test replaced by a parity case
- [x] `cli/src/board-parity.test.ts` extends the expression table (blocked-by open/closed/unknown dep, depends-on, parent chain, readiness) with 1:1 `runList`/`applyViewLens` proof
- [x] `e2e/board.smoke.spec.ts` gets a dep-predicate case; README board section + `docs/json-output.md` board note updated (remove the "refused" wording)
- [x] Filtered counts/URL state behave like the existing predicates; no `lib/**` change expected (dual shape is already there), no new CLI flags
- [x] Unit + browser smoke evidence in the verdict; `npm test` / lint / build / `validate` green

### 2026-09-30 @Arggon
Verdict (PR #483)

Implemented exactly per the consumption form: the v1 refusal (KERNEL_ONLY_FIELDS) is gone. `applyBoardFilter` now carries `parent:` (exact match, parentless items never match), `depends-on:` (membership), `blocked-by:` (inverse index over the WHOLE input, so a filtered-out dependency can never look unknown) — all reading either dependency shape with the kernel precedence `dependsOn ?? depends_on ?? []` — plus `ready:true`/`ready:false` as the board spelling of the kernel readiness lens (every dep terminal done/cancelled; unknown dep id counts as open, per kernel isReady). The kernel filter language has no ready field, so readiness is pinned against `applyViewLens({ ready: true })` instead of runList; everything else is pinned against `runList --filter` on a real tracker with an open dep (in_progress), a closed dep (done) and an unknown dep (ghost-dep) in the fixture.

Evidence:
- board.test.ts: refusal test replaced by positive kernel-semantics tests incl. a dual-shape precedence case (dependsOn hides the contract dep) and the ready:bogus refusal ('unknown readiness "bogus". Allowed: true, false').
- board-parity.test.ts: parity table grew from 18 to 27 expressions (parent chain, !parent, depends-on +/-, blocked-by open/closed/unknown, ANDed combos); sandbox embedded-vs-TS verdict loop covers all of them + readiness; real-tracker runList parity over the whole table; new applyViewLens readiness proof (ready 4 / not-ready 2 on the fixture, all three dep states exercised).
- e2e @smoke: new 'dependency predicates narrow by deps and readiness' — blocked-by:<open dep> narrows to the detail fixture, ready:false matches exactly it (its other dep is cancelled), URL-hash round-trip after reload. Lane: 20 passed, zero exclusions.
- Real-browser evidence (headless chromium against board --serve on this worktree's 367-item tracker): 'blocked-by:bug-native-start-worktree-no-install' narrows to the same 4 ids runList returns (first card bug-native-cleanup-unverified-worktree-removal); 'ready:true' leaves 367/367 — exactly applyViewLens' count for the same tracker; hash restores after reload. Screenshots taken.
- README + docs/json-output.md refusal wording removed; filter placeholder lists the new fields.

Gates (after merging origin/main 624a4259): npm test 1834 passed / 107 files; lint clean; build green; check:plugin green; arggon validate ok; playwright @smoke 20 passed.
