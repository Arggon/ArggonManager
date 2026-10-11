---
type: task
status: in_progress
id: task-ci-required-check-missing-spec-analyze-baseline
title: No required check runs `spec analyze --baseline` — main exited 1 on the shared ADR 0017 lane for 5 days with zero human-visible signal before merge
assignee: arggon-delivery-lead
branch: feat/task-ci-required-check-missing-spec-analyze-baseline
parent: ci-stability
labels: [ci, spec-pipeline]
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T09:28:38.435Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-ci-required-check-missing-spec-analyze-baseline
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-ci-required-check-missing-spec-analyze-baseline.md
  Leaves live only under a story. id is the filename stem: task-ci-required-check-missing-spec-analyze-baseline.
  CLI `arggon create task ci-required-check-missing-spec-analyze-baseline` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# No required check runs `spec analyze --baseline` — main exited 1 on the shared ADR 0017 lane for 5 days with zero human-visible signal before merge

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context.** Recorded by the baseline re-save maker (PR #690): `spec analyze` appears in no workflow (grep over .github/ is empty), there is no pre-commit hook, and the only required check on main is `cli` — which does not run it. So the repo-root baseline lane (the shared ADR 0017 zero-NEW gate) exited 1 on main from 2026-10-06 to 2026-10-11 and the only thing that noticed was a manual reproduction in a work-item comment. This is the "surfaced anywhere a human sees before merge" box of task-release-pipeline-baseline-new-collisions, answered: no.

The renumber item's box 5 deliberately deferred making the duplicate-doc-number finding blocking in ITS PR ("land the gate after the corpus is clean") — the corpus is clean now (0 new on both baselines, PR #690), so landing the gate is the follow-through, not a violation of that call.

Acceptance:
- [ ] A blocking step in the already-required `cli` job of .github/workflows/ci.yml runs `npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json` (the repo-root gate; the release-pipeline-scoped baseline belongs to that story's lane if at all — decide and record why, don't wire both blind)
- [ ] The step is verified to bite: a deliberately-removed baseline entry (or a fresh no-error-path style finding) fails the job in a test PR — evidence pasted in the PR description
- [ ] Verify the gate uses THIS checkout's build (the released-bin validate job cannot gate detector changes — record why the cli job is the right home)
- [ ] No other workflow behavior changed; `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green
- [ ] Record on the item what the gate should do when a finding is genuinely pre-existing (the --no-fail-on-new escape needs a recorded reason per the baseline item's rule)
