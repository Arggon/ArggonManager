---
type: task
status: done
id: task-native-cleanup-compose-parity
title: "Native cleanup parity: the plugin's nativeCleanup prune loop should reap declared Compose projects like the CLI"
assignee: Arggon
branch: feat/task-native-cleanup-compose-parity
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, opencode-seam, parity]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
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

### 2026-10-02 @ses_f055baad1ffeJBgIqkg18b8dKY
PR: https://github.com/Arggon/ArggonManager/pull/574 (branch feat/task-native-cleanup-compose-parity, pushed).

## What changed
- `opencode/plugins/arggon/index.ts`: new `nativeComposeDown` (the twin of the CLI's `ComposeDown` seam: argv array `docker compose -p <project> down -v --remove-orphans`, cwd = repo root, 120s, byte-identical failure message) + the reap step inside `nativeCleanup`'s prune loop, before the domain removal; `compose` added to the envelope (additive within schemaVersion: 1, only when `x-worktree.services` is declared).
- `opencode/plugins/arggon/tools.test.ts`: 9 new cases (7 native + 2 byte-parity).
- `ArggonManager/docs/json-output.md`: one-line extension of the §cleanup Compose paragraph (native tool applies the same declaration/teardown/degradation/failure reporting).
- `opencode/plugins/arggon/index.bundle.ts`: regenerated in its own `chore: regen plugin bundle` commit (never hand-edited).

## How the semantics match the CLI
- declaration: read once through the kernel's `readConventionConfig(root).worktree.services`; absent/false = no Docker invocation at all; a malformed file degrades to the same report-only path (same discipline as `cli/src/cleanup.ts`).
- project name: kernel helper `worktreeComposeProject(declared, basename(entry.path))` — the CLI's exact derivation (`<repo>-<item-id>` for `true`, `<base>-<repo>-<item-id>` lowercased for a base name).
- ordering: reap FIRST, removal after (proved by the shim recording `worktree present` for each entry's own worktree).
- success → `pruned` entry `reaped compose project <project>`; already-gone project = the same exit-0 no-op (no probing).
- absent docker CLI (`ENOENT`) → `compose.dockerUnavailable: true` once + the WHOLE rest of the run report-only, never a failure.
- other failures → bounded at the shared 500-char cap on BOTH `pruned[].error` and `failures[]`, non-fatal; the removal/branch-delete/clear below still run.

## Parity-test evidence
Real executor seam on both surfaces (the plugin has no injectable dep): a recording `docker` shim on a hermetic PATH (only `git` and `rm` symlinked in) that the native tool resolves in-process and the spawned CLI child resolves too. The hermetic PATH matters — the host's real /usr/bin/docker answers `compose down` for an unknown project with exit 0 + a 'No resource found' warning, so a non-hermetic PATH would make an absent-docker case pass for the wrong reason (that is exactly what happened during development, and it cost the run its first green).

Harness for 'the same fixture on both surfaces': a prune mutates, so both surfaces run on TWIN fixtures (identical repo basename `repo`, identical seeded tracker, identical claim → worktree → commit → merge → done lifecycle; only the temp parent differs, normalized away). One shim serves both because its log path + observed worktree come from the caller's env; `--no-commit` / `no_commit: true` keep the tracker-commit payload the same deterministic `{ skipped: 'auto-commit disabled' }`. Then:
- reaped case → `normalize(cliStdout, cliRoot) === normalize(JSON.stringify(nativeEnvelope)+'\n', nativeRoot)` byte for byte, plus both shim logs showing the same projects, same order, from their own repo root.
- absent-docker case → the same byte comparison on the degradation fixture.
No surface difference is papered over: the only documented native-only field (`pruned[].leftoverPath`, unobservable removal) is not reachable in these fixtures, so the happy and degraded prunes genuinely produce identical bytes.

## Gates (branch tip)
npm test 2118 passed / 116 files · npm run lint · npm run build · npm run check:plugin · npm run test:structure · npm run lint:structure · npm run smoke:native-start-cold · npm run arggon -- validate → {"ok":true} — all green.
(`cli/src/headless-ci.test.ts` failed on a CLEAN tree in this worktree before `npm run build` existed — it asserts `dist/cli.js`; after the build it passes. Not related to this change.)

## Finding for the coordinator (not filed by me, per the no-self-filing rule)
The suite's local `runCli(args, cwd, env)` in `opencode/plugins/arggon/tools.test.ts` takes the env MAP, while `cli/src/test-spawn.ts`'s `runCli(args, cwd, options)` takes an OPTIONS object. Passing `{ env }` to the local wrapper gives the spawned child an environment with a single variable literally named `env` — PATH is silently lost and any PATH-based assertion in a `tools.test.ts` case fails in a way that looks like a product bug (for us: the CLI child found the host's real docker). Cheap hardening: rename the local wrapper (e.g. `runCliWithEnv`) or assert the child's env once in that file. Left undone here (out of scope, and a sibling worker's fence risk).

### handoff 2026-10-02 @ses_f055baad1ffeJBgIqkg18b8dKY (session: ses_f055baad1ffeJBgIqkg18b8dKY) — next: Review + merge PR #574, then flip the item done (acceptance ticked, all gates green).
- branch: feat/task-native-cleanup-compose-parity
- open questions: Bundle conflicts expected on merge — regenerate after merging main, never hand-edit; local runCli(env) vs test-spawn runCli({env}) footgun left unfiled for the coordinator
