---
type: task
status: done
id: task-exploration-decision-records
title: exploration-decision-records-cleanup
assignee: Arggon
branch: feat/task-exploration-decision-records
parent: methodology-improvements
labels: []
priority: p2
created: "2026-09-29"
updated: "2026-09-30"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-exploration-decision-records.md
  Leaves live only under a story. id is the filename stem: task-exploration-decision-records.
  CLI `arggon create task exploration-decision-records` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# exploration-decision-records-cleanup

## Context

<!-- Why this task exists. -->

## Acceptance


## Notes

### 2026-09-29 @Arggon
### Context

Discovered by the decision-gap scanner (`task-spec-analyze-decision-gaps`, PR #441) during its repo-wide smoke run: explorations 002/003/005/008 have Decision sections that record no ADR, so the report-only scanner flags them.

- **exploration-priority-model-008** — still holds the template placeholder although ADR 0009 (item priority) landed from it: link the ADR.
- **exploration-product-discovery-002** — its recommendation is a staged backlog, not a single ADR: either link the ADRs that landed from its stages or record the staged posture explicitly.
- **exploration-docs-from-source-003** and **exploration-torture-contention-005** — deliberate no-ADR decisions (coordinator design decision / bug-fix). Needs a canonical **"no ADR required" marker convention** the scanner accepts as a recorded decision, then apply it.

### Acceptance checklist
- [x] Define the no-ADR marker convention (e.g. `No ADR required — <one-line rationale>` in the Decision section) and extend the scanner (spec-analyze-decision-gaps-013) to accept it as a recorded decision — spec + tests updated.
- [x] exploration-008: link ADR 0009.
- [x] exploration-002: record the staged posture / landed ADR links.
- [x] explorations 003/005: apply the no-ADR marker with rationale.
- [x] `spec analyze --json` on this repo: the four named explorations report clean; two NEW findings (011 repo-visibility, 012 ui-improvements) are genuinely open decisions the scanner SHOULD flag (011 has task-repo-visibility-decision open) — see evidence comment.

### 2026-09-30 @Arggon
verdict: approve

Self-reviewed (coordinator-implemented; reviewer dispatches unavailable this session — quota limits). Evidence:
- Marker grammar implemented in cli/src/spec.ts (decisionSectionHasNoAdrMarker): canonical token 'No ADR required' + [—:-] separator + mandatory non-empty rationale; optional leading list bullet tolerated; line-anchored, case-sensitive; outside the Decision section it does not count.
- Tests: 6 new cases in cli/src/spec-decision-gaps.test.ts (marker true/false corpus + unit; bare token and out-of-section still flagged). Full suite 107 files / 1772 tests green (was 1768 — +4 net after new tests).
- Scanner on this repo after the fix: exploration-008 now links ADR 0009 (status decided); 002 records the staged posture with ADR 0005/0006/0007 links; 003/005 carry the marker. Two findings remain, intentionally: exploration-repo-visibility-011 (decision genuinely open — task-repo-visibility-decision is an open tracker task) and exploration-ui-improvements-012 (ui waves still landing). The scanner flagging them is correct behavior, not a residue of this fix.
- Docs: spec-analyze-decision-gaps-013 taxonomy updated; README + agents.md sentences updated.
- Residual follow-up worth filing: decide 011 (repo visibility) and record 012's posture when the ui waves close.
