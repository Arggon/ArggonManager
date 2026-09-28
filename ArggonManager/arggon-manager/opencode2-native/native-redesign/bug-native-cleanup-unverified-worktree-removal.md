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

### 2026-09-28 @ses_f1646c3bcffeDF9jjDx7e6Uxpi
## Review — PR #421 (`b12467fd`) — provisional verdict: **PASS, merge recommended**

Reviewer: reviewer subagent, read-only. Head `b12467fd`, base `main`. CI rollup read: `cli` SUCCESS · `tasks-validate` SUCCESS · `ui-smoke` SUCCESS. No graph-negative claims — I read current source directly (generation predates this branch).

### What I verified myself (all re-run on this head, not taken on trust)

| Gate | Result |
| --- | --- |
| `npm run build` | pass |
| `npm run check:plugin` | pass — regenerated bundle **byte-identical** to the committed `index.bundle.ts` |
| `npm run lint` | pass |
| `npm test` | **97 files / 1638 tests passed** (matches the worker's count exactly) |
| `npm run arggon -- validate --json` | `{"ok":true,"errors":[],"warnings":[]}` |
| `npm run smoke:tui-board` | pass |
| `OPENCODE_SMOKE_ONLY=w4 … smoke:opencode` (substitute model) | **3 scenarios / 40 checks / 0 failures** |
| pinned-model quota block | **reproduced independently** |

Worktree left clean by me (`git status --porcelain` empty).

### Findings, severity order

**S1 · Medium · test gap against the item's own acceptance wording — recommend landing with the PR.**
Acceptance box 5 asks for "a lying/**failing** domain". The added tests only drive a *lying* domain (resolves without removing). The *throwing* path is exercised only as a side effect: the fake domain throws because its own internal `git worktree remove` failed (`tools.test.ts:779-787`) inside the foreign-`node_modules` test, and that test asserts only `"git worktree removal failed"` — never the `worktree domain removal failed:` text. So neither "domain throws → git fallback prunes end to end" nor "domain throws → git fails" is asserted. **The behavior is correct** (I proved both by probe), so this is coverage, not a defect — but it is an incomplete acceptance box, and it is ~15 lines to close.

**S2 · Medium · SEPARATE, PRE-EXISTING defect — must be filed, must NOT be fixed in this diff.**
The harness normalization gap the worker hit is **real**, and it is worse than "one missed check":

- `normalizeNamespace()` (`smoke/opencode-smoke.ts:415`) only rewrites `tools["arggon"]` → `tools.arggon`. It never normalizes bracket *member* access, so **3 of 5 valid Code Mode spellings** miss the `tools.arggon.<name>` needles. Deterministic probe:

```
MATCH    tools.arggon.start({ id: "x" })
MATCH    tools["arggon"].start({ id: "x" })
NOMATCH  tools['arggon']['start']({ id: "x" })   -> tools.arggon['start']({ id: "x" })
NOMATCH  tools.arggon["start"]({ id: "x" })
NOMATCH  tools.arggon['start']({ id: "x" })
```

- `executeJson()` (`smoke/opencode-smoke.ts:789-802`) is the affected path, so **every** native-tool transcript check is model-spelling-dependent — not just W4. The smoke gate therefore emits **flaky false negatives that are indistinguishable from product failures**. That is exactly what happened here, and I proved the flakiness: the **same head** failed that check for the worker and **passed it** for me.
- The codebase already has the correct pattern one screen away: `executedTool()` (`smoke/opencode-smoke.ts:448-457`) matches `tools.arggon.x`, `tools.arggon["x"]` and `tools.arggon['x']`. `executeJson` was simply never brought in line.
- Two claims in the tree are **wrong and must change with any fix**: the doc comment says it accepts "every valid form (observed in the bounded command sessions, W4)", and `smoke/opencode-smoke.test.ts:144-148` is *named* `"normalizes every bracket namespace spelling"` while **asserting** the un-normalized result `tools["arggon"]["next"]` → `tools.arggon["next"]`. That test currently locks the gap in.

→ **Coordinator: file this as a follow-up under the native-smoke surface** (the worker deferred it to you and that was the right call). Suggested: *"opencode-smoke: transcript needles miss bracket-member tool spellings"* — `normalizeNamespace` normalizes `tools.arggon["x"]`/`tools.arggon['x']`/`tools["arggon"]["x"]` (mirror `executedTool`'s three patterns or extend the regex), fix the doc comment, and update the misnamed assertion. Out of scope for #421.

**S3 · Low · the item's acceptance text contradicts the shipped code; the deviation is recorded only in a comment and the PR body.**
Box 1 literally says "fall back to a literal `git worktree remove --force`". Cleanup ships the fallback **without** `--force`. The reasoning is correct (see verdict below) and it is disclosed in the PR body and the worker comment — but the item body still reads as if `--force` shipped, and `docs/agents.md` §5 makes the checklist the definition of done. → **Amend box 1** (e.g. "…`git worktree remove` fallback — forced only for the `start` rollback, which owns the worktree it created; cleanup keeps git's dirty-worktree refusal, matching `arggon cleanup --prune`") before ticking it. This is the honest record; the deviation is real and defensible.

**S4 · Low · the error text tells the user to do the one thing this tool refuses to do.**
Probe (native P6 and CLI B both surface it verbatim): `…fatal: '<path>' contains modified or untracked files, use --force to delete it`. With `force:false` as the deliberate policy, the actionable next step is "commit/stash or remove the files yourself, then re-run cleanup". A hint appended in the primitive would make it actionable. Non-blocking.

**S5 · Nit · `via` is overloaded across two layers.**
`WorktreeRemovalObservation.via` is `"domain" | "git" | null`; `entry.via` in the payload is `"squash-merged PR #N"`. The new `failed` block spreads `entry.via`, which is **correct** and consistent with the other three `pruned.push` sites (I checked all four) — but a reader inside that block cannot tell which concept `via` is. Renaming the observation field to `channel` removes the trap. Non-blocking.

**S6 · Nit · inherited style inconsistency, not introduced by this PR.**
The new code is semicolon-terminated (36 semicolon lines in the 2310-2450 range). `origin/main`'s `index.ts` already had 35 — all inside the `discardWorktree` block this PR replaced — and the other ~3,700 lines have none, while `.prettierignore` documents a deliberate semicolon-free policy for `opencode/plugins/arggon/`. The new code matches its immediate predecessor but not the file. Drift inherited from #419; worth one normalization pass under `task-plugin-source-prettier-policy`.

**S7 · Observation · pre-existing, NOT a regression — `failures[]` is empty for a branch-delete failure.**
Probe P4 (recorded path missing on disk): `pruned: [failed(leftoverBranch), cleared worktree_path]`, `failures: []`, and the cleared record is still committed. Verified **byte-identical at `origin/main`** (`git show origin/main:opencode/plugins/arggon/index.ts`), so #421 neither introduced nor fixed it. `json-output.md` ("…appear in `pruned` … and `failures`") is loose. Out of scope; note it if the docs get tightened.

### Verified properties (no action)

- **`leftoverPath` is accurate in every reachable failure state.** I tried to construct the imprecision case and could not: a physical delete with a *stale* registration is repaired by the git fallback (success, both signals agree); with a *destroyed* registration the observation sees no registration either (success); the failure states that remain all have the directory genuinely on disk. Probe P3c (domain deletes the worktree but leaves an untracked dir) reports `leftoverPath` at a path that really does still exist.
- **Bounded errors.** `boundedNativeText(..., MAX_NATIVE_DETAIL_CHARS=500)` and `clip()` respect the bound — measured 297 / 420 / 436 chars across probes. `failures[]` is one entry per failed candidate, so it is bounded by candidates (ADR 0006 spirit).
- **Exactly one tracker commit.** Probe P11 (two candidates, one unobservable): repo commit count `7 → 8`, a single `chore(tasks): pruned task-rate-limit` for the one cleared record, while the failed candidate kept worktree + branch + record. Verified at the **repo** level, not just the envelope.
- **`prune: false` envelope parity.** Keys are exactly `[ok, schemaVersion, conventionVersion, command, base, candidates, pruned, failures]`, `pruned: []`, `failures: []`, no `commit`, candidate keys unchanged, 0 domain calls, worktree/branch/record untouched. The diff does not touch that region.
- **Squash-merge `via`.** The new `failed` site uses the same `...(entry.via !== undefined ? { via: entry.via } : {})` spread as the other three, so the annotation is consistent by construction.
- **Security.** `run()` uses `execFile` with an **args array** (`index.ts:952-963`) — the recorded path cannot shell-inject. The foreign-path guard means `git worktree remove` only ever targets a path git reports as a worktree of this repo (probe P9b: `removable:false`, `reason:"path exists but is not a git worktree of this repo"`, `domain.remove` calls **0**, precious file intact).
- **Unlink ownership.** `unlinkNodeModulesLink` (`lib/src/worktree.ts:361`) unlinks only a symlink whose resolved target is the canonical install. Probe P6: a real `node_modules/foreign-dep` **directory** survives intact.
- **Schema budget.** `nativeToolsCatalogBytes()` = **11,821** bytes — unchanged and equal to the figure documented at `opencode2.md:101`, under the 12,288 advisory cap. No tool/description/schema growth.
- **Docs accuracy.** `json-output.md` scopes `leftoverPath` to the native tool; my CLI probe confirms the CLI does **not** emit it, and CLI dirty-prune produces `pruned: [failed]` + `failures` + **no commit**, exactly as documented. `skills/` does not mirror the cleanup payload table, so no `skills:sync` obligation.
- **Scope.** 6 files: plugin source, its bundle, its test, 2 docs, and the item file (claim bookkeeping only). `lib/src/cleanup.ts` and the CLI are untouched. No ADR warranted (additive `schemaVersion: 1` field, no new package, no reserved-namespace change), no new runtime dependency.
- **Start rollback is strictly safer, not regressed.** The refactor now requires the observation *after each step* rather than only at the end, so a domain that removed the directory but left a stale registration now falls through to the git fallback (which prunes it) instead of being accepted-then-rejected at origin/main. The git fallback runs on exactly the same condition as before.

### Force-policy verdict: **uphold `force: false` for cleanup**

It is not a deviation from the status quo — it **is** the status quo, which is the strongest argument. At `origin/main` the cleanup path called `kernel.defaultCleanupGit().removeWorktree(root, directory)` = `git worktree remove <path>`, **no force** (`lib/src/cleanup.ts:160-162`). Honoring box 1 verbatim would have *introduced* forced deletion of uncommitted work into a maintenance command — a riskier change than the bug required.

Evidence:
1. **Raw git asymmetry** — `git worktree remove <dirty>` → `fatal: … contains modified or untracked files, use --force to delete it`, exit 128, dir intact. `git worktree remove --force <dirty>` → exit 0, **uncommitted file destroyed**.
2. **CLI parity probe** (`arggon cleanup --prune --no-gh --json` on a fixture, record hand-set): clean → 3 prune actions, worktree gone, branch deleted, record cleared, one commit. **Dirty** → `pruned:[{action:"failed"}]`, `failures:["task-rate-limit: …"]`, **no commit**, worktree + branch + record intact, uncommitted file survives. That is the documented contract, and the CLI is the **documented fallback** for the native tool (`opencode2.md`). Forcing natively would make the two surfaces disagree on the same action — precisely what `lib/src/cleanup.ts:12-17` exists to prevent.
3. **Native probe P6** — the domain is called with `force:false`, both the domain and the git fallback refuse, and work/branch/record are all preserved.
4. **Start rollback keeps `force:true`** (it discards a worktree it created seconds earlier), and because `force` is a *policy input* to one shared primitive, the two callers can never disagree about what "removed" means. That separation is the right design and is what acceptance box 4 asked for.

**Caveat to record, not to code around:** the *domain* call also receives `force:false`, and whether OpenCode's domain honours it is an external contract this repo types structurally only (`WorktreeDomainLike`, `index.ts:104-115`). The dirty-worktree protection is therefore verified at the git fallback, not provably at the domain layer. Same as `origin/main`, which also passed `force:false`. One doc sentence would close the record.

### Smoke / gate assessment: **amend the item, do not block on it**

The blocking smoke bar is satisfiable, and I satisfied it. I independently reproduced the environmental block — `opencode run --model opencode-go/deepseek-v4-flash "Reply with only the word OK"` → `Error: Go usage limit exceeded`, no output. That is the *model's* quota, not this change. Substituting a working model, the W4 group is **40/40 green on this head**, including `cleanup reports the removable candidate and the three prune actions`, `cleanup committed the cleared record`, `worktree removed through the domain and gone from disk`, `merged branch deleted`, `item is done with worktree_path cleared` — i.e. the refactored primitive works through the **real** OpenCode worktree domain end to end.

Deterministic evidence is **sufficient** for this item's behavior, and the PR already has the right split. The change's whole surface is the removal-observation rule, which a smoke harness cannot reach through a real, well-behaved domain — you cannot make a live domain lie from the outside. So: deterministic vitest for the adversarial branches + the model-driven W4 harness for the real-domain happy path. My probes covered the residual gaps (throwing domain, stale/foreign inventory, unprunable registration, one-commit-at-repo-level, prune:false parity).

Neither the quota failure nor the harness needle failure is a product signal, and blocking on either would be blocking on an unrelated failure. **Recommendation:** check the boxes with the W4-group evidence and the model substitution noted; amend box 1 for the force policy (S3) and box 5 for the failing-domain test (S1).

### What I could NOT verify (disclosed)

- I did **not** run the full 47-check `npm run smoke:opencode`; the pinned model is quota-blocked and a substitute model is not equivalent to the pinned configuration. I ran the W4 group, which is the group that exercises the changed surface.
- I could not inspect the real `ctx.worktree.remove` implementation — it is an external OpenCode contract, not a dependency of this repo, so its `force` semantics stay unverified (see the force caveat).
- Squash-merge `via` on the **new failure** path was checked by code reading only: `nativeCleanup` injects no `gh` executor, so a squash-merged candidate reaching that path calls the real `gh`; I did not drive it end to end. Consistency is by construction (all four push sites share the spread).
- CI was read from the PR rollup, not re-run.

### Merge recommendation: **PASS — merge**

Conditions:
1. Mark PR #421 **ready** — it is still a `draft`.
2. **S1** (throwing-domain tests) recommended to land with the PR; if the coordinator prefers not to wait, the honest alternative is to amend box 5 to say "lying domain" and file the throwing-domain test as a follow-up — not to check a box that does not match the tests.
3. **S3** (amend box 1 for the force policy) before the item flips `done`.
4. **S2 must be filed as a follow-up** by the coordinator — explicitly not in this diff.

No blocking defects. The core primitive is correct, shared, well-observed, and documented; the acceptance evidence is honest apart from the one force-wording mismatch the worker disclosed proactively.

### 2026-09-28 @Arggon-worker
## Review conditions addressed — head `6417b627` — 2026-09-28

**S1 (coverage) — closed.** Two explicit **throwing**-domain tests now sit beside the lying ones in
`opencode/plugins/arggon/tools.test.ts`:

- `cleanup prune falls back to git when the domain throws` — the domain rejects; the git fallback removes
  end to end (3 prune actions, worktree gone from disk **and** `git worktree list`, branch deleted, record
  cleared, one `chore(tasks): pruned task-rate-limit` commit, `failures: []`).
- `cleanup prune keeps the record and the branch when a throwing domain and git both fail` — asserts the
  observed `worktree domain removal failed: worktree domain unavailable` text, the observed
  `git worktree removal failed` text, `worktree remains at <path>`, the ≤500-char bound, the single
  `failures[]` entry, `leftoverPath`/`leftoverBranch`, `pruned: [failed]` only, no `commit`, and the
  preserved worktree + branch + `worktree_path` record.

The `cleanup prune` group is now 7 deterministic cases. Neither the inherited semicolon style nor the
internal `via` name was touched; no behavior change — the code already handled the throwing path, S1 was
coverage.

**S3 (acceptance honesty) — closed in the item body.** Box 1 now states the upheld policy: the fallback is a
literal `git worktree remove` when the domain call fails **or resolves without removing**, and `--force` is
a policy input of that one shared primitive — `true` for the `start` rollback (discards the worktree it just
created), `false` for the cleanup prune (git keeps refusing dirty worktrees, native/CLI parity preserved).
All six boxes are ticked, with an evidence note appended under Notes. The reviewer's notes are byte-identical
(verified: the only changed lines in the item file are the six box lines) — the prose gate does not cover
tracker item files, so no formatter churn was introduced.

**Out of scope, untouched as instructed:** S2/S7 are filed on main
(`bug-opencode-smoke-normalize-bracket-namespace`, `bug-native-cleanup-branch-delete-missing-failure`);
S5 (`via` naming) and S6 (semicolon style) unchanged.

**Merge main** — `817e2516`, normal merge, no conflicts; the reviewer notes and both new items came in
unchanged. Tracker notes only, no behavior change.

**Gates on `6417b627`** — focused `worktree domain tools` 36/36 · `npm test` 97 files / **1640** tests
(+2 from S1) · `lint` · `build` · `check:plugin` (bundle regenerated: **byte-identical**, 370347 bytes) ·
`validate --json` `ok:true` · `smoke:tui-board` passed. CI on the new head: `cli` SUCCESS ·
`tasks-validate` SUCCESS · `ui-smoke` SUCCESS. PR #421 marked **ready for review** (not draft), pushed
normally, no force-push, no merge, no GitHub comment.

**Review smoke, recorded honestly:** the reviewer's independent W4 run on this surface is **40/40 green**
(including the cleanup round-trip through the real OpenCode worktree domain); the full 47-check harness stays
quota-blocked on the pinned `opencode-go/deepseek-v4-flash` (`Go usage limit exceeded`) and was not re-run —
a model-quota block, not a product signal for this non-model behavior.
