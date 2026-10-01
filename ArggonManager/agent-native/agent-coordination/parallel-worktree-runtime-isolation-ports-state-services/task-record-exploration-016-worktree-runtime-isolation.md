---
type: task
status: in_progress
id: task-record-exploration-016-worktree-runtime-isolation
title: "Record exploration 016: worktree runtime isolation"
assignee: Arggon
branch: feat/task-record-exploration-016-worktree-runtime-isolation
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, exploration, devex]
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T11:53:03.213Z"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-record-exploration-016-worktree-runtime-isolation.md
  Leaves live only under a story. id is the filename stem: task-record-exploration-016-worktree-runtime-isolation.
  CLI `arggon create task record-exploration-016-worktree-runtime-isolation` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Record exploration 016: worktree runtime isolation

## Context

Coordinator directive (2026-10-01): per-task worktrees sometimes collide at
runtime — "we cannot run the same project multiple times to test different
changes simultaneously … Docker might be the solution, but let's find the best
approach that consumes the fewest possible resources." This task records the
comparison as the repo's own exploration artifact (candidates → criteria →
findings with dated sources → recommendation). The decision itself (ADR +
follow-up spec/tasks) is intentionally **not** part of this task — it happens
after the product owner accepts the recommendation.

## Acceptance

- [x] `ArggonManager/docs/explorations/exploration-worktree-env-isolation-016.md` exists (015 and ADR 0017 are reserved by open PR #519 — verified before writing).
- [x] Candidates include host-native env contract, services-only Docker, full devcontainer, distrobox, Nix and VM; criteria weighted with resource cost first.
- [x] Findings carry measured numbers from this machine (2026-10-01: ephemeral-port board serve, fixed-port docker services, 182 MB node_modules, docker system df residue) and dated external sources (shared-kernel containers, distrobox `$HOME`).
- [x] Recommendation states a layered policy (env contract always; ephemeral service containers only where a real service collision exists; devcontainers/distrobox/VM rejected) and names the follow-up shape (ADR → spec → tasks → cleanup integration).
- [x] `npm run arggon -- validate` ok; no files touched outside `docs/explorations/` and this item file.

## Notes
