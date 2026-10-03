---
type: task
status: todo
id: task-release-pipeline-baseline-new-collisions
title: "`story-release-pipeline` baseline reads the 5 new duplicate-doc-number findings as NEW, so its next `--baseline` wave would exit 1"
parent: story-release-pipeline
labels: [spec-pipeline]
created: "2026-10-03"
updated: "2026-10-03"
depends_on: [task-renumber-colliding-doc-numbers]
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-release-pipeline-baseline-new-collisions.md
  Leaves live only under a story. id is the filename stem: task-release-pipeline-baseline-new-collisions.
  CLI `arggon create task release-pipeline-baseline-new-collisions` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `story-release-pipeline` baseline reads the 5 new duplicate-doc-number findings as NEW, so its next `--baseline` wave would exit 1

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Knock-on of PR #603 (bug-spec-analyze-does-not-detect-duplicate-doc-numbers), found by that PR's worker and confirmed by its reviewer, 2026-10-03.

**TWO committed baselines read the five new duplicate-doc-number findings as NEW**, so both `--baseline` wave gates would exit 1 on pre-existing findings rather than regressions:
1. `story-release-pipeline`'s own baseline, `spec-analyze-baseline-release-pipeline-015.json`
2. **the repo-root baseline `ArggonManager/spec-analyze-baseline.json`** — the reviewer's correction; the PR and its follow-up item named only the first

Both PR #603's worker and its reviewer left them untouched, for the same sound reason: refreshing a baseline erases the record that findings existed. The recorded lesson (PR #599) is exactly this — `findingKey` embeds the age, so baselining away a finding hides it rather than closing it. That call belongs here, not in either PR.

Acceptance:
- [ ] Decide: re-baseline AFTER the corpus renumber lands (preferred — the findings become resolved rather than baselined away), or pin `--no-fail-on-new` for the affected runs with a recorded reason
- [ ] If re-baselined: the commit message names which findings were baselined and why, so a future reader can tell a real regression from a known-clean state
- [ ] Both baselines are handled, not just the story-scoped one
- [ ] Never a blanket refresh: `agents.md` documents `--baseline` as the NEW-findings wave gate
- [ ] Depends on task-renumber-colliding-doc-numbers, not on the detector landing
