---
type: task
status: in_progress
id: task-plugin-test-type-coverage
title: Plugin test files escape every type gate (and the local runCli takes an env MAP while test-spawn takes an options object)
assignee: arggon-delivery-lead
branch: feat/task-plugin-test-type-coverage
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [seam, tests]
priority: p3
created: "2026-10-02"
updated: "2026-10-09"
claimed_at: "2026-10-09T19:27:08.802Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-plugin-test-type-coverage
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-plugin-test-type-coverage.md
  Leaves live only under a story. id is the filename stem: task-plugin-test-type-coverage.
  CLI `arggon create task plugin-test-type-coverage` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin test files escape every type gate (and the local runCli takes an env MAP while test-spawn takes an options object)

## Context

<!-- Why this task exists. -->

## Acceptance

- [x] Plugin test files are inside a type gate: extend `cli/tsconfig.plugin.json` (or add a sibling project) so `opencode/plugins/arggon/**/*.test.ts` is type-checked in CI, and the CI workflow runs it.
- [x] One env-injection convention for tests: either the shared `cli/src/test-spawn.ts` options shape everywhere, or the local wrapper renamed/typed so the two cannot be confused; a wrong shape must be a TYPE error, not a runtime surprise.
- [x] Negative control: a test that passes the wrong shape fails to compile (or fails immediately and legibly).

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Found while reviewing PR #574 (native cleanup Compose parity): `opencode/plugins/arggon/**/*.test.ts` is outside EVERY type gate — `tsconfig.json` includes `cli/src/**/*.ts` only, `tsconfig.typecheck.json` adds only `test/**`, `eslint.config.js` uses non-type-aware `tslint.configs.recommended` (typo of the real package name aside), and `cli/tsconfig.plugin.json` includes `index.ts`/`board.ts`/`tui.tsx` but NOT the test files; vitest transpiles without checking. The plugin tests are therefore the one place in the repo where a wrong argument shape compiles fine and fails only as a confusing runtime assertion.

The concrete instance (PR #574 worker): the suite's local `runCli(args, cwd, env)` takes an env MAP and wraps it, while `cli/src/test-spawn.ts`'s `runCli` takes an OPTIONS object — passing `{ env }` gives the child an environment with one variable literally named `env`, PATH is silently lost, and the child then finds the HOST's real `docker`, so an absent-docker case would pass for the wrong reason. The new tests pass the right shape, so nothing is broken today; the class is what matters.
