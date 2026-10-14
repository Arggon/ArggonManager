---
type: task
status: in_progress
id: task-release-stale-compose-reaping
title: cleanup --release skips Compose reaping for stale records while --prune reaps them — decide and align (or document the difference)
assignee: arggon-delivery-lead
branch: feat/task-release-stale-compose-reaping
parent: story-start-worktree
labels: [worktree, cleanup]
created: "2026-10-14"
updated: "2026-10-14"
claimed_at: "2026-10-14T17:14:41.985Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-release-stale-compose-reaping
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/task-release-stale-compose-reaping.md
  Leaves live only under a story. id is the filename stem: task-release-stale-compose-reaping.
  CLI `arggon create task release-stale-compose-reaping` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --release skips Compose reaping for stale records while --prune reaps them — decide and align (or document the difference)

## Context

Flagged while fixing `bug-cleanup-release-stale-record-wedge` (PR #813): for a STALE record (a recorded path that is not a live worktree), the `--release` arm now skips removal, Compose reaping, stamp/env handling and treats removal as already-gone — mirroring the pre-existing missing-path release behavior. The `--prune` arm reaps Compose for stale entries. If a dead worktree had Compose services, release leaves them lingering where prune would reap them.

## Acceptance

- [ ] The difference is resolved one way and recorded: either `--release` reaps Compose for stale records like `--prune` does, or the divergence is deliberate and documented with its reason
- [ ] A test pins the chosen behavior
- [ ] `arggon validate` green; PR opened

## Notes

### 2026-10-14 @Arggon
### Evidence — completed by the lead after a host tool-runtime outage (maker work preserved)
The maker's session died mid-flight with the work complete and uncommitted; the delivery lead regenerated the plugin bundle and finished from the same worktree. **Decision: parity with `--prune`** — `--release` now reaps the declared Compose project for a stale record first (the project name derives from the recorded path's basename, never from a live directory), because a released claim is never terminal so prune would never consider it again; skipping the reap is a permanent-residue failure mode. Release keeps its **own** failure discipline: a failed teardown aborts the release and keeps the worktree record (the retry's anchor), not prune's non-fatal continue.
Files: `cli/src/cleanup.ts`, `opencode/plugins/arggon/index.ts` (+ regenerated `index.bundle.ts`), `cli/src/worktree.test.ts` (2 new tests: stale+services → `reaped compose project` → record pruned → branch deleted → cleared; and Compose failure on stale → `failed`, record+branch kept), `opencode/plugins/arggon/tools.test.ts` (native docker-shim case), `ArggonManager/docs/json-output.md` (x2) + `README.md`.
Gates: `npm run build` ok (bundle regenerated); focused 235/235 (worktree + native + plugin-copy drift gate); validate + prettier green (lead). Full `npm test` runs in CI. PR #819.

### handoff 2026-10-14 @Arggon — next: Review + merge PR #819; tick the three acceptance rows at merge verification.
- branch: feat/task-release-stale-compose-reaping
