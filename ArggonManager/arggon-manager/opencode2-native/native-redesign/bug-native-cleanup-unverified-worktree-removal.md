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

### 2026-09-28 @Arggon-worker
## Headless smoke evidence (W4) — 2026-09-28

The full `npm run smoke:opencode` harness is blocked by the pinned model's quota, not by this change:
`opencode run --model opencode-go/deepseek-v4-flash "Reply with only the word OK"` → `Error: Go usage limit exceeded`,
so all 47 checks failed, including ones with nothing to do with this item ("session still succeeds", "/next: session completes").

Re-ran the W4 group with a working model: `OPENCODE_SMOKE_ONLY=w4 OPENCODE_SMOKE_MODEL=opencode/space-bunny-free npm run smoke:opencode`.

- `invariants (W4)` — 13/13 ok (never-steal, no-reopen, permissions active).
- `permissions (W4)` — 11/11 ok (reviewer catalog is the read-only set, shell gate denies `git push`, session not broken).
- `worktree lifecycle (W4)` — 4 ok, then `FAIL model executed the native start tool`.

**That one failure is a harness transcript-needle mismatch, not a product failure.** The transcript
(`/tmp/arggon-smoke-lifecycle-UJ7M3z/.smoke-evidence/worktree-lifecycle-start.stdout.jsonl`, kept fixture) shows the
tool call itself **completed** with a correct envelope:

- frame 1: `tool_use execute completed`, code `return await tools.arggon["start"]({ id: "task-smoke-item", assignee: "smoke" })`
- output: `{"ok": true, "command": "start", "id": "task-smoke-item", "branch": "feat/task-smoke-item",
  "worktreePath": "/tmp/arggon-smoke-lifecycle-UJ7M3z-task-smoke-item", "worktreeCreated": true, "branchCreated": true, ...}`

so the native `start` tool ran through the real OpenCode worktree domain from the dependency-less vendored bundle.
The check missed it because `normalizeNamespace()` (smoke/opencode-smoke.ts:415) rewrites `tools["arggon"].x` →
`tools.arggon.x` but not the equally valid `tools.arggon["x"]` form, so the needle `tools.arggon.start`
(`smoke/opencode-smoke.ts:1383`) did not match the model's bracket-notation call. The pinned smoke model writes the
dot form, which is why this does not show up there.

**Not fixed here on purpose** — the harness is out of this item's scope and the coordinator owns filing
(`references/orchestration.md`: findings go back to the coordinator, not into this diff). Suggested follow-up for
the native-smoke surface: extend `normalizeNamespace` to also normalize `tools.arggon["x"]` / `tools.arggon['x']`.

CI on PR #421: `cli` SUCCESS · `tasks-validate` SUCCESS · `ui-smoke` SUCCESS.

### handoff 2026-09-28 @Arggon-worker (session: ses_f165d5e03ffeuQoAVgHB6lN7kE) — next: Review + merge PR #421 (draft); if the force policy for cleanup is rejected, flip policy.force to true in nativeCleanup, rerun gates, push.
- branch: fix/bug-native-cleanup-unverified-worktree-removal
- open questions: Cleanup git fallback stays non-force (dirty-worktree contract) while start rollback forces - confirm or reject; smoke needle does not match tools.arggon["x"] - coordinator to file; item body checklis…
