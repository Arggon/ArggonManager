---
type: task
status: in_progress
id: task-auto-done-cascade-visibility
title: "auto-done bot: cascade result invisible; cascade skipped story-cli-ergonomics though conditions were met"
assignee: Arggon
branch: feat/task-auto-done-cascade-visibility
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

- [x] The workflow logs the update result per id (at minimum autoCompleted + cascadeSkipped) instead of discarding it
- [x] Root cause of the missed cascade identified and fixed or documented (repro: flip a last leaf whose container has ticked boxes and terminal siblings)

## Notes

### Root cause of the missed cascade on story-cli-ergonomics (2026-09-14)

**Environmental race, not a CLI bug.** Timeline (verified via `gh pr view --json mergedAt`):

- 18:25:25Z — PR #165 (task-update-reparent) merged → auto-done workflow for #165 starts and checks out `ref: main`, pinning main **as of 18:25:25**.
- 18:25:45Z — PR #171 (the bot's flip of task-ancestor-filter, source PR #164) merged into main — 20 seconds TOO LATE for that checkout.
- 18:32:31Z — PR #172 (the bot's flip of task-update-reparent) merged.

So when PR #172's flip ran `update task-update-reparent --status done`, the flip
tree still had `task-ancestor-filter: in_progress` (its done-flip existed only in
PR #171, not on the checked-out main). `autoCompleteAncestors` (cli/src/update.ts)
requires EVERY sibling under the story to be terminal (`subtreeClosed`); the walk
broke at that check and the story was not completed. Acceptance was not the
reason — the story's 3 boxes were ticked on main before the merge.

**CLI exonerated by repro** (temp repo, initiative→epic→story with 3 tasks,
story box ticked, first two leaves flipped done, third leaf flipped via
`update --status done --json`): result `autoCompleted: ["repro-story"]` — the
cascade completes the story exactly as documented.

**Known sharp edge (documented, not changed):** when the walk stops because a
sibling is not terminal, `cascadeSkipped` is EMPTY — only the
`acceptance-incomplete` stop records a reason. With the old workflow this was
fully invisible; with the new logging it shows up as `(cascade: none)`, which is
diagnosable (empty cascade on the last flip ⇒ check sibling flip timing).

### Workflow logging change

`.github/workflows/auto-done.yml` now captures the update JSON and logs, per
flipped id: `"<id> (PR #N): in_progress -> done (cascade: <autoCompleted ids or
none>; skipped: <id>:<reason>, ...)"`. Status gate, error handling and the
land flow are unchanged.
