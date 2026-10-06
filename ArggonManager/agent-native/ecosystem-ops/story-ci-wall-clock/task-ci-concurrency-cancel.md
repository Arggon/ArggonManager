---
type: task
status: todo
id: task-ci-concurrency-cancel
title: Add concurrency groups with cancel-in-progress to the PR-triggered workflows
parent: story-ci-wall-clock
labels: [ci]
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-ci-wall-clock/task-ci-concurrency-cancel.md
  Leaves live only under a story. id is the filename stem: task-ci-concurrency-cancel.
  CLI `arggon create task ci-concurrency-cancel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Add concurrency groups with cancel-in-progress to the PR-triggered workflows

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef26e3a0dffeCrCyR7114VVZ2H
## Context

ADR 0023 step 1 — the cheapest win, independent of everything else.

No workflow in this repo declares a `concurrency:` block. Over the last 60 CI runs, three branches ran CI 4x, 4x, 2x. Every push while a run is in flight queues **another full ~350s run**, and without `cancel-in-progress` the superseded run still consumes a runner to completion and still posts a check on a stale SHA.

Keyed on **PR number**, not `github.ref`: the documented `ci-${{ github.ref }}` pattern would let two open PRs cancel each other, which is a real hazard on a repo with several concurrent feature branches.

Refs: `ArggonManager/docs/explorations/exploration-ci-pipeline-wall-clock-022.md`, ADR 0023.

## Acceptance

- [ ] A `concurrency:` stanza is added to the PR-triggered workflow(s) with `group: ci-${{ github.event.pull_request.number || github.ref }}` and `cancel-in-progress: true`.
- [ ] The group key does **not** combine `queue: max` with `cancel-in-progress` (that is a workflow validation error and would fail the workflow).
- [ ] Verified by pushing two commits in quick succession to one PR: the older run is cancelled, the newer one completes, and the PR shows exactly one live check.
- [ ] Verified that two **different** open PRs running simultaneously do **not** cancel each other.
- [ ] `auto-done.yml` is unaffected (it triggers on `pull_request: closed`, a different event) and the flip flow still lands — assert, do not assume.

## Notes

Push-to-main runs are deliberately left ungrouped in this item: `release`, `release-please` and `auto-done` all fire on `push: main` with ordering dependencies (ADR 0018's C3 predicate compares against the parent commit; auto-done re-checks out `main`). Canceling those is a release-story decision, not a speed fix.
