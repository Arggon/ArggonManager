---
type: task
status: todo
id: task-ci-seam-pin-tracks-release
title: "arggon.yml ARGGON_VERSION pin must track the release (derive from package.json, not a literal)"
parent: tooling-and-environment
labels: [ci, release]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/task-ci-seam-pin-tracks-release.md
  Leaves live only under a story. id is the filename stem: task-ci-seam-pin-tracks-release.
  CLI `arggon create task ci-seam-pin-tracks-release` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon.yml ARGGON_VERSION pin must track the release (derive from package.json, not a literal)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the #527 review: publishing 0.4.1 + regenerating the seam with 0.4.1 turned tasks-validate red on main because .github/workflows/arggon.yml pins ARGGON_VERSION as a literal 0.4.0. The manual re-pin is release-runbook step now documented in release.md; this item removes the foot-gun: derive the pin from the root package.json version (or a workflow-level env referenced from package.json), so publishing and pinning cannot diverge. Acceptance: pin derived/automated, a test or CI check that fails when the pin lags the shipped version, runbook updated.

### 2026-10-01 @ses_f0870e73affeEVvaFZPi9K7NDj
Scheduled as wave-1 work under the ADR 0018 rollout (initiative delivery-rollout): this item is now a gate for task-release-workflow — the seam pin must be derived (not literal) when release.yml lands.

Scope notes for the claiming agent: the fix targets THIS repo's committed .github/workflows/arggon.yml (derive ARGGON_VERSION from the root package.json at run time, e.g. node -p "require('./package.json').version"); the shipped adopter template (templates/docs/github/workflows/arggon.yml) keeps its literal pin by design — adopters pin deliberately and the drift gate couples the pin to their committed seam. The release.md re-pin step this item's Context mentions should end up removed/superseded when task-release-workflow shrinks the runbook — coordinate via the item, both edits name this file in different PRs.
