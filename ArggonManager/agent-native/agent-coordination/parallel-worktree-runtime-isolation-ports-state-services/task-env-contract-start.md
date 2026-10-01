---
type: task
status: in_progress
id: task-env-contract-start
title: Implement the worktree env contract in start (spec worktree-env-contract-016)
assignee: Arggon
branch: feat/task-env-contract-start
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [kernel, cli, worktree]
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T21:39:37.961Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-env-contract-start
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-env-contract-start.md
  Leaves live only under a story. id is the filename stem: task-env-contract-start.
  CLI `arggon create task env-contract-start` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Implement the worktree env contract in start (spec worktree-env-contract-016)

## Context

Implements layer 1 of [ADR 0019](../../../../docs/adr/0019-worktree-runtime-isolation.md):
`start --worktree` (CLI + native `tools.arggon.start`) writes the gitignored
`.arggon.env` (six documented keys incl. `ARGON_ITEM` for plugin correlation),
seeds `.env` copy-if-absent, creates the per-OS suffixed state/cache dirs, and
reports the additive `preparation.env` receipt field. The contract is
filesystem-only and portable (linux/macos/windows), best-effort by design —
it never blocks the claim. The reviewable contract is
`ArggonManager/docs/specs/spec-worktree-env-contract-016.md`; the breakdown is
`ArggonManager/docs/plans/plan-worktree-env-contract-016.md` (T1–T4).

## Acceptance

- [ ] Every acceptance box in `spec-worktree-env-contract-016` is ticked — those ten verifiable boxes are the contract for this task (kernel unit tests, never-overwrite, seed-only-if-absent, per-OS dirs, additive receipt on both surfaces, env files never committed, `x-worktree.env: false` opt-out, init gitignore, docs same PR, tests/smoke green).
- [ ] PR references this item id and the spec id; impact class **Behavioral** stated in the PR (ADR 0016) — new receipt field + convention key.
- [ ] Coordinator review verdict recorded on this item before merge.

## Notes
