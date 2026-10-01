---
type: task
status: in_progress
id: task-derive-cli-spawn-loader
title: "deriveDefaultCliSpawn cannot derive a spawn spec under the --import loader form (product limitation surfaced by the #518 sweep)"
assignee: Arggon
branch: feat/task-derive-cli-spawn-loader
parent: ci-stability
labels: [testing, mcp]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T14:29:06.712Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-derive-cli-spawn-loader
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-derive-cli-spawn-loader.md
  Leaves live only under a story. id is the filename stem: task-derive-cli-spawn-loader.
  CLI `arggon create task derive-cli-spawn-loader` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# deriveDefaultCliSpawn cannot derive a spawn spec under the --import loader form (product limitation surfaced by the #518 sweep)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from task-runcli-import-tsx-migration (PR #518): with tests now spawning the CLI via `node --import <loader>`, the product-side deriveDefaultCliSpawn cannot derive a spawn spec in that form. Safe today (no test exercises spawn tools through child-spawned mcp servers), but any future test doing so will silently fall back. Acceptance: either teach deriveDefaultCliSpawn the loader form (argv triple) or assert loudly + document the limitation where the derivation is attempted; add a test pinning whichever behavior is chosen.
