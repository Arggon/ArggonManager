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

### 2026-10-01 @Arggon
Exploration recorded on branch feat/task-record-exploration-016-worktree-runtime-isolation (commit eb48effb), draft PR Arggon/ArggonManager#523.

Evidence:
- Files created: ArggonManager/docs/explorations/exploration-worktree-env-isolation-016.md; only other edit: this item's Context/Acceptance (boxes ticked).
- Numbering verified before writing: explorations max on main was 014; 015 and ADR 0017 are reserved by open PR #519, so this doc took 016 (both open PRs merge cleanly in either order).
- `npm run arggon -- validate` ok (0 warnings, convention v5) before staging; pre-commit gate re-ran it on commit.
- Measured inputs (2026-10-01): board --serve binds port 0 (cli/src/board-serve.ts:473); docker ps shows fixed-port shared services (evajoyas-db 5433, mssql 1433); node_modules 182 MB; docker system df 3.3 GB reclaimable volumes; distrobox shares $HOME (docs); containers share host kernel (Red Hat/CMU sources).
- Recommendation recorded: layered — C1 host-native env contract always (via the existing start --worktree seam), C2 ephemeral per-worktree service containers only for real service collisions; C3 devcontainer/C4 distrobox/C6 VM rejected as defaults; C5 Nix optional complement. ADR left open pending product-owner acceptance (next free ADR id likely 0018 at merge time).

### 2026-10-01 @Arggon
Adopter-generality revision pushed to PR #523 (commit 727df50a) after product-owner correction: the methodology ships to adopters (npm / OpenCode seam / ZCode plugin) on linux/macos/windows — the exploration must not assume this repo or this machine.

Changes:
- Scope restated: ArggonManager is the first adopter of its own convention; measured numbers are collision-class evidence, not an adopter baseline.
- New F9: Docker is not part of any adopter contract, and Docker Desktop runs a Linux VM on macOS/Windows (docs.docker.com, 2026-10-01) — Docker-dependent options are documented opt-in patterns only; C1 is the only zero-marginal-cost option on all three platforms.
- New F10: ADR 0005 adopter shapes — contract must degrade to a no-op (static-site adopter changes nothing).
- New F11: per-OS state-dir mapping follows env-paths conventions, not a new scheme.
- C1 mechanism corrected to file-first (gitignored dotenv-style file) instead of shell export — portable across runtimes and shells; unix sockets demoted to an optimization, never the contract.
- Cleanup integration made opt-in and safe by construction: kernel never probes/invokes Docker the convention didn't declare (F8).
- Criterion 7 (platform portability) added; YAGNI list extended (no Docker detection/installation in kernel).

`npm run arggon -- validate` ok (0 warnings). Recommendation unchanged in verdict, generalized in scope: C1 always; C2 opt-in for Docker-shipping adopters; C3/C4/C6 rejected; C5 optional. ADR remains open pending product-owner acceptance.
