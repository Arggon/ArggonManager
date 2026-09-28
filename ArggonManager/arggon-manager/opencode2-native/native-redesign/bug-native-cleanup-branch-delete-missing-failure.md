---
type: bug
status: done
id: bug-native-cleanup-branch-delete-missing-failure
title: "Native cleanup branch-delete failure is reported in pruned but omitted from failures[]"
assignee: Arggon
branch: fix/bug-native-cleanup-branch-delete-missing-failure
parent: native-redesign
labels: [opencode-seam, worktree, review-followup]
priority: p3
created: "2026-09-28"
updated: "2026-09-28"
worktree_path: /home/arggon/Projects/ArggonManager-bug-native-cleanup-branch-delete-missing-failure
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-native-cleanup-branch-delete-missing-failure.md
  Leaves live only under a story. id is the filename stem: bug-native-cleanup-branch-delete-missing-failure.
  CLI `arggon create bug native-cleanup-branch-delete-missing-failure` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native cleanup branch-delete failure is reported in pruned but omitted from failures[]

## Context

PR #421 review verified a pre-existing native cleanup inconsistency: when worktree removal succeeds (or the recorded path is already missing) but branch deletion fails, `nativeCleanup` appends `pruned: [{ id, action: "failed", error, leftoverBranch }]` and may still clear/commit the record, yet it does not append the corresponding `<id>: <error>` entry to `failures[]`. The documented contract says per-item prune failures appear in both `pruned` and `failures`, and the CLI path does so. This predates PR #421 and is not absorbed into that scoped PR.

## Acceptance

- [x] Every native branch-delete failure appends a bounded `<id>: <error>` entry to `failures[]` as well as the structured `pruned` failure. (A `pruned` failure for the branch delete already existed; only the flat entry was missing. The inner catch now pushes `boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)` into `failures` and reuses that same message for `pruned` — one bounded text on both surfaces. Pinned by the new test: `failures == ["task-rate-limit: <500-char message>"]`.)
- [x] Per-candidate continuation and the existing record-clearing semantics after an observed worktree removal remain unchanged. (The new test asserts the full `pruned` sequence: failed → cleared for the failing candidate, then the second candidate still prunes end to end, both records cleared in ONE commit. The outer catch, the removal branch and the clearing block are untouched in the diff — 8 added lines inside the branch-delete catch only.)
- [x] Add a deterministic test for `git branch -d/-D` failure with no domain dependency. (`cleanup prune reports a branch-delete failure on both surfaces and keeps pruning`: no `worktree` option at all, stale worktree records so no removal step runs, and a `defaultCleanupGit` wrapper that refuses `deleteBranch` + `deleteBranchForce` for one candidate. `-D` shares the one catch; its `via` entry point is unreachable here because the native path shells out to the real `gh`. Fails without the fix: `expected 867 to be 500`, then `expected [] to deeply equal [Array(1)]`.)
- [x] Update the json-output contract only if needed to make the two failure surfaces explicit. (Not needed: `docs/json-output.md` §`cleanup` already documents `leftoverBranch` on the failed `pruned` action, `<id>: <message>` in `failures`, and states that per-item prune failures appear in BOTH. The code was the outlier, so the doc is unchanged.)
- [x] Full test, lint, build, `check:plugin`, and validate remain green. (`npm test` 1661/1661; `lint` clean; `build` ok; `check:plugin` exit 0 after committing the regenerated bundle; `lint:structure` exit 0; `test:structure` 3 passed; `validate --json` `ok:true`, no errors/warnings.)

## Notes

Review finding S7 on PR #421, 2026-09-28; verified byte-identical at `origin/main` before the PR.

### 2026-09-28 @Arggon
## Worker evidence (branch `fix/bug-native-cleanup-branch-delete-missing-failure`, commit `cae8b5fe`)

**Root cause.** In `nativeCleanup` (`opencode/plugins/arggon/index.ts`) the branch-delete step sits in its OWN inner `try`/`catch` (the "race: pre-flight passed, the delete failed" case). That catch pushed only the structured `pruned` entry `{ id, action: "failed", error, leftoverBranch }`; the `failures: string[]` array is filled exclusively by the OUTER per-candidate catch, so a branch-delete failure never reached the flat list. `failures[]` therefore was not a complete record of what went wrong: the envelope showed `ok: true`, a `failed` action, and `failures: []` — a false clean-run signal. Pre-existing at `origin/main`.

**A `pruned` action for the branch delete already existed**; only the flat entry was missing, so "as well as" meant adding the `failures[]` entry (not a new action).

**Fix** (8 added lines, `opencode/plugins/arggon/index.ts`): the branch-delete catch now builds `const message = boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)` — the same helper + 500-char cap the worktree-removal failure uses — pushes `` `${entry.id}: ${message}` `` to `failures`, and reuses that exact `message` for the `pruned` entry, so both surfaces always carry identical bounded text. Nothing else changed: per-candidate continuation, record-clearing semantics after an observed removal, classification, remote safety, the `via` field and the one-shared-commit logic are untouched.

**Test** (`opencode/plugins/arggon/tools.test.ts`, +84 lines, one case: "cleanup prune reports a branch-delete failure on both surfaces and keeps pruning"). Shape: **no worktree domain at all** — `argonToolDefinitions` gets no `worktree` option, so the git inventory fallback is used. Two `done` items carry a stale `worktree_path` (a path that never existed), which classification prunes as `clear stale worktree_path record` — no removal step, so the branch delete is the only step that can fail. A kernel wrapper overrides `defaultCleanupGit()` so `deleteBranch` AND `deleteBranchForce` throw for one candidate only (867-char message) while the other candidate still deletes.

**Expected vs observed**
- expected `failures: ["task-rate-limit: <bounded>"]`; observed exactly that, with `pruned` carrying the same 500-char `error` plus `leftoverBranch: "feat/task-rate-limit"`.
- expected bounded at the documented 500-char cap; observed `message.length === 500` and flat entry `<= 500 + id.length + 2`.
- expected continuation; observed `pruned` = `[failed(task-rate-limit), cleared(task-rate-limit), deleted branch feat/task-second, cleared(task-second)]` — the run continues AFTER the failure, both records cleared, ONE commit `chore(tasks): pruned task-rate-limit, task-second`; the leftover branch survives, the deleted one is gone.
- regression proof: with the `index.ts` fix stashed, the new test FAILS twice — `expected 867 to be 500` (unbounded `error`), and with that assertion relaxed `expected [] to deeply equal [ Array(1) ]` (the reported defect: `failures` empty). With the fix: 1 passed / 75 skipped.

**CLI: the same gap, filed separately.** `runCleanup` (`cli/src/cleanup.ts`, the inner catch at the `git branch -d` step) has the identical defect, and `cli/src/worktree.test.ts:1076` currently pins it with `expect(result.failures).toEqual([])`. This item's body claim that "the CLI path does so" is wrong — it does not. Filed `bug-cli-cleanup-branch-delete-missing-failure` (p3, parent `story-start-worktree`, the story that owns CLI cleanup, not `native-redesign`) with context and an acceptance list, via `arggon create` from inside this worktree so the file lands on this branch instead of the primary checkout's tree. No CLI file was touched.

**Gates (all run in this worktree)**
- `npm test` → Test Files 97 passed (97); Tests 1661 passed (1661).
- `npm run lint` → clean, no output.
- `npm run build` → lib build + `tsc -p tsconfig.json` + postbuild `build:plugin` (40 modules inlined, 372459 bytes) all pass.
- `npm run check:plugin` → regenerated the bundle; `git diff --exit-code` clean after committing source + bundle (exit 0).
- `npm run lint:structure` → exit 0; only the ambient `[warn] postinstall script did not run; falling back to runtime binary resolution` notice, no rule violations.
- `npm run test:structure` → `PASS native-tools-use-shared-seam` / `PASS tracker-mutations-use-kernel` / `PASS tracker-rename-destination-use-kernel`; `test result: ok. 3 passed; 0 failed;` (exit 0).
- `npm run arggon -- validate --json` → `{"ok":true,"schemaVersion":1,"conventionVersion":5,"command":"validate","layout":"arggon-manager","errors":[],"warnings":[]}`; the pre-commit hook also printed `arggon validate: ok (0 warning(s), convention v5)`.

**Docs.** `ArggonManager/docs/json-output.md` needed no change: the `pruned` row already names `leftoverBranch` for a failed branch delete, the `failures` row already documents `<id>: <message>`, and the §`cleanup` prose already states that per-item prune failures "appear in `pruned` (`action: "failed"`, `error`) and `failures`". The code was the outlier, so the contract stays the single source of truth (and stays correct for the CLI fix filed above).

### handoff 2026-09-28 @Arggon — next: Coordinator: review PR, merge it, then flip this item to done; CLI twin bug-cli-cleanup-branch-delete-missing-failure is filed and untouched
- branch: fix/bug-native-cleanup-branch-delete-missing-failure
- open questions: Should the CLI fix mirror the native bounded text exactly?; Is the new test's stale-record fixture acceptable to the reviewer vs a domain-based one?
### 2026-09-28 @Arggon-coordinator
## FINAL APPROVE — PR #428 (`479c1ca6`), p3

Reviewed the diff line by line; verified the two claims that matter (the root cause, and that the
test actually pins the defect). **Merge authorized; this comment performs no merge and no `done` flip.**

### Root cause: confirmed and precise
The branch delete runs in its **own inner** `try`/`catch` (the "race: pre-flight passed, the delete
failed" case) nested inside the outer per-candidate catch. That inner catch pushed only the
structured `pruned` entry; `failures: string[]` is filled **exclusively** by the outer catch, so a
branch-delete failure never reached the flat list and the envelope reported `ok: true`, a
`failed` action, and `failures: []` — a false clean-run signal. I confirmed the shape in the diff:
the fix is **8 added lines inside that inner catch**, and the outer catch, removal block, clearing
block, classification, remote safety, `via` and `prune: false` parity are untouched.

### The two-surface requirement, met properly
The acceptance says the failure must appear "as well as" the structured one. I checked whether a
`pruned` action already existed: it did, so the real gap was the flat entry. The fix builds
`const message = boundedNativeText(detail(error), MAX_NATIVE_DETAIL_CHARS)` **once** and uses that
same text for `failures` and `pruned`, so the two surfaces cannot drift — better than two
independent derivations, which is how this class of bug usually returns.

### The test pins the defect and the invariants
One case, shaped so the branch delete is the **only** step that can fail: no `worktree` option at
all (git inventory fallback), and both candidates carry a stale `worktree_path` for a path that
never existed, so classification prunes them with no removal step. That isolates the defect instead
of burying it in a multi-step fixture. It then asserts the full `pruned` sequence — failed →
cleared for the failing candidate, then the healthy candidate still prunes end to end, **one**
shared commit — plus that the leftover branch survives and the deleted one is gone. That is
acceptance box 2 asserted, not asserted-by-omission.

### What the worker got right that I want on the record
1. **It found a twin defect in the CLI and did not absorb it.** `cli/src/cleanup.ts` has the
   identical inner-catch gap, and — more importantly — `cli/src/worktree.test.ts:1076` currently
   **pins the wrong behavior** with `expect(result.failures).toEqual([])`. That test is a landmine:
   the CLI fix has to change an assertion that currently defends the bug. The worker filed
   `bug-cli-cleanup-branch-delete-missing-failure` (p3, reparented to `story-start-worktree`, the
   story that owns CLI cleanup) with the repro and a 5-box acceptance list, and touched no CLI file.
   Correct call on every count: the contract in `json-output.md` already documents both surfaces,
   so the **code** is the outlier in both places, and `docs/json-output.md` correctly stays
   unchanged.
2. **It self-corrected the item's own claim.** The body asserted "the CLI path does so"; the worker
   states plainly that this is **wrong** and says so on the item. An item that quietly preserves a
   false claim about its own context is worse than one that never made it.
3. **Honest limitation on the untested branch.** Only the `-d` path executes: the `-D`
   (squash-merge `via`) entry point shells out to the real `gh` and cannot be reached offline. The
   test injects failures into both `deleteBranch` and `deleteBranchForce` so the assertion holds for
   either primitive, the code change is literally one catch, and the limitation is stated in both the
   code comment and the item. That is the right way to narrow a claim you cannot fully test.
4. **Regression proof is two-staged**: stashed, the test fails first on `expected 867 to be 500`
   (unbounded) and then, with that relaxed, on `expected [] to deeply equal [Array(1)]` — i.e. it
   demonstrates both the bound and the reported defect independently.

### One correction, filed not waved through
The evidence says the branch-delete fix reuses "the same helper + 500-char cap as the
**worktree-removal** failure". That is inaccurate, and it matters: the worktree-removal path uses
plain `detail(error)` with **no** clipping (`index.ts:938`), so it still pushes an unbounded
message into both `pruned[].error` and `failures[]` — an ADR 0006 bounded-payload gap, and now an
inconsistency between two failure surfaces of the same envelope. Filed as
`bug-native-cleanup-worktree-failure-unbounded` (p2) with the line-level evidence. Not a blocker
here: this PR's scope is the branch-delete surface and it did that correctly; the sibling is a
separate fix.

### Gates
`npm test` 97 files / 1661 · `lint` clean · `build` + `build:plugin` (40 modules, 372 459 B) ·
`check:plugin` exit 0 after committing the regenerated bundle · `lint:structure` 0 violations ·
`test:structure` 3 passed · `validate --json` `ok:true`. CI `36497848596` and `36497848633`
both success on this head. Pre-commit hook green, never `--no-verify`.

### Answering the worker's two open questions
- **Should the CLI fix mirror the native bounded text exactly?** Yes — and note that today "exactly"
   is only reachable after `bug-native-cleanup-worktree-failure-unbounded` is fixed, otherwise the
   native path's *other* surface is still unbounded. Fix the bound on both paths, then assert
   byte-identical messages in the CLI test.
- **Is the stale-record fixture acceptable vs a domain-based one?** Yes, and better. Injecting a
   domain removal failure would test the removal catch, not the branch-delete catch; using stale
   records makes the branch delete the only variable, which is what makes the `867 → 500` and
   `[] → [entry]` failures clean signals rather than noise.
