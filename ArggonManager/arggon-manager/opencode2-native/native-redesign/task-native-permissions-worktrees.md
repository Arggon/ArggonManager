---
type: task
status: in_progress
id: task-native-permissions-worktrees
title: "Permissions, worktree domain and item lifecycle"
assignee: Arggon
branch: feat/task-native-permissions-worktrees
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T16:20:01.901Z"
depends_on: [task-native-commands-seam]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-permissions-worktrees
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-permissions-worktrees.md
  Leaves live only under a story. id is the filename stem: task-native-permissions-worktrees.
  CLI `arggon create task native-permissions-worktrees` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Permissions, worktree domain and item lifecycle (W4)

## Context

W4 of `plan-native-first-011`. Ship permission defaults (reviewer `edit` deny, coordinator subagent allow-list, minimal shell gates) and implement start/cleanup over the worktree domain (`ctx.worktree.create/list/remove`), keeping the `gh` PR step and the kernel invariants (never steal a claim, never reopen done/cancelled).

## Acceptance

- [ ] Headless claim → worktree → commit → (stubbed) PR → done scenario passes.
- [ ] Never-steal and no-reopen invariants are covered by tests and hold with permissions active.
- [ ] `cleanup` removes merged worktrees and clears `worktree_path`.
- [ ] Permission defaults load without breaking ordinary sessions.

## Notes

- Depends on W2; kernel invariants remain authoritative (permissions are defense in depth).
