---
type: task
status: in_progress
id: task-board-edit-safety
title: Enforce claim and transition rules on board edits
assignee: arggon
branch: feat/task-board-edit-safety-agent
parent: story-web-board
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
# Enforce claim and transition rules on board edits

## Context

The board must not become a side door around the claim rules.

## Acceptance

- [x] Claim conflict (already-assigned item) is rejected; `--force` stays CLI-only
- [x] `in_progress` without assignee rejected for story/task/bug
- [x] `blocked` requires a non-empty reason via a board prompt

## Board edit cases (E2E contract)

Board edits route through the update path (`runUpdate`) and never pass
`force`. Expected outcome per case (error fragments are the update-path
messages the board must surface):

Must reject:
- B1 reassign claimed item (`in_progress` + assignee alice, board sets bob)
  → `claim conflict`; rejected even if a force flag is smuggled in
- B2 claimable (story/task/bug) → `in_progress` with no assignee
  → `requires --assignee`
- B3 → `blocked` with missing/empty/whitespace-only reason
  → `requires --blocked-reason` (empty board-prompt submit still rejected)
- B4 illegal transition (e.g. `todo` → `done`, `blocked` → `done`)
  → `cannot transition status`
- B5 unknown id → `not found under tasks/`
- B6 initiatives/epics MAY go `in_progress` unassigned (no over-blocking)

Must allow:
- A1 `todo` → `in_progress` + assignee on task (claim via board)
- A2 `in_progress` → `done`, A3 `in_progress` → `todo` (unclaim clears assignee)
- A4 `in_progress` → `blocked` + non-empty reason
- A5 `blocked` → `in_progress`
- A6 label/title-only edits keep status rules intact when combined
