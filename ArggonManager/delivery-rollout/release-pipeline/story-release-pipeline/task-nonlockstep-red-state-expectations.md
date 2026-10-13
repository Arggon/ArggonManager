---
type: task
status: todo
id: task-nonlockstep-red-state-expectations
title: The non-lockstep guard reds on the ordinary between-releases proposal (root-only accumulation) — set the expected reading or pick a softer signal
parent: story-release-pipeline
labels: [release, docs]
created: "2026-10-13"
updated: "2026-10-13"
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-nonlockstep-red-state-expectations.md
  Leaves live only under a story. id is the filename stem: task-nonlockstep-red-state-expectations.
  CLI `arggon create task nonlockstep-red-state-expectations` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The non-lockstep guard reds on the ordinary between-releases proposal (root-only accumulation) — set the expected reading or pick a softer signal

## Context

Observed live on the guard's first day (bug-release-proposal-non-lockstep-undetected, PR #782): the check reds the `release-please.yml` run whenever an OPEN release PR is non-lockstep. With `chore` deliberately releasable (release-please-config.json maps it to the Changed section) and lib bumping only when it has commits, a root-only accumulating proposal is the ORDINARY between-releases state — so the maintenance run reds on every push during that window. Evidence: #770 (root 0.9.0 / lib 0.8.0) was a real catch, acted on (owner Release-As → green → released v0.9.0); #786 (root 0.9.1 / lib 0.9.0), opened right after the release from tracker chores, reds the same way and is expected accumulation. The message ("must not merge") is accurate — merging a non-lockstep proposal wedges the release state — but readers can mistake the red run for a pipeline failure, and an always-red run hides other failures in the same workflow.

## Acceptance

- [ ] `cli/release-lockstep-check.mjs`'s failure message (and the `release.md` section) state the expected reading: between releases, a root-only accumulating proposal is the normal non-lockstep state; the red run means "do not merge this yet — a Release-As decision is pending", not "the pipeline is broken"
- [ ] `release.md` documents the expected red window so a red run on this workflow is not misread
- [ ] decide and record whether the check stays failing (current) or uses a softer signal for the ordinary accumulation case — with the merge-time protection (pre-tag assert) unchanged either way
- [ ] tests updated; `arggon validate` green; PR opened

## Notes
