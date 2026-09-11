---
type: initiative
status: todo
id: agent-native
title: "Agent-native tooling: dependencies, leases, worktrees, ecosystem"
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/agent-native/agent-native.md (initiative index; required).
  No parent. Omit assignee when unassigned.
-->

# Agent-native tooling: dependencies, leases, worktrees, ecosystem

## Context

Second roadmap wave (2026-09-11), seeded from a competitive study of Backlog.md, Beads and Task Master plus the 2026 "claims + leases + worktrees" agent-orchestration pattern. Arggon's differentiator stays "same rules for humans and agents, state 100% in git"; this wave adds the planning graph and the coordination hardening that make it usable for long-running multi-agent projects.

## Structure

- `deps-graph` — dependency fields (v3 convention), dependency-aware queries and board edges.
- `agent-coordination` — claim leases/staleness, worktree-integrated claims, item comments.
- `ecosystem-ops` — GitHub issue import, spec pipeline, git-history trends, TUI kanban.

## Acceptance

- [ ] All three epics complete; v3 convention (dependencies + milestone, ADR 0004) implemented
- [ ] Every feature landed keeps the invariants: repo is source of truth, same rules for humans and agents, no SaaS
