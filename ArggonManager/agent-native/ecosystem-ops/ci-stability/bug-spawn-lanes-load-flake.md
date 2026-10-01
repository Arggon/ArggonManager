---
type: bug
status: todo
id: bug-spawn-lanes-load-flake
title: "Spawn-heavy CI tests show transient exit-1/timeout flakes under runner load (headless-ci packed-bin, pack, success-stdout)"
parent: ci-stability
labels: [testing, flaky, ci]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-spawn-lanes-load-flake.md
  Leaves live only under a story. id is the filename stem: bug-spawn-lanes-load-flake.
  CLI `arggon create bug spawn-lanes-load-flake` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spawn-heavy CI tests show transient exit-1/timeout flakes under runner load (headless-ci packed-bin, pack, success-stdout)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the bug-row-table-flake investigation evidence (PR #513): during 6 full-suite runs under deliberate 12-core saturation + shuffle, the row-table suite never failed, but OTHER spawn-heavy files showed the same transient class (exit-1/timeout under load; headless-ci packed-bin and pack named by the worker; one failure observed live while a sibling session's suite ran concurrently). The row-table instance was root-caused to the tsx wrapper's IPC server (fixed by #513); these siblings share the spawn-under-load pattern.

## Acceptance
- [ ] Reproduce under controlled load (saturation + shuffle loops) and identify which lanes flake; capture stderr via diagnosable assertion messages (PR #513 pattern) where missing.
- [ ] For each confirmed lane: either remove the spawn-chain nondeterminism (see task-runcli-import-tsx-migration) or make the wait deterministic (readiness signal, not sleep).
- [ ] Lane-specific retries removed once root-caused; any remaining retry documents its rationale in the test.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
verdict: approve + item closed — ROOT CAUSE REVISED with controlled evidence.

## What the verification found (coordinator-run, inline)
1. Wrapper-IPC spawn class: FIXED by #513/#518 — 30 recorded loaded runs with zero exit-1 spawn failures; the migrated chains hold under saturation.
2. The residual saturated failures (1-2 per round, cli/src/headless-ci.test.ts) are NOT load and NOT spawn: they are ORDER-DEPENDENCE under `--sequence.shuffle`. The file shares one mutable fixture with implicit ordering: drift-gate requires the bootstrap phase's side effects; the MCP-removal phase requires drift-gate's. Shuffled, drift-gate can run first (fixture = seed files only -> `git commit` finds nothing -> 'nothing to commit' exit 1) and the MCP phase can run pre-bootstrap (validate exits 1 on the missing tracker). Diagnosed with staged instrumentation (PORCELAIN/LOG/GITIGNORE captures): at failure time HEAD was still 'initial' and the fixture contained only the seed files.
3. Method note (honesty): the first instrumented reproduction used `-t 'drift gate'`, which skips the bootstrap test — that 'repro' was an artifact and was discarded.

## Fix (PR #546, merged eea4266f)
The three order-dependent phases are ONE atomic test (bootstrap -> drift gate -> seam removal); vitest 5.0.0 has no sequential/ordering API (describe.sequential is undefined — tried first, TS2339 + runtime undefined) so atomicity is the correct lever. Shuffle shuffles tests, not statements inside one test.

## Verification
- Pre-fix: saturated shuffle rounds failed 1-2 tests/round, reproducibly (3/3 rounds).
- Post-fix: 3/3 saturated shuffle rounds green (81/81 each); full suite 1995/1995; headless file 4/4.
- Lane retries: the row-table CI-only retry was already removed in #513; no other retries existed in these lanes to remove.

## Acceptance mapping
- Reproduce under controlled load + identify lanes: DONE (saturated shuffle loops; lanes = headless-ci phases; mechanism identified).
- Fix: DONE (#513/#518 spawn chains + #546 shuffle-safe lifecycle).
- Retries removed once root-caused: DONE (#513 removed the row-table retry; none remain).
Item done.
