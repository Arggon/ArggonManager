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

- [x] Decision made between: (a) guidance — tracker-carrying PRs use merge commits (never squash); (b) convention — `--no-commit` on mutations inside PR branches, let the PR carry the tracker change; (c) product mitigation (e.g. auto-commit skips when the branch already carries the mutation inside an open PR) — with trade-offs written down
- [x] The chosen guidance lands in skills/arggon-cli/SKILL.md (Pitfalls) and docs/agents.md (or convention.md if it is a schema-level rule)
- [x] Cites the vencimientos evidence (merge #1 manual rebase) as the motivating case

## Notes

### Decision (2026-09-15)

Adopted **(a) as the primary rule**: a PR whose branch carries tracker auto-commits MUST be merged with a merge commit, never squashed. Squashing rewrites the tracker changes into one new commit on main while the branch's local auto-commits remain in local history — the next pull diverges on identical content. (b) is documented as the alternative for stacked/multi-item branches (`--no-commit` on mutations; the PR carries the tracker change, so there are no local auto-commits to diverge), and as the recovery for forced squash: `git pull --rebase origin main` from the stale branch (rerere enabled) or delete the stale branch and restart from fresh main.

### Trade-offs considered

- **(a) merge commits (chosen, primary):** zero tooling change, the local auto-commits ARE the upstream history, so divergence is impossible by construction. Cost: non-linear history and slightly larger PR diffs on tracker-only commits; relies on humans/agents picking the right merge button per PR.
- **(b) `--no-commit` in PR branches (documented alternative):** removes the divergence at the source and composes well with stacked branches. Cost: pushes hygiene onto every mutation call (easy to forget), and the tracker change only lands when the PR merges — mid-PR tracker state is invisible to other agents on main.
- **(c) product mitigation — auto-commit skips when an open PR already carries the mutation (REJECTED for now):** would make the default safe regardless of merge strategy. Cost: detection is complex and heuristic (GH API lookup, mapping branch→PR, races with PR state), and the guidance in (a) already covers the case. Revisit if squash-mandating adopters report repeated divergences despite the guidance.

### Landing

- `skills/arggon-cli/SKILL.md` — Pitfalls entry: pattern, why, rule, recovery (carrier for adopters).
- `docs/agents.md` — §0 tracker-hygiene paragraph: merge-don't-squash rule + recovery recipe (ArggonManager's own playbook; adopter AGENTS.md stays lean per its 2KB budget).
- `docs/convention.md` — intentionally unchanged: the rule is workflow guidance, not a schema-level `x-tracker` option.
