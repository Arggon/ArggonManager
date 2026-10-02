---
type: task
status: in_progress
id: task-adopt-050-seam-repin
title: "Adopt 0.5.0 on this machine: re-pin the seam checks and regenerate the vendored seam with the released version"
assignee: Arggon
branch: feat/task-adopt-050-seam-repin
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [release, seam]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T12:31:30.743Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-adopt-050-seam-repin
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-adopt-050-seam-repin.md
  Leaves live only under a story. id is the filename stem: task-adopt-050-seam-repin.
  CLI `arggon create task adopt-050-seam-repin` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adopt 0.5.0 on this machine: re-pin the seam checks and regenerate the vendored seam with the released version

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
release.md §"The re-pin (guard-enforced)": after a release, regenerate the seam with the released version (`arggon init`) and move the literal `ARGGON_VERSION` pin in BOTH `templates/docs/github/workflows/arggon.yml` (what adopters vendor) and `.github/workflows/arggon.yml` (this repo's CI) in the SAME PR. `cli/src/ci-seam-pin.test.ts` enforces the non-divergence: a stale pin is a red test, not a silent outage (the #527 class). The published `arggon-manager@0.5.0` is already installed globally on this machine (`arggon --version` → `0.5.0 (13d72f5f)`), so `init` runs from the released bits, not from source.

## Acceptance
- [ ] `ARGGON_VERSION` is `0.5.0` in both the template and this repo's workflow; `cli/src/ci-seam-pin.test.ts` green.
- [ ] `arggon init` re-run with the released binary: the generated files' `arggonVersion` stamps move to 0.5.0 and the diff is only the expected regeneration (no unrelated churn).
- [ ] `npm run arggon -- validate` ok, prettier clean on the regenerated docs, CI green.
