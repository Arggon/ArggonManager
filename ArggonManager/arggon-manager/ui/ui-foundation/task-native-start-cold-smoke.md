---
type: task
status: done
id: task-native-start-cold-smoke
title: Add native start cold-start smoke with a dependency-requiring pre-commit gate
assignee: Arggon
branch: feat/task-native-start-cold-smoke
parent: ui-foundation
labels: [opencode-seam, worktree, smoke]
priority: p2
created: "2026-09-24"
updated: "2026-09-28"
depends_on: [bug-native-start-worktree-no-install, task-ast-grep-structural-rules]
worktree_path: /home/arggon/Projects/ArggonManager-task-native-start-cold-smoke
---
<!--
  Placement (v0): ArggonManager/arggon-manager/ui/ui-foundation/task-native-start-cold-smoke.md
  Leaves live only under a story. id is the filename stem: task-native-start-cold-smoke.
  CLI `arggon create task native-start-cold-smoke` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Add native start cold-start smoke with a dependency-requiring pre-commit gate

## Context

Add a durable cold-start smoke for the native worktree path after `bug-native-start-worktree-no-install` lands. The existing CLI integration coverage proves link preparation, but the native tool path has repeatedly created a cold worktree whose dependency-requiring pre-commit gate could not run and whose claim commit was silently absent. The smoke must exercise the real native `tools.arggon.start` domain seam, not re-test only the CLI helper.

## Acceptance

- [x] Build a disposable git/OpenCode fixture whose primary checkout has a project install and whose fresh worktree starts without `node_modules`.
- [x] Install an executable dependency-requiring pre-commit gate and a marker proving the gate ran; never bypass it with `--no-verify`.
- [x] Invoke the actual native `tools.arggon.start` path and require an explicit readiness/claim-commit result, a present dependency preparation, and a claim commit containing only the item file.
- [x] Re-run start and prove deterministic attach, no duplicate claim commit, and no mutation or emptying of the primary checkout install.
- [x] Prove the smoke cleans every fixture/worktree process and writes only inside its disposable roots; any required `node_modules` report/receipt stays bounded.
- [x] Add a deterministic repository smoke command and document how maintainers run it; keep the model-driven wave smoke separate.
- [x] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, the new cold-start smoke, and `arggon validate` are green, with expected-vs-observed evidence in the PR.

## Notes

### 2026-09-28 @Arggon
## Evidence — native start cold-start smoke

New: `smoke/native-start-cold-smoke.ts` + `smoke/native-start-cold-smoke.test.ts` (15 unit tests on the pure predicates), one npm script `smoke:native-start-cold`, docs in `CONTRIBUTING.md`, `ArggonManager/docs/agents.md` (§Orchestration), `ArggonManager/docs/engineering.md` (§Smoke test) and `ArggonManager/docs/opencode2.md` (§Verify it works).

**Runtime that executed** (printed by the smoke and asserted to live inside this checkout — no stale vendored bundle, no primary build):

```
runtime: plugin /home/arggon/Projects/ArggonManager-task-native-start-cold-smoke/opencode/plugins/arggon/index.ts
runtime: kernel /home/arggon/Projects/ArggonManager-task-native-start-cold-smoke/lib/dist/index.js
```

The harness drives the real native seam: this checkout's `opencode/plugins/arggon/index.ts` through `argonToolDefinitions` (`tools.arggon.start`), with a `ctx.worktree` domain double backed by real `git worktree` (the 2.0.10 Git strategy probed for W4). It is model-free — no OpenCode runtime, no provider, no quota. Fresh `tsx` process per invocation, so no long-lived session's module cache can serve a stale plugin build.

### `npm run smoke:native-start-cold` — expected 20/20 `ok`, exit 0; observed:

```
  ok   the runtime is this checkout's own plugin source and kernel build (no stale vendored/primary copy)
  ok   the fixture primary checkout has a project install and a dependency-requiring pre-commit gate
  ok   a cold worktree has no install, and the gate fails its commit there (no --no-verify)
  ok   the cold-probe worktree is removed again
  ok   start creates the cold worktree through the domain and claims the item there
  ok   the dependency preparation is explicit and ready before the claim commit
  ok   the readiness/claim-commit receipt stays bounded
  ok   the claim commit landed and the gate ran in the worktree it prepared
  ok   the claim commit contains only the item file
  ok   the worktree's prepared install is untracked and never committed
  ok   the fixture primary install is untouched by the claim commit
  ok   the canonical checkout's install is untouched (never emptied or reified)
  ok   a second start attaches to the same worktree (one domain create, no re-creation)
  ok   the re-run adds no duplicate claim commit
  ok   the claim records live in the worktree copy, not in the canonical checkout
  ok   the canonical checkout's install is still untouched after the re-run
  ok   the worktree and its git registration are gone
  ok   the disposable root is removed
  ok   this checkout is unchanged (the smoke wrote only inside its disposable root)
  ok   the canonical checkout's install is untouched after teardown
```

Per box:

1. **Disposable fixture, cold worktree.** `mkdtemp` root holds `repo/` (primary) + `repo-task-cold-start-smoke/` (worktree) + `cold-probe/`. The primary carries a tracker (`runInit` + 4 items) and an install (`node_modules/native-gate-dep`, `node_modules/.package-lock.json`). The gate proves the fresh worktree is cold: `!existsSync(<probe>/node_modules)`, the probe's `git commit` exits non-zero and no marker is written.
2. **Real, executable, dependency-requiring gate.** `.git/hooks/pre-commit`, mode `755` (asserted), body: `node -e "require('native-gate-dep')"` else `echo "cold-start gate: dependency native-gate-dep is not installed" >&2; exit 1`; on success `printf 'gate ran in %s\n' "$PWD" >> .native-gate-ran`. **Proven both ways** — it fails in the cold probe worktree (stderr contains the message, marker absent) and passes in the prepared worktree (marker equals `gate ran in <worktree>`, i.e. the hook ran in the worktree start created). No `--no-verify`, no `core.hooksPath` override, no skipped hook anywhere; `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` are nulled for the run so a machine-global hooks path cannot move the gate.
3. **Actual native `tools.arggon.start`.** Observed receipt: `preparation = {"ready":true,"install":"linked","linkedNodeModules":true,"builtWorkspaces":[],"linkedWorkspaces":[]}`, `claimCommitted: true`, `claimCommit = {"status":"committed","committed":true,"hash":…}`, `commit.message = "chore(tasks): claimed task-cold-start-smoke"`, one domain `create` call, `worktreeCreated: true`, `worktreePath = <parent>/repo-task-cold-start-smoke`. The claim commit's file list is exactly `ArggonManager/native-start/worktree/cold-start/task-cold-start-smoke.md` — asserted by `claimCommitFaults` (extra path **or** missing item file is a failure), with `node_modules` proven present-but-untracked in the worktree and absent from the commit.
4. **Re-run.** `worktreeCreated: false`, same `worktreePath`, domain `create` calls still `1`, `HEAD` unchanged (`88027fc3 -> 88027fc3` in one run), exactly **1** commit with subject `chore(tasks): claimed task-cold-start-smoke` on the branch, receipt `{"status":"not-needed","committed":true}`. Claim records live in the worktree copy (`status: in_progress`, `assignee: cold-smoke`, `branch`, `worktree_path`) while the canonical copy stays `todo`. Both installs re-fingerprinted after the re-run: zero drift.
5. **Cleanup and bounds.** Every spawn is `spawnSync` or awaited by the plugin, so nothing is left running; teardown removes both worktrees, prunes the registration (asserted: no `worktree` entry outside the fixture primary), and deletes the disposable root. This checkout's `git status --porcelain --untracked-files=all` is byte-identical before/after. Receipt bounds are enforced by `receiptOverBudget` (32 names, 200 chars/name, 500 chars/value, 1024 bytes/receipt) and unit-tested.
6. **Command + docs.** `npm run smoke:native-start-cold` (exit `0` pass / `1` check failed, fixture kept / `2` harness could not run — verified by temporarily moving `lib/dist` aside: exit 2 with the actionable `npm run build` line). Documented in `CONTRIBUTING.md` (full scenario + how to run), `ArggonManager/docs/agents.md`, `ArggonManager/docs/engineering.md` and `ArggonManager/docs/opencode2.md`; the model-driven `smoke:opencode` / `smoke:opencode:wave` stay separate and are still documented as the runtime-level evidence.

### The smoke is a real gate, not a vacuous green

Mutation test (reverted before this commit): `linkNodeModules()` in `lib/src/worktree.ts` forced to `return false` — i.e. the pre-fix cold worktree — then `npm run build --workspace @arggondev/lib` and re-run. Expected: red. Observed: **exit 1** with exactly the shipped bug shape:

```
      harness error: native start failed (START_FAILED): start failed while committing the claim; the worktree was kept at … (nothing was rolled back). git commit failed: cold-start gate: dependency native-gate-dep is not installed. …
preparation: {"ready":false,"install":"unavailable","linkedNodeModules":false,"builtWorkspaces":[],"linkedWorkspaces":[]}
claimCommitted: false
claimCommit: {"status":"failed","committed":false,"skipped":"git commit failed: cold-start gate: dependency native-gate-dep is not installed"}
```

Then `git checkout -- lib/src/worktree.ts`, rebuild, re-run: 20/20 `ok`, exit 0.

### Repo gates (all run in this worktree)

- `npm test` → **98 files, 1661 tests passed** (includes the 15 new `smoke/native-start-cold-smoke.test.ts`)
- `npm run lint` → exit 0, no output
- `npm run build` → `build:plugin — 40 modules inlined, 370347 bytes`
- `npm run check:plugin` → exit 0 (committed bundle unchanged)
- `npm run lint:structure` → exit 0, no findings
- `npm run test:structure` → `native-tools-use-shared-seam` PASS, `tracker-mutations-use-kernel` PASS, `tracker-rename-destination-use-kernel` PASS
- `npm run arggon -- validate --json` → `{"ok":true,…,"errors":[],"warnings":[]}`
- `npm run smoke:native-start-cold` → 20/20 `ok`, exit 0
- pre-commit hook (`npm run --silent arggon -- validate`) ran on the commit: `arggon validate: ok (0 warning(s), convention v5)`

### Primary checkout untouched

`/home/arggon/Projects/ArggonManager/node_modules` has **120** top-level entries after every run and still resolves `tsx`, `vitest`, `commander`, `eslint`, `@ast-grep`, `@arggondev`; its `git status --porcelain` is empty. The smoke asserts this itself, every run, from a before/after fingerprint of that exact directory (entry count + entry-set sha256 + mtime), three times per run.

### Notes / limits

- The fixture's "project install" is synthesized (`node_modules/native-gate-dep` + `.package-lock.json`), not a real `npm install` — the gate needs one resolvable package, and a real install would only add network dependency and runtime.
- One non-obvious git behavior worth knowing: git runs `pre-commit` even when there is nothing staged, so the re-run adds a second marker line and still exits non-zero ("nothing added to commit"). That is why "no duplicate claim commit" is asserted from `HEAD` + the claim-commit count + the `not-needed` receipt, not from the marker count.
- The `installFingerprint` mtime is a coarse-clock signal (Linux stamps a directory from the current tick) and is only compared between fingerprints of the same path; the count and the entry-set digest are the load-bearing "was it emptied?" signals. Both limits are pinned by unit tests.

### handoff 2026-09-28 @Arggon — next: Review the draft PR for feat/task-native-start-cold-smoke, then merge and flip the item to done.
- branch: feat/task-native-start-cold-smoke
- open questions: Wire the new smoke into a CI job or keep it maintainer-run?; Should smoke:opencode also cover the cold start once quota allows?

### 2026-09-28 @Arggon
## CI evidence (final head `c4f8af3e`) and two flakes CI caught

CI on PR #427, final run set (head `c4f8af3e`):

| Job                                                                     | Workflow | Run / job                                                                                                     | Result      |
| ----------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| `cli` (build, check:plugin, test, lint, test:structure, lint:structure) | CI       | [36497709487/109181044406](https://github.com/Arggon/ArggonManager/actions/runs/36497709487/job/109181044406) | **success** |
| `ui-smoke` (Playwright @smoke + `smoke:tui-board`)                      | CI       | [36497709487/109181044186](https://github.com/Arggon/ArggonManager/actions/runs/36497709487/job/109181044186) | **success** |
| `tasks-validate`                                                        | arggon   | [36497709488/109181044311](https://github.com/Arggon/ArggonManager/actions/runs/36497709488/job/109181044311) | **success** |

Two earlier runs failed **on my own new unit test**, not on the product, and both are fixed (each got its own commit, no rebase/force-push):

1. `d2e723ba` — `reports the emptied-install signature`: whether the kernel re-stamps a directory mtime on an unlink depends on the tick the removal lands in, so locally the drift list had 2 entries and on the runner 3 (`mtime 1790637146704.293 -> 1790637146704.8691`). Fixed by pinning the directory clock with `utimesSync` before comparing, so the test asserts the signal instead of the clock's luck.
2. `c4f8af3e` — `reports a reified install`: the CI runner's filesystem stored `…431.999` where the test asked `utimesSync` for `…432`, so the expected string built from `later.getTime()` did not match the value read back. Fixed by building the expectation from the fingerprint read back and asserting the delta is ≥ 59 s, which is what the check is actually about.

Both were real portability defects in my test, not flakes in the product or in the smoke. Locally after the fixes: `smoke/native-start-cold-smoke.test.ts` green 5/5 consecutive runs, full `npm test` 98 files / 1661 tests green, `npm run lint` clean, `npm run arggon -- validate --json` `ok:true`, `npm run smoke:native-start-cold` 20/20 `ok` (exit 0) re-run at the final head.

The lesson worth keeping for the next fingerprint-style helper: a directory `mtime` is only ever a coarse-clock, precision-dependent signal — compare it read-back-to-read-back, never against a value you set, and never across two different directories (already asserted in `installDrift` and pinned by tests).
### 2026-09-28 @Arggon-coordinator
## FINAL APPROVE — PR #427 (`f37c706a`)

I did not take the smoke evidence on trust. I **ran the gate myself in both directions** in the
worker's worktree, because "a new smoke passes" and "the new smoke would catch the bug" are
different claims and only the second one is worth merging. **Merge authorized; this comment performs
no merge and no `done` flip.**

### My own execution
- **Green, 20/20, exit 0.** Runtime self-identifies as *this* checkout's plugin source and kernel
  build — `…/ArggonManager-task-native-start-cold-smoke/opencode/plugins/arggon/index.ts` and
  `…/lib/dist/index.js` — so the stale-vendored-copy failure mode I hit in this very session cannot
  be what made it pass.
- **Red, exit 1, on the pre-fix behavior.** I gated `linkNodeModules` behind an env var (a mutation
  the worker's own test report had done unconditionally), rebuilt the kernel, and re-ran. Observed
  exactly the shipped bug shape: `preparation {"ready":false,"install":"unavailable","linkedNodeModules":false}`,
  `claimCommitted: false`, `claimCommit {"status":"failed","skipped":"git commit failed: cold-start
  gate: dependency native-gate-dep is not installed"}`, and the harness printing the **actionable**
  remedy (fix the gate cause, re-run `start`, it attaches and retries the claim) — not a raw stack.
  Then reverted, rebuilt, and re-ran: 20/20 again. The gate is falsifiable in both directions, which
  is the property the whole item exists to establish.

### Why this is a real gate and not a tautology
- The pre-commit hook is a **real executable, dependency-requiring gate** (mode asserted `755`,
  `require('native-gate-dep')` else `exit 1`), proven **both ways** inside one run: it fails on the
  cold probe worktree and passes in the worktree start prepared. No `--no-verify`, no
  `core.hooksPath` dodge — and the harness nulls `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` so a
  machine-global hooks path cannot silently move the gate. That is a real hermeticity decision, not
  boilerplate.
- It drives the **actual native seam** (`argonToolDefinitions` → `tools.arggon.start`) with a
  `ctx.worktree` double backed by real `git worktree`, and asserts the claim commit's file list is
  **exactly** the item file (extra path *or* missing file fails) while `node_modules` is
  present-but-untracked. That is the failure the P1 fix was about: a claim commit that is absent, or
  one that sweeps the install in.
- Re-run is checked for **deterministic attach**, not just success: one domain `create`, `HEAD`
  unchanged, exactly one claim commit, `not-needed` receipt, and claim records landing in the
  worktree copy while the canonical copy stays `todo`.
- **The primary install is protected and asserted three times per run** from a before/after
  fingerprint (entry count + entry-set sha256 + mtime) — and I confirmed the worktree is clean and
  the primary's own tree untouched after my own runs.
- Receipts are bounded and the bound is **enforced and unit-tested** (32 names, 200 chars/name, 500
  chars/value, 1024 bytes/receipt) — the ADR 0006 concern, not a comment.

### Review bar
- **Docs travel with code, in the right places**: `CONTRIBUTING.md` (full scenario), `agents.md`
  §Orchestration, `engineering.md` §Smoke test (a new "Native worktree/start changes" bullet, so the
  blocking smoke bar now names this gate), and `opencode2.md` §Verify it works. The model-driven
  `smoke:opencode`/`:wave` are explicitly kept **separate and still labeled** the runtime-level
  evidence — the item required that separation and the docs preserve it.
- **Scope:** 8 files, +1112/−10, of which 948 are the two new `smoke/` files. `package.json` gains
  exactly one script and no dependency; `package-lock.json` untouched; `smoke/opencode-smoke*.ts`
  untouched; no `opencode/plugins/**`. No cross-item edits.
- **Security/hygiene:** `GIT_CONFIG_*` neutralized, disposable roots under `$TMPDIR`, the fixture
  kept on failure for inspection and deleted on success, and the harness distinguishes
  exit `1` (check failed) from exit `2` (harness cannot run) with an actionable `npm run build` line.

### Honesty checks that passed
The worker **self-reported two of its own new unit tests failing on the CI runner** and fixed them in
`d2e723ba`/`c4f8af3e` — directory-`mtime` tick/precision assumptions — naming them as real
portability defects in its test rather than flakes in the product. That is the disclosure I want. The
fix is also the right one: pin the directory clock with `utimesSync` and assert the *signal*, with
the general lesson recorded (compare mtime read-back-to-read-back, never across two directories).

### Limits recorded, and one decision left open
- The fixture's "project install" is **synthesized** (one resolvable package + `.package-lock.json`),
  not a real `npm install` — deliberate, and correct for an offline deterministic gate, but it means
  the gate proves *resolution*, not npm's reifier.
- The model-driven harness stays quota-blocked here (`opencode-go/deepseek-v4-flash`, "Go usage
  limit exceeded"). Not faked, and not load-bearing for this item.
- A run that crossed local **midnight** could see `updated` change and land a second claim commit;
  the window is 1/86400 and it fails loudly with a clear reason. Correct to leave, worth knowing.
- **Open question left on the item and answered here: CI wiring.** The acceptance asked for "a
  deterministic repository smoke command and document how maintainers run it", which is met — the
  command is documented in four places. But a maintainer-run gate protecting a P1 is weaker than a
  CI-enforced one, and `lint:structure`/`test:structure` already run in the `cli` job. I am **not**
  forcing a workflow change into this PR (it is unowned surface, and the model-free claim is exactly
  what makes it a candidate); I will file it as a follow-up for an explicit decision.

### 2026-09-28 @Arggon-coordinator
### Follow-up filed (coordinator, 2026-09-28)

The CI-wiring open question raised in my verdict is now tracked as
`task-wire-native-start-cold-smoke-into-ci` (p3, parent `ui-foundation`). This PR deliberately does
not touch `.github/workflows/**`: the gate is model-free and deterministic, which makes it a good CI
citizen, but the lane belongs to a separate, explicitly-owned change rather than riding in on a smoke
PR. No blocker on this item either way — the command is real, documented in four places, and
falsifiable today.
