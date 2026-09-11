---
type: task
status: in_progress
id: task-auto-done-on-merge
title: Auto-done on merge
assignee: Arggon
branch: feat/task-auto-done-on-merge
parent: story-github
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/task-auto-done-on-merge.md
  Leaves live only under a story. id is the filename stem: task-auto-done-on-merge.
  CLI `arggon create task auto-done-on-merge` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Auto-done on merge

## Context

`arggon start` automates the claim side (in_progress + assignee + branch + PR), but the done side is manual: when a PR referencing an item merges, nothing updates the item, so done items linger as `in_progress` (seen with PR #67 / task-board-drag-drop on 2026-09-11). Track it in-tree per docs/agents.md; GitHub hosts the merge event, so the natural hook is a repo workflow, mirroring how `start` commits the claim automatically.

Design: a GitHub Actions workflow triggered on `pull_request: closed (merged)` that extracts `task-*`/`bug-*` ids from the merged PR title/body, marks claimable leaves `done` through the CLI update path (never raw edits; the CLI enforces transitions), commits the status flips to `main`, and warns (instead of forcing) on items it cannot legally transition (e.g. still `todo`, since todo→done is not a legal v0 transition). Containers (story/epic/initiative) stay manual.

## Acceptance

- [ ] Workflow triggers on merge to `main` and marks referenced `task`/`bug` items `done` via `arggon update`, committing the flip to `main`
- [ ] Already-done/cancelled items and unknown ids are skipped safely; illegal transitions (e.g. `todo` → `done`) warn without force and fail the run visibly
- [ ] The flip commit is attributed to the bot and never touches anything under `tasks/` except status fields
- [ ] `docs/agents.md` §5 documents the new mechanism and its limits (checklist ticking stays a human/agent responsibility)
