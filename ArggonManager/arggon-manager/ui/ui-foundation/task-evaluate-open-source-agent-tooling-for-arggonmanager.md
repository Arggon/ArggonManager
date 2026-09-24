---
type: task
status: in_progress
id: task-evaluate-open-source-agent-tooling-for-arggonmanager
title: Evaluate open-source agent tooling for ArggonManager
assignee: Arggon
parent: ui-foundation
labels: [research, agents, tooling]
created: "2026-09-24"
updated: "2026-09-24"
claimed_at: "2026-09-24T14:01:05.692Z"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-evaluate-open-source-agent-tooling-for-arggonmanager.md
  Leaves live only under a story. id is the filename stem: task-evaluate-open-source-agent-tooling-for-arggonmanager.
  CLI `arggon create task evaluate-open-source-agent-tooling-for-arggonmanager` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Evaluate open-source agent tooling for ArggonManager

## Context

Research the current open-source agent tooling ecosystem and identify the
highest-leverage, lowest-risk improvement for ArggonManager. Preserve the
accepted native-first architecture: the Markdown tracker is canonical, all
mutations use the shared kernel, agent context is budgeted, and the published
web/TUI surfaces remain dependency-free. Distinguish tools that improve agent
development/acceptance from tools that should become product dependencies.

The comparison is recorded in
`ArggonManager/docs/explorations/exploration-open-source-agent-tooling-013.md`.
The working recommendation is to fix the existing P1 native worktree-readiness
failure first, then adopt low-context CLI/test tooling (`ast-grep`,
`fast-check`, Playwright/axe), standardize local code-graph intelligence, and
pilot the native V2 `opencode2-shell-tasks` plugin server-only for long-running
interactive jobs. `opencode-chromium@1.7.2` remains on hold pending a fixed
release and real v2.0.16 browser registration. No product code change is part
of this task.

## Acceptance

- [x] Current ArggonManager architecture, context budgets, UI backlog, tests,
      worktree-readiness failure, and OpenCode V2 version are measured and
      recorded with local evidence.
- [x] Native OpenCode V2 plugins and MCP/self-hosted alternatives are compared
      by fit, license, context cost, operational risk, and source-of-truth
      impact, with dated sources.
- [x] One primary recommendation, one fallback, explicit non-fits, and a
      time-boxed pilot/decision gate are recorded, including the native V2
      background-task permission boundary and browser-release hold.
- [x] No runtime dependency, generated configuration, tracker source-of-truth
      change, or product behavior change is introduced.
- [ ] If the pilot is approved later, its exact versions, safety policy,
      schema budget, and rollback procedure are recorded in a dev-only
      playbook/ADR.

## Notes

The exploration is intentionally left `open`: it recommends a pilot, not an
accepted technology decision. No ADR is created until the pilot produces
repeatable evidence.
