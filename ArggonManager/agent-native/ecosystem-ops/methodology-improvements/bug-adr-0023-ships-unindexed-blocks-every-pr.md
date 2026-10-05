---
type: bug
status: blocked
id: bug-adr-0023-ships-unindexed-blocks-every-pr
title: "ADR 0023 ships unindexed, so `cli/src/adr-index-parity.test.ts` is red on `main` and the `cli` lane fails on every PR regardless of its diff"
assignee: arggon-delivery-lead
parent: methodology-improvements
labels: [docs, adr, ci-blocking, tests]
created: "2026-10-05"
updated: "2026-10-05"
blocked_reason: "The ADR 0023 index row is merged (b2da0329) and `adr-index-parity.test.ts` is 7/7, but acceptance box 4 (\"`npm test` green, so the `cli` lane is honestly green on `main`\") cannot be honestly ticked: `cli/src/headless-ci.test.ts:849` still fails, pre-existing and unrelated, filed as `bug-headless-ci-twin-init-nondeterministic`. Not waivable by an agent (`--waive` is human-only) and not ticked over. Unblocks when that bug is fixed; the substantive work here is already on `main`."
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-adr-0023-ships-unindexed-blocks-every-pr.md
  Leaves live only under a story. id is the filename stem: bug-adr-0023-ships-unindexed-blocks-every-pr.
  CLI `arggon create bug adr-0023-ships-unindexed-blocks-every-pr` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0023 ships unindexed, so `cli/src/adr-index-parity.test.ts` is red on `main` and the `cli` lane fails on every PR regardless of its diff

## Context

ADR 0023 (`0023-ci-wall-clock.md`, `- Status: Proposed`) landed in the ADR directory **without a matching row** in `ArggonManager/docs/adr/README.md`. It is the only ADR in the corpus with zero index rows.

The consequence is out of proportion to the cause: `cli/src/adr-index-parity.test.ts` is part of the `cli` lane's required checks, and its _"indexes every ADR file exactly once (no ADR ships unindexed)"_ case asserts a count of exactly 1 per file. So the `cli` lane is **red on every PR regardless of its diff**, and a green run is impossible to obtain honestly.

Verified on clean `main`, before this fix:

```
$ grep -c "0023" ArggonManager/docs/adr/README.md
0
$ npx vitest run cli/src/adr-index-parity.test.ts
 × indexes every ADR file exactly once (no ADR ships unindexed)
 + "0023-ci-wall-clock.md: 0 index row(s), expected exactly 1"
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

Found by the maker delivering `bug-test-suite-lib-dist-rebuild-race` on 2026-10-05, while running that item's mandatory ≥5-consecutive-green-full-runs check. Every one of its five runs carried **this** single failure and **zero** race-class occurrences — the race it was sent to fix was already gone, and this unrelated red test was hiding behind it. The maker correctly reported it rather than fixing it out of scope.

**Why this is worth more than the flake it was masking:** a permanently-red `cli` lane trains everyone to re-run instead of read, and it hides real failures — which is exactly what happened to the `lib/dist` race this session.

## Acceptance

- [x] ADR 0023 has exactly one index row, and the row's status cell classifies the same way the
      ADR's own `- Status:` line does (`Proposed`)
- [x] `cli/src/adr-index-parity.test.ts` green — all cases, not just the row-count one
- [x] `prettier --check` clean on `ArggonManager/docs/adr/README.md` (the table is column-aligned)
- [ ] `npm test` green, so the `cli` lane is honestly green on `main` and a later red run means
      something — **NOT met, and not mine to tick**: `cli/src/headless-ci.test.ts:849`
      (`packed-bin --json envelopes are byte-identical to the checkout CLI`) still fails on
      `main`. It is pre-existing, unrelated, and filed as `bug-headless-ci-twin-init-nondeterministic`.
      Observed `Test Files 1 failed | 127 passed (128); Tests 1 failed | 2679 passed (2680)` after
      this fix — down from two red tests to one. The ADR parity lane is honestly green; the
      `cli` lane as a whole is not yet.
- [x] The gap that let an ADR ship unindexed is considered: **the parity test already catches
      this exactly**, so the missing step is not detection but the obligation to run the lane
      before declaring an ADR landed. The ADR process (`docs/engineering.md` §ADR process)
      already says a status flip belongs in the same PR; an unindexed ADR is the same class of
      drift. No new hook is proposed — a hook that duplicates a required lane is worse than the
      habit it replaces. Recorded here as the answer rather than left implicit.
- [x] Not bundled with unrelated ADR index work: `task-adr-index-parity-does-not-check-titles`
      (#620) is the product owner's live claim and pins the **Title** column — untouched here,
      deliberately

## Notes

### 2026-10-05 @arggon-delivery-lead
### 2026-10-05 @arggon-delivery-lead
Done inline (doctrine: a one-line doc fix is trivial work, not a maker dispatch — `docs/agents.md` §Orchestration). `b2da0329` adds the ADR 0023 index row on `main`; `adr-index-parity.test.ts` is 7/7.

**Found because a maker refused to tick a box it could not honestly tick.** `bug-test-suite-lib-dist-rebuild-race` requires ≥5 consecutive green full runs; all five carried this one failure and **zero** race-class occurrences — the `lib/dist` race was already gone, and this unrelated red test was masking it. A permanently-red `cli` lane is worse than the flake it hid, because it teaches re-run-instead-of-read.

**Scope note:** `task-adr-index-parity-does-not-check-titles` (#620) is the product owner's live claim and pins the **Title** column; deliberately not touched or bundled.

**Still red on `main`, and therefore not ticked:** `cli/src/headless-ci.test.ts:849` (`packed-bin --json envelopes are byte-identical to the checkout CLI`) — pre-existing, unrelated, filed as `bug-headless-ci-twin-init-nondeterministic`. Observed after this fix: `1 failed | 2679 passed (2680)`, down from two red tests to one. So the `cli` lane is still not honestly green, and PRs will keep red-lining on that one file until it is fixed.
