---
type: task
status: done
id: task-spec-analyze-decision-gaps
title: spec-analyze-decision-gaps
assignee: Arggon
branch: feat/task-spec-analyze-decision-gaps
parent: methodology-improvements
labels: []
priority: p1
created: "2026-09-29"
updated: "2026-09-30"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-spec-analyze-decision-gaps.md
  Leaves live only under a story. id is the filename stem: task-spec-analyze-decision-gaps.
  CLI `arggon create task spec-analyze-decision-gaps` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec-analyze-decision-gaps

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-29 @Arggon
### Context — C3 (exploration-methodology-improvements-014)

Extend the **report-only** `arggon spec analyze` with decision-pipeline gap findings. Same contract as existing analyze findings: never edits, exit 0 with findings.

Findings to add:
- **DECISION-PENDING-EXPLORATION** — exploration in `ArggonManager/docs/explorations/` whose `## Decision` section contains no link to `docs/adr/*.md` (template placeholder or bare comment) and whose `created` date is older than a documented staleness threshold.
- **STALE-PROPOSED-ADR** — ADR in `ArggonManager/docs/adr/` whose `- Status:` line is `Proposed` and whose Date is older than a documented threshold.
- **SPEC-STATUS-DRIFT** — spec with `status: proposed` whose linked plan (plan frontmatter `spec:` matching the spec id) has `status: implemented`.

Thresholds as documented constants (pick sensible defaults, e.g. 30d explorations / 90d ADRs; no new flags unless trivial). Verification before opening the PR: the scanner run against **this repo** must flag exploration-007's pending decision and ADRs 0002/0003/0004 (findings only — do not fix them in this PR).

### Acceptance checklist
- [x] Spec first: scaffold `docs/specs/spec-analyze-decision-gaps-*.md` (`arggon spec new analyze-decision-gaps --plan`), purpose/finding taxonomy/thresholds/invariants (report-only, exit 0)/acceptance criteria; flip spec+plan status to `implemented` in this PR.
- [x] `spec analyze --json` emits the three finding types (file + reason), additive to the envelope (schemaVersion unchanged unless breaking).
- [x] Unit tests: ADR status-line parser, exploration Decision-link parser, plan↔spec drift; positive+negative fixture per finding type.
- [x] Human output lists findings; docs updated: README spec-analyze section, `ArggonManager/docs/json-output.md`, `ArggonManager/docs/agents.md` §Specs and plans mention.
- [x] Smoke evidence: `spec analyze` on a fixture seeded with all three gap types (expected vs observed) + on this repo (findings above present).
- [x] Full suite + lint/typecheck green; `arggon validate` ok.
- [x] Note: `task-done-gate-acceptance-waiver` also touches README + json-output.md — rebase on main before opening the PR if it merged first.

### 2026-09-29 @Arggon
Evidence (implementation complete, review-ready):

- Spec/plan: spec-analyze-decision-gaps-013 + plan-analyze-decision-gaps-013, both flipped to implemented in this PR. Thresholds are documented constants DECISION_PENDING_DAYS=7 / STALE_PROPOSED_DAYS=14 (cli/src/spec.ts) — NOT the 30d/90d example from the context: 30d/90d would flag nothing in this repo today (exploration-007 is 13d old, ADRs 0002/0003/0004 are 22d/18d/18d), and the item requires those findings. A finding fires only when ageDays > threshold (exactly-threshold is clean); ages are whole days to today UTC.
- Envelope: findings.decisions is additive, schemaVersion stays 1; baselines include decisions in the flat findings array; decision pass skipped with --spec.
- Tests: new cli/src/spec-decision-gaps.test.ts (20 tests: parsers + positive/negative fixture per kind + threshold boundary + never-writes + CLI --json/human contract). Full suite 1740/1740 green, eslint green, npm run build green, arggon validate ok:true.
- Smoke, seeded fixture (/tmp/fixture-c3): all three kinds emitted, exit 0; clean fixture: decisions [].
- Smoke, this repo: flagged exploration-adopter-upgrade-experience-007 (DECISION-PENDING-EXPLORATION, line 100) and ADRs 0002/0003/0004 (STALE-PROPOSED-ADR, line 3 each). Additional honest findings the detector surfaced (report-only; owned by other tasks): explorations 002/003/005/008 pending (008's Decision still holds the placeholder although ADR 0009 landed; 003/005 record a deliberate no-ADR decision, which the contract still reports as a gap). No SPEC-STATUS-DRIFT instance in this repo (spec-zcode-native-seam-012 and its plan are both proposed).
- Deviation note: kind strings use the exact uppercase names from the work order (DECISION-PENDING-EXPLORATION / STALE-PROPOSED-ADR / SPEC-STATUS-DRIFT), unlike the lowercase kebab kinds of spec-analyze-004; kind is opaque in the contract and baselines sort deterministically.
- Overlap check: PR #442 (task-done-gate-acceptance-waiver, README + json-output.md) is still open, so no rebase was needed; if it merges first, rebase before ready — different sentences/rows, conflict unlikely.

### handoff 2026-09-29 @Arggon — next: Coordinator review of PR #441 (ready): decisions bucket + 3 finding kinds, evidence on item + PR body. After merge: file follow-up tasks for the repo's own flagged decisions (explorations 002/003/005…
- branch: feat/task-spec-analyze-decision-gaps
- open questions: Thresholds 7d/14d deviate from the 30d/90d example (required for this repo's smoke); uppercase kind strings per work order
