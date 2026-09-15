---
type: task
status: in_progress
id: task-autodone-flip-race
title: "auto-done: flip PRs lose the up-to-date race and wedge (no retry; bot check not re-posted)"
assignee: Arggon
branch: feat/task-autodone-flip-race
parent: story-github
labels: []
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T16:28:52.290Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-github/task-autodone-flip-race.md
  Leaves live only under a story. id is the filename stem: task-autodone-flip-race.
  CLI `arggon create task autodone-flip-race` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# auto-done: flip PRs lose the up-to-date race and wedge (no retry; bot check not re-posted)

## Context

Observed 2026-09-15 during the 8-item product-discovery cycle: merging several PRs in rapid succession triggers several auto-done workflows concurrently. Each workflow checks out main at run START, posts the required `cli` check on ITS flip commit, and self-merges immediately — but every OTHER main commit in the window (sibling flips merging, coordinator review comments landing via `arggon comment`) makes the open flip PRs out-of-date. The bot's self-merge then fails ("head branch not up to date"), it does not retry, and the flip PR wedges: `gh pr update-branch` cannot fix it because the rebased head would lack the required `cli` check (bot pushes never trigger CI), so only an admin bypass clears it. 7 of 7 flip PRs needed manual admin merges in this cycle.

## Acceptance

- [ ] The workflow becomes race-tolerant: before merging, if out-of-date, rebase the flip branch onto fresh main AND re-post the `cli` check on the new head via the checks API (it already has checks:write), then retry the merge (bounded retries)
- [ ] The cascade/flip logging (task-auto-done-cascade-visibility) still reports per-id outcomes after the retry path
- [ ] Documented in docs/agents.md (or the workflow comments): why flip PRs can wedge and what the recovery is without admin

## Notes
