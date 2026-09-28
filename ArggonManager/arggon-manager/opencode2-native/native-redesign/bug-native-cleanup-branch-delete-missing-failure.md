---
type: bug
status: todo
id: bug-native-cleanup-branch-delete-missing-failure
title: "Native cleanup branch-delete failure is reported in pruned but omitted from failures[]"
parent: native-redesign
labels: [opencode-seam, worktree, review-followup]
priority: p3
created: "2026-09-28"
updated: "2026-09-28"
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
