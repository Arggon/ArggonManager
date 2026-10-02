---
type: bug
status: done
id: bug-cli-spawn-suites-exit-1-flake
title: "CI flake: suites that SPAWN the CLI intermittently exit 1 (handoff lib/dist import error; row-table-stdout adopt --ack)"
assignee: Arggon
branch: fix/bug-cli-spawn-suites-exit-1-flake
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [ci, flaky]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
worktree_path: /home/arggon/Projects/ArggonManager-bug-cli-spawn-suites-exit-1-flake
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

- [x] Reproduce by running the spawn-heavy suites repeatedly at CI parallelism on a loaded machine; identify the failing spawn (ECONNREFUSED/EPIPE/EMFILE/OOM/timeout). **Not a spawn failure at all** — see the resolution below: the child was launched and died inside Node's ESM loader. The failing spawn is identified as `child-boot-failed`; the "spawn pressure" premise is disproved (640 concurrent hammer spawns, 400 of them at concurrency 16 with 10 CPU burners and `ulimit -n 1024`, produced zero failures).
- [x] Fix at the spawn/runner level — bounded concurrency, or a serial lane for process-spawning suites, or retry-on-spawn-failure — NOT per test. Neither of the three named levers addresses the real cause (a concurrent _writer_), so the fix is at the writer + harness level instead: the lane that rebuilt the shared artifact in place under live readers no longer rebuilds (`npm pack --ignore-scripts`), plus a harness-level classifier in `cli/src/test-spawn.ts`. No per-test change, no assertion weakened.
- [x] Scope: every suite that spawns the CLI (handoff, row-table-stdout, board/tui, comment-race, headless), not the two observed files. The cause is fixed once, for all of them, because it was never suite-specific. `headless-ci.test.ts` is the single lane that mutates the artifact every other lane reads.
- [x] Keep the existing dry-run/ordering discipline: a spawn failure must be distinguishable from a real assertion failure in the test output. `runCli` now raises a typed `SpawnHarnessError` (`kind`, argv, cwd, status, signal, spawn error, child stderr/stdout, plus whether the kernel artifact moved during the spawn) for the three classes in which no CLI result exists; a real non-zero `arggon` exit is still returned untouched.

### 2026-10-02 @Coordinator

### 2026-10-02 @Coordinator — third instance, priority raised to p2

PR #573's first `cli` run failed with the same shape in a THIRD different test: `row-table-stdout.test.ts > adopt skip path > escapes the skip-path storyId…` → `expected 1 to be +0`. That makes three PRs in a row (#571 handoff, #576 adopt --ack, #573 adopt skip path) with a rerun-green spawned-CLI exit-1, i.e. roughly one in three PR CI runs is red for this class alone — every merge in this wave paid a rerun, so this is now the top CI-reliability item and should be worked next rather than left open.

Sharpened suspicion: every instance is a suite that spawns the real CLI (via tsx) under parallel vitest, and every instance is `expected 1 to be +0` with no assertion detail — consistent with the child being killed or failing to boot (EMFILE/EPIPE/EAGAIN under spawn pressure, or the runner's memory ceiling), NOT with a product assertion. A cheap discriminator to try first: have the failing spawn print its stderr in the test's failure message (the handoff instance already leaked a module-load stack, which is the kind of evidence that settles it).

### 2026-10-02 @Arggon
## Root cause: NOT spawn pressure — a lane rebuilding the shared kernel artifact in place, under live readers

### 1. The CI stderr (recovered, not inferred)
`gh run view 36960202458 --attempt 1 --log-failed` (PR #571 attempt 1):

```
FAIL cli/src/handoff.test.ts > handoff CLI > passes --session through the CLI flag into the heading (provenance)
AssertionError: file:///home/runner/work/ArggonManager/ArggonManager/lib/dist/create.js:9
import { assertParentEdge, expectedParentType } from "./relations.js";
SyntaxError: The requested module './relations.js' does not provide an export named 'assertParentEdge'
    at ModuleJob._instantiate (node:internal/modules/esm/module_job:226:21)
    at async ModuleJob.run (node:internal/modules/esm/module_job:335:5)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
Node.js v22.23.3
: expected 1 to be +0 // Object.is equality
```

`assertParentEdge` IS a plain `export function` in `lib/src/relations.ts`, so `tsc` always emits it. The only way the built module lacks it is that the child read the file mid-rewrite. Same run: `npm run test` duration 266.82s, Node v22.23.3.
PR #573 run 36966932103 fails at the same class (`adoptSkipTree` line 447 = `runCli(["init", dir], dir)`), and in BOTH runs `cli/src/pack-contents.test.ts` (23.5s / 23.6s) is the last file reported before the failure block.

### 2. Deterministic reproduction of that exact error
Truncating `lib/dist/relations.js` and spawning the real CLI through the shared harness:

```
case A: relations.js EMPTY  -> exit=1  SyntaxError: The requested module './relations.js' does not provide an export named 'assertParentEdge'
case B: relations.js PARTIAL -> exit=1  SyntaxError: Unexpected token 'export'
case C: restored (control)  -> exit=0
```

Case A is byte-identical to the CI capture, including the `create.js:9` frame.

### 3. Who rewrites it
`cli/src/headless-ci.test.ts:193` ran `npm pack --pack-destination <dir>` with cwd = `[<root>/lib, <root>]`. `npm pack` in the repo ROOT runs the `prepare` lifecycle = `npm run build` = 4 `tsc` passes, which rewrite every file of `lib/dist` and `dist` IN PLACE (same inode, mtime bumped: `lib/dist/relations.js` 02:39:20 -> 02:47:57 on a single pack).

Measured with a 25ms poller on `lib/dist` + `dist` during a real GREEN full-suite run:

```
+12090ms..+12567ms   77 x lib/dist/*   rewritten (open(O_TRUNC)+write per file)
+22795ms..+23370ms   63 x dist/*       rewritten
+36809ms             dist/build-info.json  (postbuild -> write-build-info.mjs)
TOTAL MUTATIONS: 141      (142/143 on two further runs)
```

The spawned CLI's own sources are transpiled in memory, but `@arggondev/lib` resolves to `lib/dist` on disk — so every other lane's children ESM-load exactly the files that lane is rewriting, ~1.2s of every run.

The two sibling lanes that DO build on purpose are safe by construction: `pack-contents.test.ts` and `lib-build.test.ts` build in a fresh clone copy that owns its own `lib/` (verified: `npm pack` in that copy leaves the primary's `lib/dist` byte- and mtime-identical). `headless-ci.test.ts` is the only lane whose cwd is the repo.

### 4. Spawn pressure disproved
Direct hammer on the shared spawn chain: 240 spawns at concurrency 8 clean; 400 spawns at concurrency 16 with 10 CPU burners (load avg 11.5) and `ulimit -n 1024` clean. 8 stress iterations of the spawn-heavy suites at CI parallelism under 8 burners: 0 failures. No EMFILE/EAGAIN/EPIPE/OOM/kill signal anywhere.

### 5. End-to-end race: NOT reproduced locally (reported honestly)
The per-file truncate window is sub-millisecond and this box's I/O does not widen it the way the CI runner's does. Attempts, all with the PRE-FIX pack in place: 2 loaded full-suite runs (12 - 9 CPU burners, maxWorkers=3, 331s each) = 0 collisions; 6 runs of headless-ci + 4 spawn suites = 0; an amplified run repeating the same writer for 14 then 22 cycles against 6-8 concurrent spawn lanes (x5) = 0. Total ~120 rewrite windows with no hit. The mechanism above is established from the CI log, the deterministic case-A reproduction and the measured 141 rewrites; the collision itself only reproduces on the runner.

### Fix
- `cli/src/headless-ci.test.ts`: `npm pack --ignore-scripts` — pack the bytes `npm run build` already produced (the two `existsSync(dist/cli.js)` / `existsSync(lib/dist/index.js)` assertions above ARE the build-before-test precondition), and never rebuild the shared artifact under the suite.
- `cli/src/test-spawn.ts`: `classifySpawnFailure()` (pure, exported) + `SpawnHarnessError`. `runCli` raises it for `spawn-error` / `signalled` / `child-boot-failed` — the classes where the test observed no CLI result at all — carrying argv, cwd, status, signal, spawn error, the child's own stderr/stdout, and a `size:mtimeMs` fingerprint check of `lib/dist/index.js`, `lib/dist/create.js` and `dist/cli.js` taken around the spawn, so a recurrence names the rewriting lane instead of guessing. `program-exit` (a real non-zero `arggon` code) is returned untouched, so the ~30 tests asserting non-zero exits are unaffected.
- `cli/src/test-spawn.test.ts`: pins the classifier against the verbatim CI stderr, guards against over-eager classification (a CLI envelope quoting `Cannot find module` as data stays `program-exit`), and pins `--ignore-scripts` on the in-repo pack.

No retry was added: with the writer gone there is nothing transient left to retry, and retrying a link failure would mask a genuinely stale `dist/` — which `lib-build.test.ts` and `headless-ci.test.ts` deliberately assert on.

### After: the writer is gone
Same poller, same full suite, post-fix: `TOTAL MUTATIONS: 0` (was 141-143). Suite duration 133s -> 63.97s, because the redundant 4x `tsc` no longer runs under the suite.

### Gates (worktree, branch fix/bug-cli-spawn-suites-exit-1-flake)
npm test 117 files / 2147 tests pass | npm run lint rc=0 | npm run build rc=0 | npm run check:plugin rc=0 | npm run arggon -- validate: ok (0 warning(s), convention v5). Plugin bundle NOT in the diff.

### handoff 2026-10-02 @Arggon (session: ses_f04e06d6effesjYkcieGbj4zMn) — next: Review PR #580; merge after CI is green, then flip the item done and archive the worktree (tools.arggon.cleanup {prune:true}).
- branch: fix/bug-cli-spawn-suites-exit-1-flake
- open questions: End-to-end race did not reproduce locally (~120 rewrite windows, 0 hits) - accept CI as the oracle? spawnNodeCli (claim-race/cascade/board-serve) gets the root-cause fix but NOT the typed error; asyn…
