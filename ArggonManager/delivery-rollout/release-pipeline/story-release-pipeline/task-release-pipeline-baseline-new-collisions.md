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

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q
### 2026-10-06 @arggon-delivery-lead — reproduction on `main`, and a second consequence

The item's title frames this as a **future** wave exiting 1. It is stronger than that: **`main` exits 1 today.**

Reproduction on a clean `main`:

```
$ npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json
5 new, 1 resolved, 5 unchanged, 10 total
real exit code: 1
```

All 5 NEW are `[duplicate-doc-number]`, and they are exactly the 5 pairs this item names:

| doc | collision |
|---|---|
| `exploration-cheap-path-to-prod-001.md` | ↔ `exploration-token-context-efficiency-001.md` |
| `plan-deps-001.md` | ↔ `plan-sync-001.md` |
| `spec-deps-001.md` | ↔ `spec-sync-001.md` |
| `plan-release-pipeline-015.md` | ↔ `plan-update-channel-015.md` |
| `spec-release-pipeline-015.md` | ↔ `spec-update-channel-015.md` |

The same 5 surface as `DOC_NUMBER_COLLISION` warnings from `spec validate`, so the two surfaces agree — this is one defect seen twice, not two defects.

### The second consequence, not recorded here before

This baseline failure is now **blocking an unrelated chain**. The ADR 0017 gate requires zero NEW findings before an implementation task is claimed, so the 5 NEW findings gate `task-friction-capture-command` (T1) in `story-adopter-feedback`, whose own PR #586 merged clean. A `story-release-pipeline` doc-number collision is holding an `adopter-feedback` implementation task hostage, and neither story records the link.

That is the argument for treating this as more than bookkeeping: the baseline is a shared gate, so a stale entry in one story's corpus silently blocks another.

### Acceptance additions

- [ ] `spec analyze --baseline ArggonManager/spec-analyze-baseline.json` exits **0** on a clean `main` — today it exits 1, which is a red gate on the default branch
- [ ] All 5 `duplicate-doc-number` findings are gone (via `task-renumber-colliding-doc-numbers`), not absorbed by re-saving the baseline. Widening the baseline makes the gate green without fixing anything
- [ ] Whether `main` exiting 1 on this lane is surfaced anywhere a human sees before merge. A required-check failure would have caught it; `spec analyze` evidently is not one
- [ ] The cross-story coupling is recorded where it bites: the ADR 0017 zero-NEW gate is global, so any story's stale baseline entry blocks any other story's implementation tasks
- [ ] If re-saving the baseline is ever chosen, record the decision and its reason — the current temptation is to make the gate green by widening the net
