---
type: task
status: in_progress
id: task-native-cleanup-compose-parity
title: "Native cleanup parity: the plugin's nativeCleanup prune loop should reap declared Compose projects like the CLI"
assignee: Arggon
branch: feat/task-native-cleanup-compose-parity
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, opencode-seam, parity]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T03:24:40.608Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-native-cleanup-compose-parity
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-native-cleanup-compose-parity.md
  Leaves live only under a story. id is the filename stem: task-native-cleanup-compose-parity.
  CLI `arggon create task native-cleanup-compose-parity` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native cleanup parity: the plugin's nativeCleanup prune loop should reap declared Compose projects like the CLI

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-01 @Coordinator
Filed from the task-cleanup-declared-services review (PR #569): the CLI's `cleanup --prune` reaps declared per-worktree Compose projects (x-worktree.services manifest; ADR 0019 command shape) BEFORE git worktree remove — but the plugin's nativeCleanup prune loop does NOT (safe today: report-only omission; the MCP arggon_cleanup tool spawns the CLI and DOES reap, so MCP callers get the behavior transitively). The kernel helper `worktreeComposeProject` is already exported, so plugin adoption is trivial per the worker.

## Acceptance
- [x] nativeCleanup prune loop reaps the declared Compose project for each removable entry (same ADR 0019 command shape, same no-op semantics, same bounded failure reporting), before the worktree removal. — evidence: PR #574, `nativeComposeDown` + the reap step in `nativeCleanup` (`opencode/plugins/arggon/index.ts`): declaration read once through `readConventionConfig` (malformed → report-only, never a Docker invocation), teardown `docker compose -p <project> down -v --remove-orphans` (argv array, cwd = repo root, 120s, kernel `worktreeComposeProject`) BEFORE the removal, success → `pruned` `reaped compose project <project>`, other failures bounded on BOTH `pruned[].error` + `failures[]` and non-fatal; tests "reaps `<repo>-<item-id>`…", "derives `<base>-<repo>-<item-id>`…", "reaps every removable entry…", "reports a reap failure on BOTH surfaces…".
- [x] Parity test: CLI and native prune envelopes byte-comparable on the same fixture (modulo the documented surface differences). — evidence: PR #574, "native prune is byte-identical to `cleanup --prune --json` on the same fixture (declared, reaped)" + "native prune matches `cleanup --prune --json` on the absent-docker degradation": twin fixtures (same repo basename, same lifecycle), the SAME recording `docker` shim on a hermetic PATH driving both surfaces, `normalize(cliStdout, cliRoot) === normalize(nativeEnvelope, nativeRoot)` byte for byte. The only surface difference exercised by the fixtures is the documented `pruned[].leftoverPath` (native-only, unobservable removal) — the happy and degraded prunes produce identical bytes.
- [x] Absent-docker degradation matches the CLI's run-wide report-only shape. — evidence: PR #574, "an absent docker CLI degrades the whole run to report-only and still prunes" (`compose: { declared: "true", dockerUnavailable: true }`, `failures: []`, no reap action, everything pruned) and "one ENOENT degrades the REST of the run: no later entry ever reaches Docker" (self-deleting shim over 3 entries: exactly 1 spawn logged, then run-wide report-only). The byte-parity test on the absent-docker fixture pins it to the CLI's own shape.
