---
type: task
status: todo
id: task-ci-shard-wall-measure
title: Measure the 4-core shard wall times for the vitest suite (one throwaway CI run)
parent: story-ci-wall-clock
labels: [ci, tooling]
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-ci-wall-clock/task-ci-shard-wall-measure.md
  Leaves live only under a story. id is the filename stem: task-ci-shard-wall-measure.
  CLI `arggon create task ci-shard-wall-measure` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Measure the 4-core shard wall times for the vitest suite (one throwaway CI run)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef26e3a0dffeCrCyR7114VVZ2H
## Context

ADR 0023 step 2 (duration-aware sharding) fixes its shard count only after a real measurement. The exploration's numbers came from a **12-core** local machine; the CI runner is **4 CPU** (`ubuntu-latest`). Ratios transfer, absolute seconds do not.

Local baseline for comparison: full suite 86.6s; `--shard=i/4` walls were 20s / 57s / 29s / 36s.

Also needed: the per-file durations measured **on 4 cores**, because the local set put `cli/src/worktree.test.ts` at 55.7-83.4s depending on contention. That single file is the floor every shard assignment hits, so its real CI duration determines whether sharding pays at all.

Refs: `ArggonManager/docs/explorations/exploration-ci-pipeline-wall-clock-022.md`, ADR 0023.

## Acceptance

- [ ] One throwaway CI run executes the suite sharded (e.g. `--shard=i/4`) **and** unsharded, and both numbers are recorded here with the run URL.
- [ ] Per-file durations are captured from that run's JSON reporter output, not estimated.
- [ ] The measured 4-core `worktree.test.ts` duration is stated explicitly — this is the floor for any shard assignment.
- [ ] The recorded numbers state the **recommended shard count** for ADR 0023 step 2, or state that sharding does not pay and the ADR step should be dropped.
- [ ] Nothing in the merged `main` tree changes: this is a measurement, and the throwaway workflow is removed in the same PR that records the numbers.

## Notes

Do not remove `npm run build` before the test step to make the run faster — CI needs the build, and the suite fails against a stale `lib/dist` (tracked as `bug-test-suite-lib-dist-rebuild-race`).
