---
type: bug
status: todo
id: bug-unclaim-leaves-worktree-record-without-reaper
title: "Unclaiming a claimed item (update --status todo) keeps worktree_path + branch + claim stamp, and cleanup never reaps a non-done item"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, tracker]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-unclaim-leaves-worktree-record-without-reaper.md
  Leaves live only under a story. id is the filename stem: bug-unclaim-leaves-worktree-record-without-reaper.
  CLI `arggon create bug unclaim-leaves-worktree-record-without-reaper` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Unclaiming a claimed item (update --status todo) keeps worktree_path + branch + claim stamp, and cleanup never reaps a non-done item

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Found while reviewing PR #589 (task-coordinator-claims-through-native-start): the coordinator contract it adds tells an agent that claiming an item you are not dispatching is wrong, and the remedy is to unclaim — `tools.arggon.update({ id, status: "todo" })`. But that leaves the whole claim footprint behind: `branch`, `worktree_path` (the created `../<repo>-<id>` worktree), the worktree's `.arggon.env` env contract and its `arggon-claim.json` ownership stamp. And nothing reaps it: `cleanup --prune` classifies on done/cancelled + merged branch (`cli/src/cleanup.ts:191`), so an item that goes back to `todo` is invisible to cleanup — the unowned-worktree class this item exists to prevent, arriving through the documented remedy.

## Acceptance
- [ ] Decide + implement the contract: either unclaiming a claim that CREATED a worktree also releases it (remove the worktree + branch, clear `worktree_path`, reap the env file and the claim stamp, reported as a distinct `cleanup` action), or the contract refuses to advise unclaim and names the path that does release it.
- [ ] Kernel-owned and CLI+native parity: the release path lives where the worktree domain lives (`cleanup`), not in prose; the native `update` tool must surface the same contract (it cannot release a worktree it does not own).
- [ ] Tests: claim → unclaim leaves nothing (worktree gone, `worktree_path` cleared, branch handled, stamp gone); a plain unclaim of a never-worktree item is unchanged; an item that is unclaimed while ANOTHER session holds the worktree is refused (no stealing a live writer's worktree).
- [ ] Docs: agents.md's claim duty (PR #589) stops naming bare unclaim without this consequence, or states it and points at the release path.
