---
type: task
status: todo
id: task-zcode-automations
title: "ZCode automation templates (spec-drift scan, stale-claim sweep) (plan T5)"
parent: story-zcode-adapter
labels: []
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-adapter-selection-flags, task-capability-matrix]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-zcode-adapter/task-zcode-automations.md
  Leaves live only under a story. id is the filename stem: task-zcode-automations.
  CLI `arggon create task zcode-automations` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ZCode automation templates (spec-drift scan, stale-claim sweep) (plan T5)

## Context

Opt-in automation templates: daily spec-drift scan, weekly stale-claim sweep — read-only or item-filing only

## Acceptance

- [ ] templates carry claim/branch preconditions
- [ ] scans run read-only; findings filed via arggon create
- [ ] documented as opt-in

## Notes

### 2026-10-09 @Arggon
verdict: approve
PR https://github.com/Arggon/ArggonManager/pull/670 merged by the wave runner after a standards-review approve.
Maker summary: CI is now fully green on PR #670 (final SHA 68ce5f70): `gh pr checks 670 --watch` → cli pass (5m56s), tasks-validate pass (28s), ui-smoke pass (1m48s); `gh run list` shows all runs on the head SHA "completed success". This took two real fixes, NOT the flake rerun — neither failure matched the known artifact-drift flake signature (SpawnHarnessError / 'does not provide an export named' from lib/dist in the cli lane), so per the triage rule I fixed and pushed. Failure 1 (tasks-validate, run 37986663136): the drift step's pinned-lag assertion — "ARGGON_VERSION (0.5.0) lags the committed arggon sea
Flip not attempted (acceptance incomplete) — item stays open.
