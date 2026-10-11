---
type: task
status: in_progress
id: task-stale-citations-to-renumbered-doc-stems
title: Residual stale citations to the five renumbered doc stems in other work-item bodies and comment-only code refs
assignee: arggon-delivery-lead
branch: feat/task-stale-citations-to-renumbered-doc-stems
parent: story-spec-pipeline
labels: [spec-pipeline, docs]
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T05:59:51.270Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-stale-citations-to-renumbered-doc-stems
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/task-stale-citations-to-renumbered-doc-stems.md
  Leaves live only under a story. id is the filename stem: task-stale-citations-to-renumbered-doc-stems.
  CLI `arggon create task stale-citations-to-renumbered-doc-stems` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Residual stale citations to the five renumbered doc stems in other work-item bodies and comment-only code refs

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** Task-renumber-colliding-doc-numbers (PR #680) renamed 5 documents and updated 6 citation files, but ~40 files across the repo cited those stems. The residual stale references sit in files the renumber's own acceptance barred ("do not touch other work items' files"): other tracker work-item bodies, and comment-only code refs flagged by the renumber maker: `board`/`filter`/`list`/`next` tests, `cli/src/commands/next.ts:32`, `cli/src/commands/spec.ts:309`, and `adopt.test.ts` fixtures. The 5 old stems now dangling: `exploration-cheap-path-to-prod-001`, `spec-deps-001`, `plan-deps-001`, `spec-update-channel-015`, `plan-update-channel-015`.

**Why now.** A dangling citation in a work-item body is future-friction fuel — the exact defect class this repo's reverse-feedback channel exists to capture. Cheap to fix while the rename is fresh.

Acceptance:
- [ ] Every file under `ArggonManager/` (tracker item bodies) and `cli/` that references one of the 5 old stems is updated to the renamed target, or recorded as harmless fixture data with a reason (fixtures that never assert on the stem)
- [ ] The renamed targets are the ones that landed: exploration-cheap-path-to-prod-026.md, spec-deps-022.md, plan-deps-019.md, spec-update-channel-023.md, plan-update-channel-020.md
- [ ] Baseline JSONs are NOT touched (owned by task-release-pipeline-baseline-new-collisions)
- [ ] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok
- [ ] Verification evidence (grep counts before → after, per stem) committed as a comment on this item
