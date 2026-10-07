---
type: bug
status: todo
id: bug-seam-bundle-stale-snapshot-gate
title: "The native seam loads the kernel bundle ONCE at session start and never re-checks it, so a stale copy silently serves the done gate for the whole session — `doctor` detects it but nothing prompts it, and nothing can repair a loaded catalog"
parent: tooling-and-environment
labels: [native-seam, parity, done-gate]
created: "2026-10-07"
updated: "2026-10-07"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-seam-bundle-stale-snapshot-gate.md
  Leaves live only under a story. id is the filename stem: bug-seam-bundle-stale-snapshot-gate.
  CLI `arggon create bug seam-bundle-stale-snapshot-gate` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The native seam loads the kernel bundle ONCE at session start and never re-checks it, so a stale copy silently serves the done gate for the whole session — `doctor` detects it but nothing prompts it, and nothing can repair a loaded catalog

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
