---
type: task
status: todo
id: task-matrix-reaches-adopters
title: "`adapters/capability-matrix.json` never reaches an adopter: it is not in the package `files` (blocked by the tagged-version guard) so `doctor` reports \"not found\" in every adopter tree"
parent: story-capability-matrix
labels: [adopters, packaging]
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-capability-matrix/task-matrix-reaches-adopters.md
  Leaves live only under a story. id is the filename stem: task-matrix-reaches-adopters.
  CLI `arggon create task matrix-reaches-adopters` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `adapters/capability-matrix.json` never reaches an adopter: it is not in the package `files` (blocked by the tagged-version guard) so `doctor` reports "not found" in every adopter tree

## Context

Found while reviewing PR #600 (task-capability-matrix), 2026-10-02 — the worker flagged it as a deliberate trade-off rather than an oversight.

The capability matrix ships as `adapters/capability-matrix.json` in the repo, but `adapters/` is NOT in the root `package.json` `files` list, so it never enters the published tarball. Adding it is a shipping-field change, and `v0.5.0` is already tagged, so the CI version guard ("Fail if package.json version is already tagged") correctly refuses the PR until a release bump. The worker reverted rather than smuggling a version bump.

Consequence: in every ADOPTER tree, `arggon doctor` reports `matrix: not found … report-only`. The feature works for this repo's own development and is invisible to the adopters it was meant to serve — which is the opposite of the point of a capability matrix that reports per-agent methodology coverage.

This is also a sequencing trap for the sibling adapter tasks (T2/T4/T5): any per-agent asset added under `adapters/` inherits this same invisibility until the packaging or init path carries it.

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
