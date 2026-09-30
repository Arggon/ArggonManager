---
type: task
status: in_progress
id: task-exploration-decision-records
title: exploration-decision-records-cleanup
assignee: Arggon
branch: feat/task-exploration-decision-records
parent: methodology-improvements
labels: []
priority: p2
created: "2026-09-29"
updated: "2026-09-30"
claimed_at: "2026-09-30T12:11:42.385Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-exploration-decision-records
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

- [ ] 

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
