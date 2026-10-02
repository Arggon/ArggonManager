---
type: bug
status: todo
id: bug-unclaim-leaves-worktree-record-without-reaper
title: "Unclaiming a claimed item (update --status todo) keeps worktree_path + branch + claim stamp, and cleanup never reaps a non-done item"
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
- [ ] Decide + implement the contract: either unclaiming a claim that CREATED a worktree also releases it (remove the worktree + branch, clear `worktree_path`, reap the env file and the claim stamp, reported as a distinct `cleanup` action), or the contract refuses to advise unclaim and names the path that does release it.
- [ ] Kernel-owned and CLI+native parity: the release path lives where the worktree domain lives (`cleanup`), not in prose; the native `update` tool must surface the same contract (it cannot release a worktree it does not own).
- [ ] Tests: claim → unclaim leaves nothing (worktree gone, `worktree_path` cleared, branch handled, stamp gone); a plain unclaim of a never-worktree item is unchanged; an item that is unclaimed while ANOTHER session holds the worktree is refused (no stealing a live writer's worktree).
- [ ] Docs: agents.md's claim duty (PR #589) stops naming bare unclaim without this consequence, or states it and points at the release path.

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
