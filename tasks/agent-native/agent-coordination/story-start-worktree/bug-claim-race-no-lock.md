---
type: bug
status: done
id: bug-claim-race-no-lock
title: "start claim is not atomic: concurrent starts both succeed (no lock on check-and-set)"
assignee: Arggon
parent: story-start-worktree
labels: []
created: "2026-09-13"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/bug-claim-race-no-lock.md
  Leaves live only under a story. id is the filename stem: bug-claim-race-no-lock.
  CLI `arggon create bug claim-race-no-lock` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# start claim is not atomic: concurrent starts both succeed (no lock on check-and-set)

## Context

Found by the suizo experiment (2026-09-13, session sess_29e61c5a): two subagents launched simultaneously ran `arggon start <id> --assignee Arggon --worktree` on the SAME story in a clean tree — BOTH returned ok:true (evidence preserved: /tmp/race-agent-a2/start.json, /tmp/race-agent-b2/start.json; same claimed_at 2026-09-13T22:53:05.568Z, same branch/worktree). One created the worktree, the other ATTACHED instead of failing with START_FAILED — two agents wrote the same worktree concurrently, each seeing the other's files appear/disappear. Root cause: the claim is a read-modify-write of the item file with no lock; same-assignee re-runs attach by design, so parallel processes sharing one login are indistinguishable. A related audit race (different assignees, alice vs bob) showed the dirty-tree gate accidentally serializing one variant, but the no-lock window is structural: last-write-wins on the item file can silently replace a claim.

## Acceptance

- [x] Claim check-and-set is atomic (file lock — flock on a lock file under tasks/ or the item file — around read/verify/write in start and update status transitions)
- [x] Concurrent same-assignee starts: exactly one wins (created), the other attaches OR fails deterministically — no interleaved double-ok with shared worktree (decide and document the semantics)
- [x] Concurrent different-assignee starts: exactly one wins, the other gets the claim-conflict START_FAILED (never last-write-wins)
- [x] Tests: real concurrent processes (like the suizo repro) asserting single-winner semantics
