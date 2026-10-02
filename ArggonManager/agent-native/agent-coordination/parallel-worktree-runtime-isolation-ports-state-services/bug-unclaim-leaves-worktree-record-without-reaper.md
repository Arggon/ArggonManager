---
type: bug
status: done
id: bug-unclaim-leaves-worktree-record-without-reaper
title: "Unclaiming a claimed item (update --status todo) keeps worktree_path + branch + claim stamp, and cleanup never reaps a non-done item"
assignee: Arggon
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, tracker]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-unclaim-leaves-worktree-record-without-reaper.md
  Leaves live only under a story. id is the filename stem: bug-unclaim-leaves-worktree-record-without-reaper.
  CLI `arggon create bug unclaim-leaves-worktree-record-without-reaper` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Unclaiming a claimed item (update --status todo) keeps worktree_path + branch + claim stamp, and cleanup never reaps a non-done item

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
Found while reviewing PR #589 (task-coordinator-claims-through-native-start): the coordinator contract it adds tells an agent that claiming an item you are not dispatching is wrong, and the remedy is to unclaim — `tools.arggon.update({ id, status: "todo" })`. But that leaves the whole claim footprint behind: `branch`, `worktree_path` (the created `../<repo>-<id>` worktree), the worktree's `.arggon.env` env contract and its `arggon-claim.json` ownership stamp. And nothing reaps it: `cleanup --prune` classifies on done/cancelled + merged branch (`cli/src/cleanup.ts:191`), so an item that goes back to `todo` is invisible to cleanup — the unowned-worktree class this item exists to prevent, arriving through the documented remedy.

## Acceptance
- [x] Decide + implement the contract: **both halves, split by what each surface owns.** `update` is frontmatter-only (it is the very call that CLEARS a `worktree_path` record), so it never reaps a worktree; it REPORTS the dropped claim's footprint on the unclaim as the additive `claimFootprint` receipt, naming the release path per surface. The release is an explicit, distinct `cleanup` action — `arggon cleanup --release <id>` / native `cleanup({ release })` — classified by the shared kernel rule `classifyReleaseEntry`: remove worktree + branch, reap `.arggon.env` + `arggon-claim.json` stamp, clear `worktree_path`, reported as its own `release`/`released` family (never mixed into `pruned`; `--release` and `--prune` mutually exclusive). **Review round 2:** the receipt is unclaim-only (`→ done` keeps `cleanup --prune` as the merge-gated remedy; a blocked item keeps its assignee), the claim stamp is reaped only AFTER an observed removal, uncommitted/untracked content is refused during classification (`blockingPaths`/`blockingTotal`) so a failed release keeps the stamp + env, the still-claimed refusal is unconditional (no hatch bypass), `--take-over-worktree` without `--release` is refused, and both surfaces' release owns and reports its own tracker commit.
- [x] Kernel-owned and CLI+native parity: the release path lives in `lib/src/cleanup.ts` — the kernel entry re-exports `classifyReleaseEntry` (the rule both surfaces call) and `worktreeReleaseRefusal`; the refusal sentences and the porcelain parser (`worktreeDirtyRefusal`, `parseRemovalBlockingPaths`) are module-internal helpers of that rule, and the native surface reaches the whole rule through `kernel.classifyReleaseEntry`, so parity is structural, not prose — both surfaces execute the same ordered steps, and the release arm has a **cross-surface envelope test** (`tools.test.ts`, release vs `cleanup --release <id> --json` on twin fixtures, commit hash normalized) plus MCP parity for both flags.
- [x] Tests: `cli/src/worktree.test.ts` "claim release — unclaim leaves nothing" (11 cases) and `opencode/plugins/arggon/tools.test.ts` "native release of a dropped claim" (8 cases), including one regression test per blocking finding — M1 (`→ done` / `→ blocked` report no receipt; the unmerged branch stays protected), M2 (a dirty worktree is refused with stamp + env intact; only the hatch forces it), M3 (the native release reports its own commit, never a skipped nothing-to-commit, plus the CLI-parity comparison) — and the original three: claim → unclaim → release leaves nothing; a plain unclaim of a never-worktree item is byte-identical; a release while another session holds the worktree is refused (no stealing a live writer's worktree).
- [x] Docs: agents.md's claim duty (PR #589) states the consequence and names the release path ("unclaim **and release**"), §Unclaim + §Cleanup document the contract (unclaim-only receipt, the three refusals, the hatch's scope), `claim.md` §Unclaim recovery + playbook, `json-output.md` §cleanup/§update, `opencode2.md`, `convention.md` (stamp lifecycle), and **m4 in full**: README's cleanup flags/envelope + release arm, and the coordinator prompts — the two template sources (`templates/docs/opencode/agents/`, `templates/docs/zcode/arggon/agents/`) plus their generated copies (`.opencode/agents/`, `.zcode-marketplace/arggon/agents/`, verified byte-identical to the templates modulo the generated header) and the skill's `references/orchestration.md`. **Round 3 (record/doc only, no behavior change):** this item file carries the whole review record again (round-1 `verdict: request-changes`, the coordinator's ruling, both evidence rounds and the round-2 verdict) — an earlier reconciliation commit had replaced it with a pre-review copy, which would have deleted the durable record `engineering.md` §Review verdicts and `arggon sync --json` depend on — and `convention.md` now documents the shipped `claimFootprint` shape `{ worktreePath, release: { cli, native } }` (m7 had dropped `branch` there last).
### 2026-10-02 @ses_f01cee59fffeSatwHpianDIykt
verdict: none (worker self-report — coordinator owns the verdict)

## Evidence — bug-unclaim-leaves-worktree-record-without-reaper

PR: https://github.com/Arggon/ArggonManager/pull/596
Branch: `fix/bug-unclaim-leaves-worktree-record-without-reaper` (rebased onto origin/main, pushed)

### Gates (cwd = the item worktree, post-rebase)

| Gate | Command | Observed |
| --- | --- | --- |
| build | `npm run build` | ok — `build:plugin — 41 modules inlined, 454915 bytes` |
| test | `npm test` | `Test Files 118 passed (118) / Tests 2178 passed (2178)` |
| lint | `npm run lint` | clean (no output) |
| validate | `npm run arggon -- validate` | `arggon validate: ok (0 warning(s), convention v5)` |

Schema budgets re-checked after the schema additions: `nativeToolsCatalogBytes()` = 12162 B (budget 12288) and the live MCP `tools/list` = 16253 B (advisory 16384, recorded baseline 15701). Both stay inside their budgets; the new MCP properties are deliberately bare (ADR 0006/0014 discipline) with the contract in the tool description and docs.

### Contract decided

Both halves, split by what each surface owns: `update` REPORTS the dropped claim's footprint (additive `claimFootprint` receipt naming the release path per surface) and never reaps a worktree — it is frontmatter-only and is the very call that clears a `worktree_path` record. The release is an explicit, distinct `cleanup` action (`arggon cleanup --release <id>` / native `cleanup({ release })`) classified by the shared kernel rule `classifyReleaseEntry`, refused while another live session holds the worktree. `--release` and `--prune` are mutually exclusive.

### Tests, expected vs observed

`npx vitest run cli/src/worktree.test.ts -t "claim release"` → 7 passed.
1. claim → unclaim → release: expected `reaped arggon-claim.json stamp`, `removed worktree <path>`, `deleted branch feat/task-alpha`, `cleared worktree_path` with worktree gone (`worktreeCount` 1), `refs/heads/feat/task-alpha` gone, stamp + `.arggon.env` gone, `worktree_path` undefined, `pruned: []`, `commit.message = "chore(tasks): released task-alpha"`. Observed exactly that.
2. release from inside the worktree (claim never merged): expected the record DISPOSED with the copy (`disposed worktree_path record with the worktree`, no commit, `conventionVersion` still 5 because it is read before the removal). Observed exactly that — first run exposed a real ordering bug (record cleared before removal could strand a surviving worktree, and `worktreeBranch`/git cwd had to come from the worktree/canonical checkout), fixed in `cli/src/cleanup.ts` + the native twin.
3. plain unclaim of a never-worktree item: expected no footprint, unchanged `changed` list `["status","assignee","branch","claimed_at"]`, and a reported refusal. Observed exactly that.
4. release while another session holds the worktree: expected a refusal naming the stamped owner, `foreignWrites { owner: "arggon", total: 1 }`, the footprint fully intact; then, with `--take-over-worktree`, a forced release reporting `takeOver.replacedIdentity: "arggon"`. Observed exactly that.
5. `npx vitest run opencode/plugins/arggon/tools.test.ts -t "native release"` → 3 passed: domain removal observed (`force: false`, `force: true` only under `take_over_worktree`), stamp reaped, record cleared, refusal + take-over, and native `update` carrying `claimFootprint.release.native = tools.arggon.cleanup({ release: "task-rate-limit" })`.
6. `npx vitest run cli/src/mcp-parity.test.ts` → 17 passed (the new `--release` / `--take-over-worktree` flags have live MCP `release` / `take_over_worktree` counterparts).

### Findings the coordinator should know

- The item's premise is half right: bare `update --status todo` already CLEARS `branch` (`lib/src/update.ts`, the in_progress→todo branch default) — what it leaves is `worktree_path` + the worktree + `.arggon.env` + the stamp. The release therefore reads the branch from the WORKTREE (there is no recorded branch left to read) — that is why `CleanupGit` grew an optional `worktreeBranch` probe.
- A claim made through `start --worktree` records itself in the WORKTREE copy (the claim commit rides the feature branch), so before that branch merges only the worktree knows the record. A release therefore runs where the record lives; when that checkout IS the worktree, the record is disposed with the copy (nothing is written, nothing committed) — documented in json-output.md §cleanup and agents.md §Cleanup.
- `--release` under a dirty worktree is refused by git unless `--take-over-worktree` is armed (the only forcing path), so a dead owner's uncommitted work is never discarded silently.

### Not done here (for the coordinator)

The item stays `in_progress` — merge, acceptance verification and the `done` flip are yours.

### handoff 2026-10-02 @ses_f01cee59fffeSatwHpianDIykt (session: ses_f01cee59fffeSatwHpianDIykt) — next: Coordinator: review + merge PR #596 (claim-release contract), then flip the item done
- branch: main
- open questions: Release refuses a dirty worktree unless --take-over-worktree is armed — intended? MCP schema props kept bare to stay under the 16 KiB budget

### 2026-10-02 @Reviewer
### 2026-10-02 @Reviewer (independent review, read-only)
verdict: request-changes (3 blocking findings: claimFootprint over-triggers past `done`; a failed removal destroys the single-writer stamp; native release commits twice and reports a skipped `commit`)

Scope: PR #596 (`fix/bug-unclaim-leaves-worktree-record-without-reaper`, branch contains all of `origin/main`) read against `ArggonManager/docs/engineering.md`. I read the item, the full diff (19 files) and the affected code; I ran no gates. CI on the current head is green (`gh pr checks 596`: cli / tasks-validate / ui-smoke pass) — necessary, not sufficient.

What is good and verified by reading: the contract split (`update` reports, `cleanup` releases) is defensible and lands in the worktree domain; `classifyReleaseEntry` (`lib/src/cleanup.ts:481-556`) is a genuine shared kernel rule, so CLI/native parity is structural, not prose; the `--release`/`--prune` exclusion is enforced in the kernel (`cli/src/cleanup.ts:267-273`) and again natively (`index.ts:4082-4091`, `CLEANUP_FAILED`); the release is classified for ONE item (`entries: []` → `candidates: []`) so no corpus growth; the destructive path is guarded before any removal — the path must be a registered worktree of this repo (`lib/src/cleanup.ts:508-516`), so an adopter-controlled `worktree_path` cannot target anything else; `unlinkWorktreeClaimStamp` refuses symlinks; git calls are argv arrays; the new envelope fields are additive and documented "Additive within `schemaVersion: 1`" (`json-output.md` §cleanup, §update), so no `schemaVersion` bump is owed (`json-output.md` §Compatibility); `conventionVersion` is captured before a run that removes its own cwd; no new dependency. The docs work is real (`agents.md` §Unclaim + §Cleanup + the claim duty, `convention.md` stamp lifecycle, `json-output.md`, `opencode2.md`). The 10 acceptance tests discriminate — I read the assertions; each fails without the change (exact action lists, `worktreeCount`/`refs/heads`/stamp/env absence, `pruned: []`, `entries: []`, `commit.message = "chore(tasks): released task-alpha"`, `foreignWrites { owner: "arggon", total: 1 }`, intact footprint on refusal, `calls.remove` force flags, exit codes).

## Blocking

**M1 — `claimFootprint` fires on the ordinary `→ done` transition and names a force release where `--prune` is the correct (merge-gated) remedy.** `lib/src/update.ts:853` gates the receipt on `wasClaimed && !willBeClaimed && worktreePath != null` with no status guard; `isClaimed` requires `status === "in_progress"` (`lib/src/status.ts:52`), so ANY flip out of `in_progress` on a claimed item with a worktree qualifies — including `--status done`. So `arggon update <id> --status done` now prints `⚠ claim dropped: the worktree … still stands … release it with: arggon cleanup --release <id>` (`cli/src/cli.ts:1108-1118`) and returns `claimFootprint`. But for a `done` item `cleanup --prune` DOES reap it (terminal + merged), and the named command does not check merge state at all: it removes the worktree and `git branch -D`s the branch (`cli/src/cleanup.ts:617-624`). An agent that follows the receipt literally before merging deletes the branch carrying unmerged work. It also makes `agents.md` false for that case ("nothing else will, because `--prune` only reaps terminal, merged work") — `--prune` reaps terminal merged work by definition. No test covers the `done` path, which is why it slipped through. Fix: restrict the receipt to the unclaim (or name `--prune` for terminal statuses), and add a test for `→ done` and `→ blocked`.

**M2 — a failed removal leaves a surviving worktree with its claim stamp and `.arggon.env` destroyed, disarming the single-writer gate for every later attempt.** The release reaps compose → install link → env → stamp → THEN removes (`cli/src/cleanup.ts:593-618`; native twin `index.ts:10330-10345`). The PR's own documented outcome — "release under a dirty worktree is refused by git unless `--take-over-worktree`" — therefore leaves the worktree present and dirty with its stamp gone. `readWorktreeClaimStamp` then returns `null`, `classifyReleaseEntry` degrades to "no detection" (the documented best-effort degradation), so the NEXT release of that item by any identity is classified releasable and `--take-over-worktree` force-removes it, discarding the dirty work with no evidence of who owned it; a later `start --worktree` attach also sees no prior stamp, so the F12 warning and the take-over chain are gone (ADR 0019 decision point 4). Contrast prune (`cli/src/cleanup.ts:376-377`), which never touches the stamp, so its failure keeps everything. Fix: reap the stamp only after an observed removal (a domain removal does not take `.git/worktrees/<name>`, which is why the explicit reap exists), and/or refuse a dirty worktree during classification before anything is reaped; add the dirty-failure test asserting the stamp and env survive.

**M3 — native release commits twice and reports `commit: { skipped: "nothing to commit" }` for a commit it made.** `nativeRelease` commits the cleared record with the `released` verb and DISCARDS the result (`index.ts:4452-4457`), then pushes `clearedPaths` (4459-4460) so the run-level commit (4277-4283) commits the same path again — nothing staged → `skipped`. The CLI returns the release commit directly (`commit: release?.commit ?? commit`). Parity is an acceptance criterion, and the release arm has no cross-surface envelope test (the prune arm has one: `tools.test.ts:3101` compares against `runCli(["cleanup","--no-gh"])`); no native test asserts `commit`. Fix: return the release commit from `nativeRelease` and stop pushing to `clearedPaths`, then assert the native payload (and ideally compare both surfaces on the same fixture).

## Non-blocking (fix in this PR or file a follow-up before merge)

- **m4 docs the change leaves stale.** `README.md:322` enumerates cleanup's flags (`--prune`, `--no-commit`, `--no-gh`, `--json`) and its envelope (`{ base, candidates, pruned, failures }` + `commit`) and describes cleanup as reaping "worktrees of closed work" — no `--release`, no `--take-over-worktree`, no `release`/`released`. The agent-facing coordinator prompts still teach the old remedy: `.opencode/agents/arggon-coordinator.md:47`, `.zcode-marketplace/arggon/agents/arggon-coordinator.md:30` and the adopter template `templates/docs/zcode/arggon/agents/arggon-coordinator.md:29` all still say "never claim an item you are not dispatching … unclaim it instead", the sentence `agents.md` now amends to "unclaim **and release**". `ArggonManager/docs/claim.md` §Unclaim recovery (41-50) still describes unclaim as clearing the assignee only.
- **m5** `--take-over-worktree` without `--release` is a silent no-op (read only inside the release branch), while `start` rejects the same hatch without `--worktree` (`START_FAILED`). Align.
- **m6** `--take-over-worktree` also bypasses the "still claimed" refusal (`lib/src/cleanup.ts:495`: `&& request.takeOver !== true`), while `agents.md`/`convention.md`/`json-output.md` describe the release as "refused, never forced, while the item is still claimed". A fresh live claim has no post-stamp tracked writes, so that hatch can destroy a live owner's worktree with no evidence — and unlike `start --take-over-worktree`, nothing durable records the override (the stamp is reaped; `entry.takeOver` lives only in the envelope). Decide, document, test — or keep that refusal unconditional.
- **m7** `claimFootprint.branch` (`lib/src/update.ts:216`, 856) reports the item's `branch` AFTER the unclaim cleared it, so on the `--status todo` path it is always `null`; its JSDoc says "Branch still checked out there (the item's `branch` field was cleared)" — backwards. The release gets the real branch from the new `worktreeBranch` probe. Drop the field or document the `null`.
- **m8** human warning wording (`cli/src/cli.ts:1113`): "(its claim stamp and .arggon.env die with it)" reads as "die with the worktree"; they die with the release.
- **m9** release refusal reasons skip the `boundedEnvelopeText(..., MAX_ENVELOPE_DETAIL_CHARS)` clamp that sibling failure paths in the same function apply (count-bounded by the detector's 10-file cap, so it matches the F12 message discipline — one line for consistency).

## Verified by reading / not verified
Read: item + acceptance + worker evidence, full diff, `classifyReleaseEntry`, `releaseClaimedWorktree`, `nativeRelease`, the receipt gate, both test suites, the four touched docs, the release clause in `convention.md`/`json-output.md`/`opencode2.md`, the bundle (contains the same release logic — in sync), `mcp-parity.test.ts` (its option-surface invariant does cover the new `release`/`take_over_worktree` ↔ `--release`/`--take-over-worktree` mapping; the worker's claim 6 is credible), the skill's `references/json-contract.md` (no per-field drift there), CI status.
Unverified by execution: all gates (mine to route, not run), M1/M2/M3 observed behavior, and the schema-budget numbers (12162/12288, 16253/16384).

## Probes needed
1. `npm test` (cwd: `/home/arggon/Projects/ArggonManager-bug-unclaim-leaves-worktree-record-without-reaper`) — expected 118 files / 2178 tests pass; establishes the baseline for the worker's claim.
2. `npm run lint` && `npm run build` (same cwd) — expected clean build and a bundle byte-identical to `index.ts` (I only grep-verified the bundle's content).
3. `npm run arggon -- validate` (same cwd) — expected `ok (0 warning(s), convention v5)`.
4. M1 probe (CLI): on a disposable fixture, `arggon start <id> --worktree`, then `arggon update <id> --status done --json` — expected `claimFootprint` present (proves the over-trigger); then `arggon cleanup --release <id>` with the branch NOT merged — expected `deleted branch <b>` via `git branch -D`.
5. M2 probe (CLI): same fixture, make the worktree dirty, `arggon cleanup --release <id>` (no flag) — expected a failure AND the stamp + `.arggon.env` GONE while the worktree survives; then repeat with `--take-over-worktree` — expected `releasable: true` with no `foreignWrites` evidence (gate disarmed).
6. M3 probe (native): `tools.arggon.cleanup({ release })` on the merged-record shape — expected `commit: { skipped: "nothing to merge" /* "nothing to commit" */ }` where `arggon cleanup --release <id> --json` reports `{ hash, message: "chore(tasks): released <id>" }`.
7. `npx arggon doctor --budget` — expected `nativeToolsCatalogBytes` ≤ 12288 and the live MCP `tools/list` ≤ 16384.

### 2026-10-02 @ses_f02ab5836ffeOAxmisboIwWE4x
Coordinator ruling on the review's non-blocking findings (2026-10-02) — M1, M2, M3 blocking; the rest resolved as follows so the worker has one list.

**Must land in this PR (docs-travel-with-code / contract truth):**
- m4 — in full. `README.md:322` flags+envelope must list `--release`/`--take-over-worktree` and the `release`/`released` family; the three coordinator prompts (repo `.opencode/agents/`, `.zcode-marketplace/`, and the `templates/docs/zcode/` source the others generate from) must say "unclaim **and release**" so the generated seam cannot drift back; `claim.md` §Unclaim recovery updated. The prompt edits go in the template source; generated copies stay in sync.
- m5 — align with `start`: `--take-over-worktree` without `--release` must fail loudly (typed refusal), never silently no-op.
- m6 — coordinator decision: **the "still claimed" refusal stays unconditional; `--take-over-worktree` does not bypass it.** A re-claimed item is by definition a live owner, and the cheap remedy is the claimant's own unclaim. The hatch exists only for a *presumed-dead stamped owner on an unclaimed item*. Update the code and the docs that currently say otherwise, and test it.
- m7 — drop `claimFootprint.branch` (always `null` on the documented path) rather than document a field that lies; the release already probes the real branch via `worktreeBranch`.
- m8, m9 — cheap, fold in: reword the human warning so the stamp/env die with the release, and clamp the release refusal reasons like its sibling paths.

**Probes:** 1-3 and 7 go to `arggon-prover` (read-only gates + budget). Probes 4-6 are the M1-M3 defect demonstrations — the durable proof is the regression tests, so add one per blocking finding (→ done over-trigger, dirty-failure keeps stamp+env, native release commit parity incl. `commit` assertion), each failing without the fix. Report the probe evidence back here when green, and address the change requests before this merges.

### 2026-10-02 @ses_f01cee59fffeSatwHpianDIykt
## Review round 2 addressed — PR #596

Branch `fix/bug-unclaim-leaves-worktree-record-without-reaper` pushed to `cee40628` (item left `in_progress`).

### Blocking

**M1 — `claimFootprint` over-triggered past `done`.** The receipt gate is now unclaim-only (`lib/src/update.ts`: `wasClaimed && !willBeClaimed && newStatus === "todo" && worktreePath != null`), and its JSDoc + `json-output.md` say why: a terminal flip leaves the same footprint but `cleanup --prune` is the merge-gated remedy there, and a blocked item keeps its assignee (context, not a lease) so it is not an abandoned claim. Test `M1: only the unclaim names the release — → done and → blocked report no receipt` (`cli/src/worktree.test.ts`) asserts: no receipt on `→ done`, no `claim dropped` line for `→ blocked`, the assignee riding along on blocked, the worktree untouched, and — the sharp edge the finding described — an UNMERGED branch still protected (prune reports `removable: false`, `refs/heads/feat/task-alpha` intact).

**M2 — a failed removal stripped the single-writer evidence.** Two changes, both surfaces:
- `classifyReleaseEntry` now refuses **removal-blocking content during classification** (`worktreeDirtyRefusal`, new `parseRemovalBlockingPaths`, entry fields `blockingPaths`/`blockingTotal`), before anything is reaped. One `git status --porcelain` is shared by the F12 detection and the new gate (no second probe).
- The claim stamp is reaped only **after an observed removal**; the pre-removal read records whether a stamp existed, so the action reports which of the two ways it died: `reaped arggon-claim.json stamp` (a domain removal that leaves `.git/worktrees/<name>`) or `arggon-claim.json stamp gone with the worktree` (a real `git worktree remove` takes the git dir with it).
- Test `M2: a dirty worktree is refused with its stamp + env intact, and only the hatch forces it` (CLI) and its native twin: expected `releasable: false`, `reason` naming the uncommitted content, `blockingTotal > 0`, `blockingPaths` naming the item file, the stamp present, `.arggon.env` present, the record intact, `calls.remove === []` — observed exactly that; then with the hatch: forced removal, `action` containing `forced past its uncommitted content`, nothing left.

**M3 — the native release committed twice.** `nativeRelease` now RETURNS its `commit` and no longer pushes to `clearedPaths`; the run-level commit is prune-only (`commit = release?.commit ?? runCommit`), so both surfaces own exactly one `chore(tasks): released <id>`. Tests: `M3: the native release reports its own commit` asserts `commit.message`, a string `hash`, `skipped` undefined, the commit really landed (`git log -1`) and the tree clean; plus a **cross-surface parity test** (`M3: the release envelope is identical to cleanup --release <id> --json`) that builds twin fixtures, runs the native tool on one and the spawned CLI on the other, and compares the whole envelopes with only the commit hash normalized.

### Non-blocking (coordinator ruling)

- **m4 — docs in full.** `README.md`: the cleanup flags list `--release <id>`/`--take-over-worktree`, the envelope names `release`/`released`, plus a full release-arm paragraph. `claim.md` §Unclaim recovery rewritten (what survives an unclaim, the receipt, its unclaim-only scope) + the playbook bullet. The coordinator prompts say "unclaim **and release**" in BOTH template sources (`templates/docs/opencode/agents/`, `templates/docs/zcode/arggon/agents/`) AND their generated copies (`.opencode/agents/`, `.zcode-marketplace/arggon/agents/` — verified byte-identical to the templates modulo the generated header, because `arggon init` classifies them adopter-modified and would not rewrite them), plus the skill's `references/orchestration.md` (same remedy, same drift).
- **m5 —** `--take-over-worktree`/`take_over_worktree` without a release is a typed refusal on both surfaces (`--take-over-worktree requires --release <id>` / `take_over_worktree requires release`), mirroring `start`; tests both, CLI exit code included.
- **m6 —** the still-claimed refusal is **unconditional** (`classifyReleaseEntry` no longer consults the hatch for it) and its reason says so ("This refusal is not overridable: --take-over-worktree is for a presumed-dead stamped owner on an UNCLAIMED item"). Tests on both surfaces, plus the owner-unclaims-then-releases path. Docs (agents.md, convention.md, json-output.md, opencode2.md, README, claim.md) updated to match.
- **m7 —** `claimFootprint.branch` dropped (type, gate, docs); the release still probes the real branch via `worktreeBranch`.
- **m8 —** the human warning now reads "only the release reaps it with its claim stamp and .arggon.env".
- **m9 —** release refusal reasons clamped through `boundedEnvelopeText(..., MAX_ENVELOPE_DETAIL_CHARS)` (CLI) / `boundedNativeText(..., MAX_NATIVE_DETAIL_CHARS)` (native), on both the `failures` entry and the action `error`.

### Gates (cwd = the item worktree, on the final pushed tree)

| Gate | Command | Observed |
| --- | --- | --- |
| build | `npm run build` | ok — `build:plugin — 41 modules inlined, 457609 bytes` |
| test | `npm test` | `Test Files 118 passed (118) / Tests 2187 passed (2187)` |
| lint | `npm run lint` | clean |
| validate | `npm run arggon -- validate` | `ok (0 warning(s), convention v5)` |
| plugin drift | `npm run check:plugin` | exit 0 (bundle byte-identical to index.ts) |

Targeted: `cli/src/worktree.test.ts -t "claim release"` → 11 passed; `opencode/plugins/arggon/tools.test.ts -t "native release"` → 8 passed; `cli/src/mcp-parity.test.ts` → 17 passed (both new flags keep live MCP counterparts).

### Two things the coordinator should know

1. **History, not content.** `origin/main` advanced under this branch, so I rebased; the remote head was the pre-rebase tip and a fast-forward push is refused (**force-push is denied by policy** and I did not route around it), so the branch carries one `Merge the pre-rebase PR tip` commit whose conflicted paths all take this branch's copy — no content change. GitHub pins PR #596's base at `51d1472a`, so its file list also shows files that landed on main after the PR was opened (e.g. `bug-context-report-baseline-date-mismatch.md`, byte-identical to main). Squash-merging collapses this.
2. **The rebase surfaced a second acceptance block.** The coordinator had committed my round-1 comment from the primary checkout, so `main` carried the comment history while my branch carried the ticked boxes. I merged both — history intact, ONE `## Acceptance` block, no duplicated evidence — and re-ticked it honestly for round 2: the boxes describe exactly what this round delivers, including the M1/M2/M3 regression tests and m4's full doc set.

Open for the coordinator: merge after re-review; the `done` flip is yours.

### handoff 2026-10-02 @ses_f01cee59fffeSatwHpianDIykt (session: ses_f01cee59fffeSatwHpianDIykt) — next: Coordinator: re-review PR #596 (M1-M3 + m4-m9 addressed), squash-merge, then flip done
- branch: fix/bug-unclaim-leaves-worktree-record-without-reaper
- open questions: PR base pinned at 51d1472a + one merge commit (force-push denied); squash-merge collapses both. Blocked items are not claims, so their worktrees are not still-claimed-refused — confirm that reading.

### 2026-10-02 @Reviewer
### 2026-10-02 @Reviewer (independent re-review, read-only)
verdict: request-changes (code verdict clean — all three blocking findings are genuinely closed; two record/doc fixes remain: the PR deletes the round-1 verdict + coordinator ruling from the item body, and `convention.md` still documents the dropped `claimFootprint.branch`)

Round 1: `verdict: request-changes` (M1/M2/M3 + m4-m9). Coordinator ruling: m4 in full, m5 typed failure, m6 unconditional still-claimed refusal, m7 drop the field, m8/m9 fold in. This round re-read the round-2 diff (`e6d3a74f` → `b53a29b4`, i.e. exactly what changed since my review), not the summaries. Gates are the prover's: not re-run, taken as given (build clean, 2187 tests, lint, validate, `check:plugin` byte-identical, budgets inside caps).

## Closed — verified by reading, not re-described

**M1 — closed.** The gate is `wasClaimed && !willBeClaimed && newStatus === "todo" && updated.worktreePath != null` (`lib/src/update.ts:869`). `newStatus` is the post-update status, so no path can produce the receipt off `→ done` / `→ blocked` / `→ cancelled`: the clause is required, and `isClaimed` is `in_progress`-only (`lib/src/status.ts:52`) so `wasClaimed` alone no longer decides it. The unclaim-only reasoning is in the code comment and the JSDoc. The unmerged-branch protection is asserted, not assumed: the M1 test commits work to the feature branch, then proves `runCleanup({prune:true}).entries[0].removable === false` and `refs/heads/feat/task-alpha` still exists — so the docs' pointer to `--prune` as the merge-gated remedy is true, and a receipt on `→ done` would have contradicted a test-visible fact. The test fails without the fix (`done.claimFootprint` was defined in round 1). `claimFootprint.branch` is gone from the type, the gate and `json-output.md` (m7 ✓).

**M2 — closed, and neither stamp outcome can lie.** Classification refuses removal-blocking content BEFORE any reaping: one `git status --porcelain` is shared with the F12 detection (`lib/src/cleanup.ts:611-614`, then `parseRemovalBlockingPaths` → `worktreeDirtyRefusal` with `blockingPaths`/`blockingTotal`), so nothing is reaped on a refused run. The stamp is reaped only after the removal is observed: CLI `cli/src/cleanup.ts:625-643` (compose → install link → env → `hadStamp = readWorktreeClaimStamp` → `removeWorktree` → reap), native `opencode/plugins/arggon/index.ts:4424-4458` — same order. Honesty of the two reports: `unlinkWorktreeClaimStamp` returns `true` only when it actually removed a file (`lstat` symlink guard + `rmSync`, `lib/src/worktree.ts:1610-1634`), so "reaped arggon-claim.json stamp" can only be emitted for a real deletion; "arggon-claim.json stamp gone with the worktree" requires `hadStamp === true` (probed pre-removal) AND the post-removal unlink finding nothing — and it cannot be reported while a stamp survives, because the native path's completeness check requires the directory gone AND the worktree unregistered (`removeWorktreeObserved`, `index.ts:2876-2907`), so a domain removal that left `.git/worktrees/<name>` falls back to `git worktree remove` and the admin dir (with the stamp) really is gone. A failed removal returns before the stamp block, so the evidence stands. Both the CLI and native M2 tests assert `existsSync(stamp) && existsSync(.arggon.env)` after the refusal and `calls.remove === []`, and would fail against round 1. Accepted residual, not a blocker: if the porcelain probe itself does not answer, the blocking gate degrades to "no evidence" by design, so a dirty worktree still reaches git's refusal — but the stamp now survives, so the next attempt keeps its guard; only `.arggon.env` and the compose project are reaped on that path.

**M3 — closed.** `nativeRelease` returns its commit (`index.ts:4493`, `return { entry, actions, commit }`), the run-level commit is prune-only (`index.ts:4288-4299`: `let commit = release?.commit`, cleared only when undefined), and `clearedPaths`/`clearedIds` are gone from the native release run — so exactly one `chore(tasks): released <id>` lands and both surfaces report it identically, the same shape as the CLI's `commit: release?.commit ?? commit`. The parity test is real, not trivially equal: twin fixtures with different roots, native tool on one and the SPAWNED CLI on the other, whole envelopes deep-compared after normalizing only the root path and `commit.hash` (`tools.test.ts:3995-4032`) — with round 1's native code it fails on `commit` alone (`{skipped}` vs `{message,hash}`). The unit test also asserts the commit really landed (`git log -1`, clean tree) and `skipped === undefined`.

**Ruling items.** m5 ✓ both surfaces refuse the hatch without a release (CLI throws `--take-over-worktree requires --release <id>`, `cli/src/cleanup.ts:274-282`; native `worktreeFail(..., CLEANUP_FAILED)`, `index.ts:4097-4109`), each tested incl. the human exit code. m6 ✓ `classifyReleaseEntry` no longer consults the hatch for the still-claimed refusal (`lib/src/cleanup.ts:573`, reason now says "not overridable"), tested on both surfaces plus the owner-unclaims-then-releases path. m8 ✓ the warning now reads "only the release reaps it with its claim stamp and .arggon.env". m9 ✓ both `refuse()` paths clamp into `failures`, the action `error` AND `entry.reason`. m4 ✓ README (flags `--release <id>`/`--take-over-worktree`, envelope `release`/`released`, a full release-arm paragraph, and the unclaim-only receipt on the update paragraph), `claim.md` §Unclaim recovery + playbook bullet, `agents.md` (three refusals, the hatch's scope, unclaim-only receipt), `convention.md`, `json-output.md`, `opencode2.md`, and the skill's `references/orchestration.md`.

**Coordinator prompts — verified byte-consistent today, not by regeneration.** Diffed both pairs myself: `.opencode/agents/arggon-coordinator.md` vs `templates/docs/opencode/agents/…` and `.zcode-marketplace/arggon/agents/…` vs `templates/docs/zcode/arggon/agents/…` differ ONLY in the `---` frontmatter fence and the `# arggon:generated template="…"` marker; bodies identical, and all four say "unclaim it **and release**" with the `claimFootprint` pointer. Good catch on the `arggon init` classification — the check that matters is this one, and it passes.

**(a) "Merge the pre-rebase PR tip" — verified inert.** `git diff cee40628^1 cee40628 | wc -c` → **0**. The merge's tree is byte-identical to the branch side, so it introduced no content change at all; its second parent (`a055708b`) contributes nothing the branch did not already have. `git log origin/main ^HEAD` is empty (the branch carries all of main), and `bug-context-report-baseline-date-mismatch.md` enters via the rebase base, not the merge — byte-identical to main, as claimed.

## Open (2 fixes, both small, both in files this PR already touches)

**O1 — this PR deletes the review record from the item body, contrary to the "history intact" claim.** The reconciliation commit `51f7edbc` overwrote the item file with a copy taken before the coordinator's comments landed. In the branch's file: `grep -c Reviewer` → **0**, `grep -c "Coordinator ruling"` → **0**, while `origin/main`'s copy carries `### 2026-10-02 @Reviewer` + `verdict: request-changes` (and the coordinator's ruling). `git diff origin/main HEAD -- <item>` = 44 insertions / 42 deletions and the removed lines include that verdict and that ruling. `engineering.md` §Review verdicts makes the item body the durable record ("a later `verdict: approve` supersedes an earlier `verdict: request-changes`" presumes earlier verdicts persist) and `arggon sync --json` classifies from that body — merging as-is silently drops the round-1 findings and the ruling, and leaves an item whose only verdict reads `none`. Fix: restore both comment blocks from `origin/main` (keep ONE ticked `## Acceptance`; the scaffold placeholder at line 29 predates this and is unchanged), and append this round's verdict to the same body. Note the sequencing: comments land on `main`, so this round's comment must be re-appended after the restore — otherwise the same overwrite happens again.

**O2 — `convention.md` still documents the field m7 dropped.** `ArggonManager/docs/convention.md:491` reads `claimFootprint` receipt (`{ worktreePath, branch, release: { cli, native } }`)`; the type no longer has `branch` and `json-output.md:353`, `README.md:312` and `claim.md:59` all say `{ worktreePath, release: { cli, native } }`. Per `engineering.md` (boundaries: schema lives in `convention.md`, not in code comments; no silent schema forks in the same PR) this is the one doc that still disagrees with the shipped shape. One-token fix.

Nit, no action needed: `worktreeDirtyRefusal`/`parseRemovalBlockingPaths`/`defaultWorktreeStatus` are exported from their modules but not re-exported from the kernel entry (`lib/src/index.ts:235-242` lists only `classifyReleaseEntry`/`worktreeReleaseRefusal`). Parity is unaffected — the native surface reaches them through `kernel.classifyReleaseEntry` and the native M2 test exercises the dirty refusal that way — but the acceptance box names them as the kernel surface, so either re-export or reword the box.

## Acceptance audit (the boxes vs this diff)
All four ticked boxes are backed by content in this diff: box 1 by the `newStatus === "todo"` gate, the after-removal stamp reap, `blockingPaths`, the unconditional refusal, the m5 refusal and the per-surface commit; box 2 by the four kernel symbols plus the cross-surface envelope test and `mcp-parity` (whose option-surface invariant does cover `--release`/`--take-over-worktree` ↔ `release`/`take_over_worktree`); box 3 by 11 CLI cases and 8 native cases — one per blocking finding, all discriminating on the assertions I read; box 4 by the doc set above, all present in the diff. No box is ticked ahead of its evidence; the one wording stretch is the kernel-symbol nit above.

## Probes needed
None. O1/O2 are record/doc edits I can confirm by reading the resulting diff — they need no execution evidence, and every gate is already covered by the prover's run.

## Round 3 addressed (O1 + O2) — record/doc only, no behavior change

PR #596 branch pushed to `fe8c37b1` (fast-forward push, no force; item left `in_progress`).

**O1 — the item file on this branch had lost the review record; restored.** The file is rebuilt from the full record and now carries, in order: the scaffold, the coordinator's original finding, my round-1 evidence, the round-1 `verdict: request-changes`, the coordinator's ruling, my round-2 evidence + handoff, and the round-2 `verdict: request-changes` — with exactly ONE ticked `## Acceptance` block (the scaffold placeholder above it is untouched, as in `main`). Verified in the PUSHED tree (`origin/fix/…`):

| Check | Occurrences |
| --- | --- |
| `Reviewer` | 5 |
| `Coordinator ruling` | 3 |
| `verdict: request-changes` | 5 |
| round-2 re-review header (`independent re-review`) | 1 |
| `verdict:` header lines | `none` (self-report) + round-1 `request-changes` + round-2 `request-changes` |
| ticked / unticked acceptance boxes | 4 / 0 |
| `## Acceptance` headings | 2 (scaffold placeholder + the ticked one) |

On the sequencing caveat: I restored from the reviewer's own tree (this session's tracker root is the primary checkout, which is 3 commits ahead of `origin/main` and carries both round-2 comments), NOT from an older `origin/main` snapshot — that is why the round-2 verdict is present. This confirmation comment will land on `main` afterwards, as the reviewer predicted; nothing on this branch will overwrite it, because the branch now starts from the full record rather than a pre-review copy.

**O2 — `convention.md` aligned with the shipped envelope.** `ArggonManager/docs/convention.md:491` now documents `{ worktreePath, release: { cli, native } }` (m7 dropped `branch`) and states why there is no branch — the unclaim already cleared the item's field, and the release probes the branch from the worktree itself. Grepped the whole tree for the stale 3-field shape (`worktreePath, branch, release`): **0 hits outside this item's history** (the only remaining occurrence is the reviewer's own O2 quote, which is the record, not a doc).

**Also folded in (the re-review's nit, no action required).** The parity acceptance box named four kernel symbols but only two are on the kernel entry (`classifyReleaseEntry`, `worktreeReleaseRefusal`); `worktreeDirtyRefusal` / `parseRemovalBlockingPaths` are module-internal helpers of that rule and the native surface reaches the whole rule through `kernel.classifyReleaseEntry`. I reworded the box to name the surface it actually claims rather than re-exporting symbols nothing needs — doc-only, consistent with "no behavior change".

**Gates** (cwd = the item worktree, on the pushed tree; doc-only delta, so the full suite was not re-run):

| Gate | Command | Observed |
| --- | --- | --- |
| build | `npm run build` | ok — `build:plugin — 41 modules inlined, 457609 bytes` |
| lint | `npm run lint` | clean |
| validate | `npm run arggon -- validate` | `ok (0 warning(s), convention v5)` |

Files touched this round: exactly two — the item file and `ArggonManager/docs/convention.md` (no TS).

Open for the coordinator: re-review, squash-merge (the branch still carries the inert pre-rebase merge commit; squashing collapses it), then the `done` flip.

### handoff 2026-10-02 @ses_f01cee59fffeSatwHpianDIykt (session: ses_f01cee59fffeSatwHpianDIykt) — next: Coordinator: re-review PR #596 (O1 record restored, O2 convention.md aligned), squash-merge, flip done
- branch: fix/bug-unclaim-leaves-worktree-record-without-reaper
- open questions: Branch still carries the inert pre-rebase merge commit (force-push denied) — squash-merge collapses it
