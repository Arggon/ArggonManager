---
type: story
status: todo
id: story-start-worktree
title: Worktree-integrated claims
parent: agent-coordination
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/story-start-worktree.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Worktree-integrated claims

## Context

The playbook mandates worktrees; the CLI can enforce it. `start --worktree` creates `../<repo>-<id>`, runs the claim/branch/push flow there, and records the path on the item. `arggon cleanup` reaps worktrees whose items are done/cancelled and whose branches are merged.

## Acceptance

- [ ] `start --worktree` yields an isolated worktree recorded on the item; re-running attaches
- [ ] `arggon cleanup` lists (default) and removes (`--prune`) stale worktrees safely
