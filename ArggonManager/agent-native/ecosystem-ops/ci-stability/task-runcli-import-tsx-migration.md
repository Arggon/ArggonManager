---
type: task
status: todo
id: task-runcli-import-tsx-migration
title: "Migrate the remaining spawn-chain helpers (success-stdout, doctor, validate, headless-ci) from the tsx wrapper CLI to node --import tsx"
parent: ci-stability
labels: [testing, flaky]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-runcli-import-tsx-migration.md
  Leaves live only under a story. id is the filename stem: task-runcli-import-tsx-migration.
  CLI `arggon create task runcli-import-tsx-migration` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Migrate the remaining spawn-chain helpers (success-stdout, doctor, validate, headless-ci) from the tsx wrapper CLI to node --import tsx

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the bug-row-table-flake root cause (PR #513): the tsx wrapper CLI (tsx/dist/cli.mjs) re-execs node as a second child and hosts a per-spawn IPC server (/tmp/tsx-<uid>/<pid>.pipe) whose unhandled transient failures exit the chain 1 under load. PR #513 migrated ONLY cli/src/row-table-stdout.test.ts's local runCli helper (that helper is file-local; the other suites own their own copies).

## Acceptance
- [ ] Inventory every test helper that spawns the tsx wrapper CLI (success-stdout, doctor, validate, headless-ci packed-bin, e2e helpers) — list file + spawn shape.
- [ ] Migrate each to `node --import <abs>/tsx/dist/loader.mjs` (or the packed dist bin where the lane already uses one), preserving asserted stdout/stderr bytes.
- [ ] Full suite green; each migrated suite run 10x locally without transient exit-1.
- [ ] Confirm no remaining reference to tsx/dist/cli.mjs in test spawn chains (grep gate or follow-up note).
