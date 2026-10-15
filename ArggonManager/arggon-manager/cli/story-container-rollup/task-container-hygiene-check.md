---
type: task
status: in_progress
id: task-container-hygiene-check
title: "Report-only check: a terminal container holding an open container (the 2026-10-14 reopen guard)"
assignee: arggon-delivery-lead
branch: feat/task-container-hygiene-check
parent: story-container-rollup
labels: []
created: "2026-10-15"
updated: "2026-10-15"
claimed_at: "2026-10-15T00:03:28.353Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-container-hygiene-check
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-container-rollup/task-container-hygiene-check.md
  Leaves live only under a story. id is the filename stem: task-container-hygiene-check.
  CLI `arggon create task container-hygiene-check` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Report-only check: a terminal container holding an open container (the 2026-10-14 reopen guard)

## Context

The 2026-10-14 reopen (`task-container-status-vs-open-workstreams`) established the practice:
a container holding an unfinished workstream must not stay terminal. The owner corrected five
containers by hand because nothing reports the state — it accumulates silently (15 of 84
containers were terminal with open descendants; 5 held open _stories_). This task adds the
report-only check the brief promised, so the next occurrence is visible instead of surprising
the product owner on the board.

## Acceptance

- [x] `arggon report` carries an additive `hygiene` section (human + `--json`): terminal containers (`done`/`cancelled`) whose subtree contains a non-terminal container (story/epic), with the offenders listed and bounded like the other report caps — report-only, exit 0, no gate and no `validate` change
- [x] Leaves-only follow-ups (an open bug/task under a closed story) are NOT flagged — that is the documented follow-up pattern; only open _containers_ count
- [x] `--json` shape documented in `ArggonManager/docs/json-output.md`; human + JSON parity pinned; a fixture covers: terminal container with an open story → flagged; terminal container with only open leaves → not flagged; open container with an open story → not flagged
- [x] `arggon validate`, the full suite, lint, structure and prettier green

## Notes

- Surface: `arggon report` is the preferred home (tracker-state surface, already runs at wave
  ends); if its shape fights this, `doctor` is the alternative — record the choice.
- Report-only first (the house style): no CI wiring in this task; promoting the check into a
  gate or an automation is a later decision.
- Today's tree should report zero offenders (the five were reopened); the fixture carries the
  positive cases.

## Notes
