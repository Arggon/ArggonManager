---
type: bug
status: todo
id: bug-native-steps-truncated-flag-dropped
title: "Native `preparation.steps` silently shortens past MAX_PREP_STEPS: the kernel sets `stepsTruncated` but `boundedPreparation` folds only its own 32-name cap, so the flag never fires on the native seam (the CLI keeps it)"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [native-seam, json-contract]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-native-steps-truncated-flag-dropped.md
  Leaves live only under a story. id is the filename stem: bug-native-steps-truncated-flag-dropped.
  CLI `arggon create bug native-steps-truncated-flag-dropped` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native `preparation.steps` silently shortens past MAX_PREP_STEPS: the kernel sets `stepsTruncated` but `boundedPreparation` folds only its own 32-name cap, so the flag never fires on the native seam (the CLI keeps it)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
