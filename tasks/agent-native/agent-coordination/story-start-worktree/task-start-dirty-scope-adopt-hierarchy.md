---
type: task
status: done
id: task-start-dirty-scope-adopt-hierarchy
title: Scope start clean-tree check; adopt needs pre-existing hierarchy after fresh init
assignee: Arggon
branch: feat/task-start-dirty-scope-adopt-hierarchy
parent: story-start-worktree
labels: []
created: "2026-09-13"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/task-start-dirty-scope-adopt-hierarchy.md
  Leaves live only under a story. id is the filename stem: task-start-dirty-scope-adopt-hierarchy.
  CLI `arggon create task start-dirty-scope-adopt-hierarchy` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Scope start clean-tree check; adopt needs pre-existing hierarchy after fresh init

## Context

Two frictions found by the suizo experiment: (1) `start` refuses on ANY untracked file — including agent-environment dirs unrelated to the project (.v2c/, .video_agent/) — forcing gitignore edits before work; (2) on a fresh `init --full` tree, `adopt` fails with ADOPT_FAILED "no epic found" (init scaffolds no hierarchy; the agent had to guess-create initiative+epic first — the guardian and cuentas-claras agents hit the same flow).

## Acceptance

- [x] start's clean-tree check is scoped: untracked files outside the flow's blast radius (tasks/, the working branch paths) don't block, or an explicit --allow-dirty-untracked escape hatch exists with docs
- [x] adopt on a fresh init tree works out of the box: auto-creates the minimal hierarchy (initiative+epic+adoption story, like it auto-creates the story today) or init --full scaffolds an empty initiative/epic pair; documented
- [x] Tests for both; guardian/cuentas-claras/suizo-style first-run adoption requires zero guesswork
