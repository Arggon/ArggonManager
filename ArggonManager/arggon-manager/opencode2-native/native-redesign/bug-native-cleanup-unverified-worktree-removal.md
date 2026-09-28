---
type: bug
status: todo
id: bug-native-cleanup-unverified-worktree-removal
title: "Native cleanup prune can report a worktree removed while the worktree, branch, and worktree_path record remain"
parent: native-redesign
labels: [opencode-seam, worktree, review-followup]
priority: p1
created: "2026-09-28"
updated: "2026-09-28"
depends_on: [bug-native-start-worktree-no-install]
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-native-cleanup-unverified-worktree-removal.md
  Leaves live only under a story. id is the filename stem: bug-native-cleanup-unverified-worktree-removal.
  CLI `arggon create bug native-cleanup-unverified-worktree-removal` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native cleanup prune can report a worktree removed while the worktree, branch, and worktree_path record remain

## Context

Lead-architect re-review of [PR #419](https://github.com/Arggon/ArggonManager/pull/419) on 2026-09-28 found that native `tools.arggon.cleanup({ prune: true })` trusts a successful `ctx.worktree.remove` call without observing the result. A domain that resolves while leaving the worktree in place produces `pruned: [{ action: "removed worktree <path>" }, { action: "failed", leftoverBranch }, { action: "cleared worktree_path" }]` with no top-level failure: the worktree and branch still exist but the canonical record is cleared, so the state becomes unrecoverable through the normal cleanup path.

This is a pre-existing native cleanup defect, not part of the P1 start-readiness change. It is tracked separately so PR #419 stays scoped; the fix depends on that P1 merge to avoid concurrent edits to the vendored plugin.

## Acceptance

- [ ] Verify worktree removal physically and through `git worktree list` after the domain call; fall back to a literal `git worktree remove --force` when the domain resolves without removing it.
- [ ] Never emit `removed worktree`, delete a branch, or clear `worktree_path` unless removal is observably complete.
- [ ] A failed removal reports a bounded per-candidate failure with the remaining path and `leftoverBranch`, preserves the record, and keeps the rest of the cleanup run honest.
- [ ] Reuse one shared removal/observation implementation with native start rollback; do not duplicate the rules.
- [ ] Add deterministic tests for a lying/failing domain, git fallback success, both domain+git failure, foreign `node_modules` ownership, and record/branch preservation.
- [ ] Update the native cleanup payload contract and `npm test`, lint, build, `check:plugin`, validate, and review smoke are green.

## Notes

Review verdict: PR #419 re-review, 2026-09-28, finding 3.

### 2026-09-28 @Arggon-worker
## Implementation — PR #421 (draft) — 2026-09-28

Claim was already `in_progress` in-process but the claim commit was skipped by the stale
vendored plugin (`tsx: command not found`, `bug-stale-vendored-plugin-copy`). Bootstrapped the
worktree with `npm ci` and made the explicit commit `claim: bug-native-cleanup-unverified-worktree-removal`
(4b38b698, pushed) before touching code.

**Design.** One shared removal/observation primitive in `opencode/plugins/arggon/index.ts`:
`removeWorktreeObserved(options, directory, root, policy)` replaced the unverified cleanup-only
`removeWorktree()` (deleted) and the body of the start rollback's `discardWorktree()`. Domain first,
literal `git worktree remove` fallback, and the directory **plus** `git worktree list` are checked
after every step (`gone()`); a resolved promise or a zero exit is never a removal.
`nativeCleanup` now gates `removed worktree`, `deleted branch` and `cleared worktree_path` on
`removed === true`; otherwise one bounded per-candidate `failed` action + `failures[]` entry with
the new additive `leftoverPath` and `leftoverBranch`, and both the branch and the `worktree_path`
record are preserved so the next `cleanup` can retry.

**One deliberate deviation from the acceptance wording** (reviewer call): the git fallback force flag
is a *policy input* of the shared primitive, not a forked rule. Start rollback passes `force: true`
(`git worktree remove --force`, the seconds-old worktree it created); cleanup passes `force: false`,
because `arggon cleanup --prune` is documented as "git refuses dirty worktrees" and a forced prune
would silently delete uncommitted work in a done item's worktree. Observation rules are byte-for-byte
identical; only the caller's force policy differs. Say the word and I flip cleanup to `force: true`.

**Tests added** (`opencode/plugins/arggon/tools.test.ts`, all deterministic, no network):
- lying domain (resolves without removing) + git fallback success → reported once, observed via disk + `git worktree list`
- lying domain + broken git registration (both fail) → only `failed`, `leftoverPath`/`leftoverBranch`, ≤500-char error, `failures[]`, no commit, worktree+branch+record preserved
- foreign `node_modules` (real dir start never created) → never removed, git refuses, record preserved
- one unobservable removal among two prunable candidates → the healthy one still prunes end to end, ONE commit for the single cleared record
- start rollback with a lying domain → same primitive, `--force` fallback, `rollback.worktreeRemoved`/`branchDeleted` true only after the observation

**Gates** (worktree, after `npm ci`): `npm test` 1638 passed / 97 files · `npm run lint` · `npm run build` · `npm run check:plugin` · `npm run arggon -- validate --json` → `ok:true` · `npm run smoke:tui-board` passed. `origin/main` merged normally (b12467fd).

**`npm run smoke:opencode` is environmentally blocked, not a regression.** The full harness failed
47/47 checks, including trivially unrelated ones ("session still succeeds", "/next: session completes"),
and the cause is the pinned smoke model: `opencode run --model opencode-go/deepseek-v4-flash "Reply with only the word OK"`
→ `Error: Go usage limit exceeded`. Re-running the W4 group (worktree lifecycle + invariants +
permissions) with `OPENCODE_SMOKE_MODEL=opencode/space-bunny-free` instead; result appended here.
