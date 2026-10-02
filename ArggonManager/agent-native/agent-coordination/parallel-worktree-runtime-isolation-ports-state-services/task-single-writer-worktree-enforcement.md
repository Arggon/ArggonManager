---
type: task
status: in_progress
id: task-single-writer-worktree-enforcement
title: "Single-writer worktree enforcement: detect + refuse concurrent writes into a claimed worktree"
assignee: Arggon
branch: feat/task-single-writer-worktree-enforcement
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, devex]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T23:52:28.218Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-single-writer-worktree-enforcement
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-single-writer-worktree-enforcement.md
  Leaves live only under a story. id is the filename stem: task-single-writer-worktree-enforcement.
  CLI `arggon create task single-writer-worktree-enforcement` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Single-writer worktree enforcement: detect + refuse concurrent writes into a claimed worktree

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from exploration-worktree-env-isolation-017 finding F12 (PR #523): the seam-pin worker's CLAIMED worktree was written into by a concurrent session mid-task (disclosed on PR #544; the writer finished + merged the item's own work). Single-writer ownership is convention, not enforcement.

## Acceptance
- [x] Decide the mechanism (claim-lease stamp on the worktree dir, a lockfile the native tools honor, or start/attach-time detection warning on foreign recent writes) — exploration 017 §F12 + ADR 0019 carry the context. DECIDED: claim stamp (`arggon-claim.json` in the worktree's git dir — no worktree pollution, no cleanup lifecycle) + attach-time detection comparing `git status --porcelain` mtimes against the stamp; foreign identity + newer writes = the F12 signature.
- [x] Implement detection first (warn on foreign-session writes newer than the claim); enforcement (refuse) can be an x-tracker flag like strict-gate-bins. BOTH in this PR: report-only `claim.foreignWrites` warning on CLI + native receipts; `x-tracker.strict-worktree-writes: true` refuses the attach before any item mutation (mirrors strict-gate-bins).
- [x] Tests: concurrent-writer scenario pinned; normal single-writer flow unchanged. Kernel 11 new tests, CLI 8 (incl. byte-identity same-identity attach + plain-start no-field), native 3 (stamp+warn, default identity, strict refusal); full suite 2094 green.
- [x] Docs: the ownership convention stated where adopters read it. docs/agents.md §Single-writer ownership + docs/convention.md x-tracker section (stamp, detection semantics, flag).
