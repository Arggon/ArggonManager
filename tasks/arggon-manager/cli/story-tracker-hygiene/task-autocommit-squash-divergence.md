---
type: task
status: in_progress
id: task-autocommit-squash-divergence
title: "tracker auto-commits + squash merges diverge history: document workflow or decide"
assignee: Arggon
branch: feat/task-autocommit-squash-divergence
parent: story-tracker-hygiene
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T13:00:29.359Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/task-autocommit-squash-divergence.md
  Leaves live only under a story. id is the filename stem: task-autocommit-squash-divergence.
  CLI `arggon create task autocommit-squash-divergence` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# tracker auto-commits + squash merges diverge history: document workflow or decide

## Context

Feedback from the vencimientos adoption experiment (2026-09-15), corroborated independently in ArggonManager's own repo during the same week. Tracker mutations auto-commit locally on the current branch; the same changes reach origin/main inside the (squash) merge of the PR. Result: after the PR merges, `git pull` diverges — rebase conflicts on "same content, different history" (vencimientos merge #1 blocked, fixed with a manual `rebase --onto`; merges #2/#3 auto-resolved via rerere "patch contents already upstream"). In ArggonManager itself the same family showed up as the update-branch/flip dances all session. Intrinsic to tracker-in-tree + auto-commit on-by-default + squash merges — the next agent will trip on it unless the workflow is decided and documented.

## Acceptance

- [ ] Decision made between: (a) guidance — tracker-carrying PRs use merge commits (never squash); (b) convention — `--no-commit` on mutations inside PR branches, let the PR carry the tracker change; (c) product mitigation (e.g. auto-commit skips when the branch already carries the mutation inside an open PR) — with trade-offs written down
- [ ] The chosen guidance lands in skills/arggon-cli/SKILL.md (Pitfalls) and docs/agents.md (or convention.md if it is a schema-level rule)
- [ ] Cites the vencimientos evidence (merge #1 manual rebase) as the motivating case

## Notes
