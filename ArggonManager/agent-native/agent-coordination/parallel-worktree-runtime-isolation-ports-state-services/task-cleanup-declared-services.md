---
type: task
status: todo
id: task-cleanup-declared-services
title: cleanup --prune reaps per-worktree Compose projects only when the repo declares them
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [cleanup, worktree]
created: "2026-10-01"
updated: "2026-10-01"
depends_on: [task-env-contract-start]
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-cleanup-declared-services.md
  Leaves live only under a story. id is the filename stem: task-cleanup-declared-services.
  CLI `arggon create task cleanup-declared-services` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --prune reaps per-worktree Compose projects only when the repo declares them

## Context

The reaping side of [ADR 0019](../../../../docs/adr/0019-worktree-runtime-isolation.md)
layer 2: an adopter following the per-worktree services pattern creates a
Compose project named `<repo>-<item-id>` per worktree; when the worktree is
reaped (`cleanup --prune`), the project must go with it — or it becomes
permanent docker residue (exploration 016 F2/F8: 3.3 GB reclaimable observed
on one machine). Safety by construction: the kernel may invoke Docker **only**
for projects the repo's committed convention declares (a Compose/services
manifest naming the project); with no declaration — or no Docker — cleanup
stays report-only. Sequencing only: `depends_on: task-env-contract-start`
settles the convention shapes this task consumes.

## Acceptance

- [ ] `cleanup` lists (and with `--prune` removes) Compose projects whose name matches the declared convention, only for worktrees that otherwise qualify (done/cancelled + merged branch).
- [ ] No Docker invocation when the repo declares nothing or Docker is absent — the report-only path is covered by tests that need no daemon (CI-safe).
- [ ] Removal uses `docker compose -p <repo>-<item-id> down -v --remove-orphans`; failures land in the existing `failures[]` surface (see task-cleanup-json-exit-code for the exit-code contract) and never abort the run.
- [ ] Docs updated in the same PR (README cleanup section; `json-output.md` if the payload changes); impact class stated; skill copies byte-equal.
- [ ] `npm test` green; `arggon validate` ok.

## Notes
