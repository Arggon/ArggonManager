---
type: task
status: in_progress
id: task-record-exploration-016-worktree-runtime-isolation
title: "Record exploration 016: worktree runtime isolation"
assignee: Arggon
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

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Arggon
Exploration recorded on branch feat/task-record-exploration-016-worktree-runtime-isolation (commit eb48effb), draft PR Arggon/ArggonManager#523.

Evidence:
- Files created: ArggonManager/docs/explorations/exploration-worktree-env-isolation-016.md; only other edit: this item's Context/Acceptance (boxes ticked).
- Numbering verified before writing: explorations max on main was 014; 015 and ADR 0017 are reserved by open PR #519, so this doc took 016 (both open PRs merge cleanly in either order).
- `npm run arggon -- validate` ok (0 warnings, convention v5) before staging; pre-commit gate re-ran it on commit.
- Measured inputs (2026-10-01): board --serve binds port 0 (cli/src/board-serve.ts:473); docker ps shows fixed-port shared services (evajoyas-db 5433, mssql 1433); node_modules 182 MB; docker system df 3.3 GB reclaimable volumes; distrobox shares $HOME (docs); containers share host kernel (Red Hat/CMU sources).
- Recommendation recorded: layered — C1 host-native env contract always (via the existing start --worktree seam), C2 ephemeral per-worktree service containers only for real service collisions; C3 devcontainer/C4 distrobox/C6 VM rejected as defaults; C5 Nix optional complement. ADR left open pending product-owner acceptance (next free ADR id likely 0018 at merge time).
