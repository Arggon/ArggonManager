---
type: bug
status: todo
id: bug-next-json-test-flakily-exceeds-vitest-5s-timeout
title: next --json test flakily exceeds vitest 5s timeout
parent: story-next
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/scale-adoption/agent-loop/story-next/bug-next-json-test-flakily-exceeds-vitest-5s-timeout.md
  Leaves live only under a story. id is the filename stem: bug-next-json-test-flakily-exceeds-vitest-5s-timeout.
  CLI `arggon create bug next-json-test-flakily-exceeds-vitest-5s-timeout` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# next --json test flakily exceeds vitest 5s timeout

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

## Context

Observed on the first CI run of PR #118: `cli/src/cli.test.ts > CLI --json > arggon next --json carries blockedBy and --ready skips blocked items` failed with `Error: Test timed out in 5000ms` (~6008ms); the rerun passed. The test spawns the CLI ~14 times via tsx (fresh process each), so it sits right at vitest's 5s default and tips over under runner load. See https://github.com/Arggon/ArggonManager/pull/118

## Acceptance

- [ ] Raise the per-test timeout (vitest `it(..., timeout)`) for the spawn-loop tests in cli/src/cli.test.ts, or trim the invocation count so they stay well under the limit
- [ ] Sweep cli/src for other spawn-loop tests sitting near the 5s default
- [ ] Green CI on a few consecutive runs
