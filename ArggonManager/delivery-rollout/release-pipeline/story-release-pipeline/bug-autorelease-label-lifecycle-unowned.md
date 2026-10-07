---
type: bug
status: todo
id: bug-autorelease-label-lifecycle-unowned
title: "The `autorelease` label lifecycle is load-bearing and owned by nobody: release-please needs `autorelease: pending` → `tagged`, but it only flips the label when ITS tagging path runs, and this repo tags in `release.yml` — a permanent deadlock by construction, documented nowhere"
parent: story-release-pipeline
labels: [release, docs, methodology]
created: "2026-10-07"
updated: "2026-10-07"
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-autorelease-label-lifecycle-unowned.md
  Leaves live only under a story. id is the filename stem: bug-autorelease-label-lifecycle-unowned.
  CLI `arggon create bug autorelease-label-lifecycle-unowned` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The `autorelease` label lifecycle is load-bearing and owned by nobody: release-please needs `autorelease: pending` → `tagged`, but it only flips the label when ITS tagging path runs, and this repo tags in `release.yml` — a permanent deadlock by construction, documented nowhere

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
