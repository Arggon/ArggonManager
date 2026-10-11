---
type: task
status: in_progress
id: task-spec-deps-022-no-error-path
title: "spec-deps-022.md publishes no error/failure path — the renumber wave relocated a pre-existing no-error-path finding and main's baseline lane now reads it as NEW"
assignee: arggon-delivery-lead
branch: feat/task-spec-deps-022-no-error-path
parent: story-spec-pipeline
labels: [spec-pipeline, docs]
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T05:59:47.983Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-spec-deps-022-no-error-path
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/task-spec-deps-022-no-error-path.md
  Leaves live only under a story. id is the filename stem: task-spec-deps-022-no-error-path.
  CLI `arggon create task spec-deps-022-no-error-path` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec-deps-022.md publishes no error/failure path — the renumber wave relocated a pre-existing no-error-path finding and main's baseline lane now reads it as NEW

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** After the renumber wave landed (PR #680) and the decision-pending fix (PR #679), `spec analyze --baseline ArggonManager/spec-analyze-baseline.json` on clean main reads: **1 new, 2 resolved, 4 unchanged, exit 1**. The single NEW finding is a *relocation*, not a new defect: the same pre-existing `no-error-path` finding recorded against `spec-deps-001.md` (now resolved by the rename) reappears against the renamed `spec-deps-022.md` — the spec still publishes no error/failure path anywhere.

This finding must be FIXED (or explicitly justified as not applicable), not baselined: `task-release-pipeline-baseline-new-collisions` re-saves both baselines after this lands, and its recorded rule is that re-baselining must record a clean state, never hide one.

Acceptance:
- [ ] `spec analyze` (fresh, no --baseline) no longer reports `no-error-path` for `docs/specs/spec-deps-022.md` (before/after evidence in the PR)
- [ ] The fix is a real failure-path section describing the spec's error/failure behavior, OR an explicit, cited justification that the spec's domain has no failure path (check how sibling specs satisfy this rule and match that idiom — do not write theater text)
- [ ] No changes to either baseline JSON (owned by the baseline item) and no renumber-style renames
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok
