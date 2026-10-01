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
