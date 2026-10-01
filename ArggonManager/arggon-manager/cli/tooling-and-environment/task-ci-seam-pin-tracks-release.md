---
type: task
status: in_progress
id: task-ci-seam-pin-tracks-release
title: "arggon.yml ARGGON_VERSION pin must track the release (derive from package.json, not a literal)"
assignee: Arggon
branch: feat/task-ci-seam-pin-tracks-release
parent: tooling-and-environment
labels: [ci, release]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T14:29:51.698Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-ci-seam-pin-tracks-release
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
