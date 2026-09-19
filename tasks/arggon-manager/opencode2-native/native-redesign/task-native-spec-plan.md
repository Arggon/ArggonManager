---
type: task
status: todo
id: task-native-spec-plan
title: "Spec and plan: native-first rebuild waves"
parent: native-redesign
depends_on: [task-native-adr-0011]
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-19"
---

<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-spec-plan.md
  Leaves live only under a story. id is the filename stem: task-native-spec-plan.
  CLI `arggon create task native-spec-plan` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec and plan: native-first rebuild waves

## Context

Follow-up to `task-native-adr-0011` (ADR 0011) and exploration
`exploration-opencode2-native-010`. Produce the contract and the wave plan for
the native-first rebuild under epic `opencode2-native`.

## Acceptance

- [ ] `docs/specs/spec-native-first-<nnn>.md` merged: surface map (tools,
      commands, permissions, worktree domain, TUI, seam), data contract
      (git-native tracker, storage as cache), distribution and migration.
- [ ] `docs/plans/plan-native-first-<nnn>.md` merged: ordered waves with
      per-wave acceptance and gates (kernel-as-library extraction; native
      tools; commands + seam; permissions + worktree domain; TUI board;
      headless bootstrap/CI; dogfood; context re-measurement).
- [ ] Each wave filed as a story/task under `native-redesign`, with
      dependencies reflected in `depends_on`.
- [ ] ADR 0006 re-measurement planned as an explicit wave gate.
- [ ] `arggon validate` and `arggon spec validate` green; docs-only diff.

## Notes

- Keep the exploration's open tensions (bootstrap form and B→A criteria,
  kernel packaging, config-seam content, MCP adapter) as spec decisions.
