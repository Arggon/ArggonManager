---
type: bug
status: done
id: bug-next-json-test-flakily-exceeds-vitest-5s-timeout
title: next --json test flakily exceeds vitest 5s timeout
assignee: Arggon
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

Observed on the first CI run of PR #118: `cli/src/cli.test.ts > CLI --json > arggon next --json carries blockedBy and --ready skips blocked items` failed with `Error: Test timed out in 5000ms` (~6008ms); the rerun passed. The test spawns the CLI ~14 times via tsx (fresh process each), so it sits right at vitest's 5s default and tips over under runner load. See https://github.com/Arggon/ArggonManager/pull/118

## Acceptance

- [x] Raise the per-test timeout (vitest `it(..., timeout)`) for the spawn-loop tests in cli/src/cli.test.ts, or trim the invocation count so they stay well under the limit
- [x] Sweep cli/src for other spawn-loop tests sitting near the 5s default
- [x] Green CI on a few consecutive runs

## Notes

Root-cause fix (invocation-count trim, not a timeout bump) + #118 stopgap removed:

- cli.test.ts `arggon next --json carries blockedBy...`: tree setup moved in-process (`runInit`/`runCreate`/`runUpdate` — the same kernel calls the CLI makes); the pre-claim `--ready` assertion now runs against `runNext` directly. 14 spawned invocations → 3 (only the `--json` envelope contracts stay spawned). Measured ~2376ms → ~490ms locally (the CI failure was ~6008ms).
- cli.test.ts `arggon list --json applies dependency filters`: setup in-process, both `--filter` passthrough queries stay spawned. 7 → 2 spawns, ~1404ms → ~323ms.
- Removed the #118 stopgap `vi.setConfig({ testTimeout: 30_000 })` — slowest test left in cli.test.ts is ~1.4s on the default 5s.
- Sweep (verbose vitest, 3 runs): sync-smoke heaviest test ~4.1–4.3s but already carries explicit per-test `120_000` timeouts with a documented smoke header; mcp-smoke has explicit `30_000`; mcp-parity ≤ ~0.9s; adopt/doctor/instructions/board-serve/cascade/tracker-commit ≤ ~0.7s; import-issues spawns nothing. Remaining >1s spawn tests (cli.test.ts empty-pool ~1.39s, report ~1.41s, start-claim ~1.18s) assert CLI output envelopes, so they stay spawned with ~3.5x headroom under the default.
- Stability: full suite (639 tests) green 3 consecutive local runs.
