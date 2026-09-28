---
type: task
status: in_progress
id: task-native-start-cold-smoke
title: Add native start cold-start smoke with a dependency-requiring pre-commit gate
assignee: Arggon
branch: feat/task-native-start-cold-smoke
parent: ui-foundation
labels: [opencode-seam, worktree, smoke]
priority: p2
created: "2026-09-24"
updated: "2026-09-28"
claimed_at: "2026-09-28T22:45:52.890Z"
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
