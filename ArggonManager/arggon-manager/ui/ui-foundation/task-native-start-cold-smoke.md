---
type: task
status: todo
id: task-native-start-cold-smoke
title: Add native start cold-start smoke with a dependency-requiring pre-commit gate
parent: ui-foundation
labels: [opencode-seam, worktree, smoke]
priority: p2
created: "2026-09-24"
updated: "2026-09-24"
depends_on: [bug-native-start-worktree-no-install, task-ast-grep-structural-rules]
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

- [ ] Build a disposable git/OpenCode fixture whose primary checkout has a project install and whose fresh worktree starts without `node_modules`.
- [ ] Install an executable dependency-requiring pre-commit gate and a marker proving the gate ran; never bypass it with `--no-verify`.
- [ ] Invoke the actual native `tools.arggon.start` path and require an explicit readiness/claim-commit result, a present dependency preparation, and a claim commit containing only the item file.
- [ ] Re-run start and prove deterministic attach, no duplicate claim commit, and no mutation or emptying of the primary checkout install.
- [ ] Prove the smoke cleans every fixture/worktree process and writes only inside its disposable roots; any required `node_modules` report/receipt stays bounded.
- [ ] Add a deterministic repository smoke command and document how maintainers run it; keep the model-driven wave smoke separate.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin`, the new cold-start smoke, and `arggon validate` are green, with expected-vs-observed evidence in the PR.

## Notes

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
