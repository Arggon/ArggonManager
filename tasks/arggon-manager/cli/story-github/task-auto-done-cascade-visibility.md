---
type: task
status: in_progress
id: task-auto-done-cascade-visibility
title: "auto-done bot: cascade result invisible; cascade skipped story-cli-ergonomics though conditions were met"
assignee: Arggon
parent: story-github
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T19:16:55.703Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/task-auto-done-cascade-visibility.md
  Leaves live only under a story. id is the filename stem: task-auto-done-cascade-visibility.
  CLI `arggon create task auto-done-cascade-visibility` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# auto-done bot: cascade result invisible; cascade skipped story-cli-ergonomics though conditions were met

## Context

Found 2026-09-14 closing the 12-item wave. When PR #165 (the last leaf of
story-cli-ergonomics) merged, its auto-done flip (#172) landed
`task-update-reparent: done` but did NOT cascade-complete
`story-cli-ergonomics` — although every condition was met on the flip tree:
all three leaves terminal, the story's 3 acceptance boxes ticked on main
before the merge. The story had to be completed by hand (claim + done).

Two problems:
1. The workflow discards the update output (`update "$id" --status done --json > /dev/null`),
   so `autoCompleted` / `cascadeSkipped` are invisible in the run log — no
   post-hoc diagnosis is possible.
2. The cascade skip itself is unexplained (the only documented skip reason is
   acceptance-incomplete, which did not apply).

## Acceptance

- [ ] The workflow logs the update result per id (at minimum autoCompleted + cascadeSkipped) instead of discarding it
- [ ] Root cause of the missed cascade identified and fixed or documented (repro: flip a last leaf whose container has ticked boxes and terminal siblings)

## Notes
