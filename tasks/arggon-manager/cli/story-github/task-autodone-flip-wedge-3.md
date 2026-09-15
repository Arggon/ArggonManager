---
type: task
status: in_progress
id: task-autodone-flip-wedge-3
title: "auto-done flip wedge 3: comment on flipped item conflicts rebase"
assignee: Arggon
parent: story-github
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T23:34:29.033Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/task-autodone-flip-wedge-3.md
  Leaves live only under a story. id is the filename stem: task-autodone-flip-wedge-3.
  CLI `arggon create task autodone-flip-wedge-3` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# auto-done flip wedge 3: comment on flipped item conflicts rebase

## Context

Third wedge flavor, observed 2026-09-15 (flip PR #262 for task-handoff-provenance...): the coordinator posted the lead-architect review via `arggon comment` on the SAME item whose flip was in flight. The comment auto-commits to main; the flip branch carries that same item file (claim frontmatter + ticks) — so the #240 retry loop's rebase onto fresh main CONFLICTS on the item file, violating its load-bearing assumption ("the flip only touches tasks/, conflicts should be impossible"). The loop warns and abandons; only admin clears it. Extends task-autodone-flip-race (done): that fix handles staleness, not same-file conflicts.

## Acceptance

- [ ] The workflow handles the same-file conflict: on rebase conflict during the retry, REDO the flip on a fresh main checkout instead (delete flip branch, re-run `arggon update <id> --status done` on fresh main — the flip is idempotent from a clean tree — re-post the check, push, merge). Bounded retries as in #240.
- [ ] The retry loop's "conflicts should be impossible" comment corrected: they are possible when the coordinator comments the flipped item mid-flight.
- [ ] Evidence: a simulated same-file main commit during a flip run ends merged (not wedged) — documented repro in the item.

## Notes
