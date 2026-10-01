---
type: bug
status: in_progress
id: bug-row-table-flake
title: row-table-stdout-ci-flake
assignee: Arggon
branch: fix/bug-row-table-flake
parent: ci-stability
labels: []
priority: p2
created: "2026-09-30"
updated: "2026-09-30"
claimed_at: "2026-09-30T23:56:00.472Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-row-table-flake
---

<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/bug-row-table-flake.md
  Leaves live only under a story. id is the filename stem: bug-row-table-flake.
  CLI `arggon create bug row-table-flake` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# row-table-stdout-ci-flake

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ]

## Notes

### 2026-09-30 @Arggon

### Evidence (twice, unrelated PRs)

`cli/src/row-table-stdout.test.ts > row/table stdout: list > escapes the id/title/assignee/branch cells (no raw control, one inert row)` fails in CI with `expected 1 to be +0` (raw-control-char count) on PRs whose diffs do not touch row-table code:

- PR #475 (TUI sort/ready lens) — run 36740682070, 2026-09-30 ~16:01; passed on rebase + locally twice; CI green after re-push.
- PR #487 (board move dialogs) — run 36758776399, 2026-09-30 ~18:32; passes locally on main and in the same PR's later run.

Passes consistently locally and on main. Suspect cross-test interference under CI load (shared stdout capture or a global buffer across concurrently running files), not product behavior.

### Acceptance checklist

- [x] Reproduce or instrument: run the full suite 5x locally and 3x in CI (or with --sequence.shuffle) until the failure is caught; identify the interfering writer.
- [x] Fix the interference (isolate stdout capture, or make the assertion test single-file) — not by deleting the assertion.
- [ ] Full suite green 3 consecutive CI runs on a branch touching unrelated code.

### 2026-09-30 @Arggon

Mitigation shipped (coordinator): the escape-gate test keeps its strict assertion but gets one CI-only retry (options-object retry:1 under CI, none locally) — cli/src/row-table-stdout.test.ts. Rationale: 3 failures across hundreds of runs, all under CI load, exactly one raw control char in the spawned process's stdout, never reproducible locally or on retry — environmental noise, not product behavior. Root cause stays open on this bug: reproduce (CI --sequence.shuffle / 5x loops), find the interfering writer, remove the retry.

### 2026-09-30 @Arggon

### Root cause found — the "one raw control char" diagnosis was wrong

Pulled both CI logs. The failing assertion in BOTH runs is the exit-status check, not an UNSAFE match:

- PR #475, run 36740682070: `AssertionError: expected 1 to be +0` at row-table-stdout.test.ts:199:25 — at head eba19cda line 199 col 25 is `expect(proc.status).toBe(0)`. The spawned `arggon list` chain EXITED 1.
- PR #487, run 36758776399 attempt 1: identical signature (199:25). (Run 36764572794 on the same PR is an unrelated failure: a TS syntax error in e2e/board.smoke.spec.ts on that push.)

So stdout assertions never ran; no control-char count ever existed. A stdout capture also cannot be shared across files: `runCli` uses `spawnSync` with default `stdio: 'pipe'` — each child owns its pipe. The plain-`list` child path is pure (fs walk + formatListTable + one stdout write; no git/gh subprocess), so a fixed input cannot flake through product code. The only nondeterminism in the chain is its infrastructure: the tsx wrapper (`tsx/dist/cli.mjs`) re-executes node as a second child and hosts a per-spawn IPC server at `/tmp/tsx-<uid>/<pid>.pipe` whose `mkdir/rm/listen` sequence has no error handling (any rejection → wrapper exits 1).

Reproduction attempts (all logged under /tmp/opencode/flake-hunt): 325 sequential spawns under 12-core saturation (0 failures); 480 parallel spawns across 12 workers (0 failures); 6 full-suite runs under artificial overload (row-table never failed; other spawn-heavy files — headless-ci, pack-contents, success-stdout, prose-format — failed with 30s timeouts and the same exit-1 signature, showing the suite's spawn chains are environmentally sensitive under load). No local repro of the exact CI event; identification is from the CI logs plus chain analysis.

### Fix (this branch)

1. `runCli` spawns `node --import <abs tsx loader> cli.ts …` directly — ONE node process, no tsx wrapper, no per-spawn IPC socket; the whole transient class is removed. Stdout bytes asserted are unchanged (same CLI, same loader).
2. The status assertion now carries stderr/stdout/signal in its message — a recurrence is immediately diagnosable instead of retry-masked.
3. CI-only `retry: 1` REMOVED (the acceptance condition: the fix makes it unnecessary — the flaky layer is gone, and any recurrence now self-reports its stderr).
4. Assertion strictness unchanged: UNSAFE gate, discrimination checks, empty stderr all intact.

Gates: npm test 1936/1936 green (+ shuffled runs; 400-spawn sequential hammer on the new chain clean); lint, build, check:plugin (bundle unchanged), arggon validate ok. Full-suite-green-in-CI (3 runs) intentionally left to the coordinator.


diff --git a/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md b/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md
index 3fc2de78..6807f2a6 100644
--- a/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md
++ b/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md
@@ -48,3 +48,24 @@ Mitigation shipped (coordinator): the escape-gate test keeps its strict assertio
 ### handoff 2026-10-01 @ses_f0b410d33ffexCqDkkRw4DH8bG (session: ses_f0b410d33ffexCqDkkRw4DH8bG) — next: Coordinator: review PR #513 and run 3 consecutive CI runs on the branch to confirm the flake is gone
 - branch: fix/bug-row-table-flake
 - open questions: Migrate other runCli spawn helpers (success-stdout, doctor, validate, headless-ci) to --import tsx too? File separate item for load-sensitive headless-ci/pack flakes seen under overload

### 2026-10-01 @ses_f0b410d33ffexCqDkkRw4DH8bG
### Evidence (subagent, 2026-09-30)

**Misdiagnosis corrected, from the CI logs themselves:**
- PR #475 run 36740682070 log: `AssertionError: expected 1 to be +0` at row-table-stdout.test.ts:199:25; at head eba19cda that line/col is `expect(proc.status).toBe(0)` — the spawned CLI chain exited 1. stdout assertions never ran; no raw-control-char count ever existed.
- PR #487 run 36758776399 attempt 1 log: identical 199:25 signature. (36764572794 on the same PR is unrelated — TS1005 in e2e/board.smoke.spec.ts on that push.)

**Why the interference theory is mechanically impossible:** runCli uses spawnSync with default stdio:'pipe' — per-child pipes, no shared capture. Plain `arggon list` is pure (fs walk + formatListTable + one stdout write; no git/gh subprocess; resolveCurrentLogin only fires for @me).

**Leading writer:** the tsx wrapper CLI (tsx/dist/cli.mjs) re-executes node as a second child and hosts a per-spawn IPC server at /tmp/tsx-<uid>/<pid>.pipe with NO error handling around mkdir/rm/listen — any transient rejection exits the chain 1, matching the rare/load-dependent/exit-1/invisible-stderr signature.

**Reproduction/instrumentation log:**
- 325 sequential spawns of the exact list command under 12-core CPU saturation (old chain): 0 failures.
- 480 parallel spawns, 12 workers (old chain): 0 failures.
- 6 full-suite runs under artificial overload + shuffle: row-table never failed; headless-ci/pack-contents/success-stdout/prose-format showed timeouts and the same transient exit-1 signature under load (evidence the suite's spawn chains are environmentally sensitive; also observed live while a sibling session's suite ran concurrently).
- No exact local repro of the CI event; identification is from CI logs + chain analysis. Instrumentation added (kept): status assertion now embeds stderr/stdout/signal so any recurrence self-reports.

**Fix (PR #513, branch fix/bug-row-table-flake):** runCli spawns `node --import <abs tsx loader>` (one process, no wrapper, no IPC socket; stdout bytes unchanged); CI-only retry:1 removed; assertion strictness unchanged (UNSAFE gate + discrimination + empty stderr).

**Gates:** npm test 1936/1936 green (+shuffled); 400-spawn sequential hammer on the new chain clean; npm run lint ok; npm run build ok; npm run check:plugin ok (bundle unchanged); arggon validate ok:true. Full-suite-green-in-CI (3 runs) left to coordinator per instructions.

diff --git a/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md b/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md
index 517c5bab..3fc2de78 100644
--- a/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md
++ b/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md
@@ -44,3 +44,7 @@ Passes consistently locally and on main. Suspect cross-test interference under C
 
 ### 2026-09-30 @Arggon
 Mitigation shipped (coordinator): the escape-gate test keeps its strict assertion but gets one CI-only retry (options-object retry:1 under CI, none locally) — cli/src/row-table-stdout.test.ts. Rationale: 3 failures across hundreds of runs, all under CI load, exactly one raw control char in the spawned process's stdout, never reproducible locally or on retry — environmental noise, not product behavior. Root cause stays open on this bug: reproduce (CI --sequence.shuffle / 5x loops), find the interfering writer, remove the retry.

### handoff 2026-10-01 @ses_f0b410d33ffexCqDkkRw4DH8bG (session: ses_f0b410d33ffexCqDkkRw4DH8bG) — next: Coordinator: review PR #513 and run 3 consecutive CI runs on the branch to confirm the flake is gone
- branch: fix/bug-row-table-flake
- open questions: Migrate other runCli spawn helpers (success-stdout, doctor, validate, headless-ci) to --import tsx too? File separate item for load-sensitive headless-ci/pack flakes seen under overload

diff --git a/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md b/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md
index 6807f2a6..25019150 100644
--- a/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md
++ b/ArggonManager/agent-native/ecosystem-ops/ci-stability/bug-row-table-flake.md
@@ -69,3 +69,14 @@ Mitigation shipped (coordinator): the escape-gate test keeps its strict assertio
 **Fix (PR #513, branch fix/bug-row-table-flake):** runCli spawns `node --import <abs tsx loader>` (one process, no wrapper, no IPC socket; stdout bytes unchanged); CI-only retry:1 removed; assertion strictness unchanged (UNSAFE gate + discrimination + empty stderr).
 
 **Gates:** npm test 1936/1936 green (+shuffled); 400-spawn sequential hammer on the new chain clean; npm run lint ok; npm run build ok; npm run check:plugin ok (bundle unchanged); arggon validate ok:true. Full-suite-green-in-CI (3 runs) left to coordinator per instructions.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
verdict: approve (lead-architect review, PR #513)
- Forensics confirmed by the reviewer from primary sources: both CI failures died at the exit-status assertion (row-table-stdout.test.ts:199:25, expect(status).toBe(0) got 1, pinned SHA eba19cda) — the stdout assertions never ran; the "one raw control char" theory is dead; run 36764572794 was an unrelated e2e syntax error.
- Architecture of the fix: single-process spawn (node --import <abs tsx loader>) removes the wrapper's re-exec + per-spawn IPC server surface entirely; runCli is file-local so blast radius is exactly this suite; loader path absolute; stdio/capture unchanged.
- Strictness: retry removed, every assertion preserved verbatim (UNSAFE gate, discrimination checks, empty stderr); the status assertion now self-reports stderr/stdout/signal — any recurrence is diagnosable, not retry-masked. Negative control intact from the diff.
- Tests/evidence: coordinator independent runs — 18/18 in the worktree, 10/10 consecutive green; worker's 325+480 spawn loops and 6 overload runs on record. NOTE on tick reading: the reproduce/instrument box is satisfied as "root-caused from CI logs + chain analysis" (failure never reproduced locally; the item body is transparent about this).
- Scope: exactly 2 files (test + item); no product code, no bundle. Conventions clean.
- The last acceptance box (3 green CI runs) is coordinator-owned and stays open through post-merge verification on main.
- Merged: squash (CI cli/tasks-validate/ui-smoke green on the reconciled head).
