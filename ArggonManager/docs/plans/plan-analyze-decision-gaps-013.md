---
plan_id: analyze-decision-gaps-013
title: Plan for analyze decision gaps
spec: ArggonManager/docs/specs/spec-analyze-decision-gaps-013.md
status: implemented
created: 2026-09-29
---

# Plan: analyze decision gaps (analyze-decision-gaps-013)

Derived from `ArggonManager/docs/specs/spec-analyze-decision-gaps-013.md`. Each task carries a
verifiable acceptance criterion and links back to the spec.

## Tasks

### T1: Decision-gap scanners in cli/src/spec.ts

- Add `DECISION_PENDING_DAYS = 7` / `STALE_PROPOSED_DAYS = 14` constants, the
  exported pure helpers (`parseAdrStatusAndDate`, `decisionSectionAdrRef`,
  `ageDaysFromTodayUtc`), and `decisionFindings(root)` implementing the three
  finding kinds per the spec; add the additive `decisions` bucket to
  `SpecAnalyzeResult` and `runSpecAnalyze` (corpus mode only).
- **Acceptance:** `runSpecAnalyze` on fixtures flags each of the three kinds
  under its spec trigger and none of the negative cases; pure read (no file
  written).

### T2: CLI wiring (JSON + human + baselines)

- Emit `findings.decisions` at the three `--json` sites (plain, save-baseline,
  compare-baseline); include decisions findings in baseline snapshots; list
  them in `formatSpecAnalyzeHuman`.
- **Acceptance:** `spec analyze --json` on a decision-gap fixture returns exit
  0 with the three kinds present and `schemaVersion` unchanged; human output
  shows the `[KIND]` tags.

### T3: Unit tests

- Parser tests (ADR status/date line, Decision-section ADR reference with and
  without link/placeholder, age boundary at exactly the threshold) plus one
  positive and one negative fixture per finding type, in
  `cli/src/spec-decision-gaps.test.ts` using temp fixtures.
- **Acceptance:** `npm test` green including the new file.

### T4: Docs

- README `spec analyze` paragraph, `ArggonManager/docs/json-output.md` findings
  shape (additive `decisions` bucket), one sentence in
  `ArggonManager/docs/agents.md` §Specs and plans listing the three kinds.
- **Acceptance:** the three kind names appear in each of the three docs.

### T5: Smoke evidence

- Built CLI against a throwaway fixture seeded with all three gap types (all
  three findings present) and a clean fixture (none); run against this repo
  (exploration-007 pending + ADRs 0002/0003/0004 stale Proposed, findings
  only).
- **Acceptance:** expected-vs-observed table recorded in the PR description.
