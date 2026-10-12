---
type: bug
status: todo
id: bug-release-lockfile-sync-step-cannot-run
title: "release-please.yml's lockfile-sync step fails: `npm install --package-lock-only` runs the root `prepare` -> `npm run build` -> TS2591 on the runner (no node_modules) - the run is red and the #1993 lockfile reconciliation never happens"
parent: story-release-pipeline
labels: [release, ci, failure-mode, gate-fidelity]
created: "2026-10-12"
updated: "2026-10-12"
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-release-lockfile-sync-step-cannot-run.md
  Leaves live only under a story. id is the filename stem: bug-release-lockfile-sync-step-cannot-run.
  CLI `arggon create bug release-lockfile-sync-step-cannot-run` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# release-please.yml's lockfile-sync step fails: `npm install --package-lock-only` runs the root `prepare` -> `npm run build` -> TS2591 on the runner (no node_modules) - the run is red and the #1993 lockfile reconciliation never happens

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
