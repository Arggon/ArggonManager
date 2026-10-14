---
type: bug
status: todo
id: bug-cleanup-release-stale-record-wedge
title: "cleanup --release has the same stale-record shape: a leftover dir whose gitdir is gone reaches removal and wedges (top-level CLEANUP_FAILED)"
parent: story-start-worktree
labels: [worktree, cleanup]
created: "2026-10-14"
updated: "2026-10-14"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/bug-cleanup-release-stale-record-wedge.md
  Leaves live only under a story. id is the filename stem: bug-cleanup-release-stale-record-wedge.
  CLI `arggon create bug cleanup-release-stale-record-wedge` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --release has the same stale-record shape: a leftover dir whose gitdir is gone reaches removal and wedges (top-level CLEANUP_FAILED)

## Context

Residual shape found while fixing `bug-cleanup-stuck-when-worktree-dir-gone` (PR #812), which closed the `--prune` arm: its classifier now probes `worktreeIsLive` (git's own verdict; a `prunable` record is not live), prunes the dead record itself, and clears the item record before deleting the branch. The **`--release` arm** (`classifyReleaseEntry`) still lacks the liveness rule: `!existsSync` covers a removed directory, but a leftover directory whose gitdir is gone reaches removal — on the CLI the `worktreeBranch` probe throws to a top-level `CLEANUP_FAILED`, and a domain inventory listing it attempts the removal. Same class, sibling arm.

## Acceptance

- [ ] `cleanup --release` applies the same liveness rule: a recorded path that is not a live worktree is a stale record — prune the dead record, treat removal as already-gone, clear `worktree_path`, still handle the branch — never a wedge
- [ ] a test pins the shape for the release arm (leftover dir with gitdir gone → release completes, or a self-describing refusal with a working remedy)
- [ ] `arggon validate` green; PR opened

## Notes
