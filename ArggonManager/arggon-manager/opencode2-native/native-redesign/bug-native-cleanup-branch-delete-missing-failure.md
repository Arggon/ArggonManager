---
type: bug
status: in_progress
id: bug-native-cleanup-branch-delete-missing-failure
title: "Native cleanup branch-delete failure is reported in pruned but omitted from failures[]"
assignee: Arggon
branch: fix/bug-native-cleanup-branch-delete-missing-failure
parent: native-redesign
labels: [opencode-seam, worktree, review-followup]
priority: p3
created: "2026-09-28"
updated: "2026-09-28"
claimed_at: "2026-09-28T23:16:18.280Z"
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

- [ ] Every native branch-delete failure appends a bounded `<id>: <error>` entry to `failures[]` as well as the structured `pruned` failure.
- [ ] Per-candidate continuation and the existing record-clearing semantics after an observed worktree removal remain unchanged.
- [ ] Add a deterministic test for `git branch -d/-D` failure with no domain dependency.
- [ ] Update the json-output contract only if needed to make the two failure surfaces explicit.
- [ ] Full test, lint, build, `check:plugin`, and validate remain green.

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
