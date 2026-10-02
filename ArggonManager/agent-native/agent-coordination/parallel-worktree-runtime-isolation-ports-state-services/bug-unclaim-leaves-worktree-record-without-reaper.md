---
type: bug
status: in_progress
id: bug-unclaim-leaves-worktree-record-without-reaper
title: "Unclaiming a claimed item (update --status todo) keeps worktree_path + branch + claim stamp, and cleanup never reaps a non-done item"
assignee: Arggon
branch: fix/bug-unclaim-leaves-worktree-record-without-reaper
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, tracker]
priority: p2
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T18:59:16.099Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-unclaim-leaves-worktree-record-without-reaper
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
- [x] Kernel-owned and CLI+native parity: the release path lives in `lib/src/cleanup.ts` (`classifyReleaseEntry`, `worktreeReleaseRefusal`, `worktreeDirtyRefusal`, `parseRemovalBlockingPaths`), the worktree domain, not in prose; both surfaces call it and execute the same ordered steps, and the release arm now has a **cross-surface envelope test** (`tools.test.ts`, release vs `cleanup --release <id> --json` on twin fixtures, commit hash normalized) plus MCP parity for both flags.
- [x] Tests: `cli/src/worktree.test.ts` "claim release — unclaim leaves nothing" (11 cases) and `opencode/plugins/arggon/tools.test.ts` "native release of a dropped claim" (8 cases), including one regression test per blocking finding — M1 (`→ done` / `→ blocked` report no receipt; the unmerged branch stays protected), M2 (a dirty worktree is refused with stamp + env intact; only the hatch forces it), M3 (the native release reports its own commit, never a skipped nothing-to-commit, plus the CLI-parity comparison) — and the original three: claim → unclaim → release leaves nothing; a plain unclaim of a never-worktree item is byte-identical; a release while another session holds the worktree is refused (no stealing a live writer's worktree).
- [x] Docs: agents.md's claim duty (PR #589) states the consequence and names the release path ("unclaim **and release**"), §Unclaim + §Cleanup document the contract (unclaim-only receipt, the three refusals, the hatch's scope), `claim.md` §Unclaim recovery + playbook, `json-output.md` §cleanup/§update, `opencode2.md`, `convention.md` (stamp lifecycle), and **m4 in full**: README's cleanup flags/envelope + release arm, and the coordinator prompts — the two template sources (`templates/docs/opencode/agents/`, `templates/docs/zcode/arggon/agents/`) plus their generated copies (`.opencode/agents/`, `.zcode-marketplace/arggon/agents/`, verified byte-identical to the templates modulo the generated header) and the skill's `references/orchestration.md`.


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
- branch: fix/bug-unclaim-leaves-worktree-record-without-reaper
- open questions: Release refuses a dirty worktree unless --take-over-worktree is armed — intended? MCP schema props kept bare to stay under the 16 KiB budget

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
