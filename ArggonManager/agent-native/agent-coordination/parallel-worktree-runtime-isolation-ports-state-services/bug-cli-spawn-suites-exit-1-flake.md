---
type: bug
status: todo
id: bug-cli-spawn-suites-exit-1-flake
title: "CI flake: suites that SPAWN the CLI intermittently exit 1 (handoff lib/dist import error; row-table-stdout adopt --ack)"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [ci, flaky]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-cli-spawn-suites-exit-1-flake.md
  Leaves live only under a story. id is the filename stem: bug-cli-spawn-suites-exit-1-flake.
  CLI `arggon create bug cli-spawn-suites-exit-1-flake` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CI flake: suites that SPAWN the CLI intermittently exit 1 (handoff lib/dist import error; row-table-stdout adopt --ack)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Two CI instances, both rerun-green, both in suites that SPAWN the real CLI:
1. PR #571 (docs-only), run 36960202458: `cli/src/handoff.test.ts > handoff CLI > passes --session through the CLI flag into the heading (provenance)` → `expected 1 to be +0` with a stderr trace at `lib/dist/create.js:9 import { ... } from "./relations.js"` — the spawned process died loading the kernel's built output, not an assertion mismatch.
2. PR #576 (config+test only), first `cli` run: `cli/src/row-table-stdout.test.ts > row/table stdout: adopt --ack > keeps the raw doc path in the --json envelope` → `AssertionError: expected 1 to be +0` (child exit 1).
CI order is `npm ci` → `npm run build` → `check:plugin` → `npm run test`, so the kernel dist is built before the suite; a mid-write dist does not fit. Resource exhaustion on the runner (parallel vitest workers each spawning tsx CLIs) is the more plausible root cause and would explain both.

## Acceptance
- [ ] Reproduce by running the spawn-heavy suites repeatedly at CI parallelism on a loaded machine; identify the failing spawn (ECONNREFUSED/EPIPE/EMFILE/OOM/timeout).
- [ ] Fix at the spawn/runner level — bounded concurrency, or a serial lane for process-spawning suites, or retry-on-spawn-failure — NOT per test.
- [ ] Scope: every suite that spawns the CLI (handoff, row-table-stdout, board/tui, comment-race, headless), not the two observed files.
- [ ] Keep the existing dry-run/ordering discipline: a spawn failure must be distinguishable from a real assertion failure in the test output.

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator — third instance, priority raised to p2
PR #573's first `cli` run failed with the same shape in a THIRD different test: `row-table-stdout.test.ts > adopt skip path > escapes the skip-path storyId…` → `expected 1 to be +0`. That makes three PRs in a row (#571 handoff, #576 adopt --ack, #573 adopt skip path) with a rerun-green spawned-CLI exit-1, i.e. roughly one in three PR CI runs is red for this class alone — every merge in this wave paid a rerun, so this is now the top CI-reliability item and should be worked next rather than left open.

Sharpened suspicion: every instance is a suite that spawns the real CLI (via tsx) under parallel vitest, and every instance is `expected 1 to be +0` with no assertion detail — consistent with the child being killed or failing to boot (EMFILE/EPIPE/EAGAIN under spawn pressure, or the runner's memory ceiling), NOT with a product assertion. A cheap discriminator to try first: have the failing spawn print its stderr in the test's failure message (the handoff instance already leaked a module-load stack, which is the kind of evidence that settles it).
