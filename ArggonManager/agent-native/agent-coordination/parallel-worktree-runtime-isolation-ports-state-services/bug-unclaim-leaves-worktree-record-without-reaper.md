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
- [x] Decide + implement the contract: **both halves, split by what each surface owns.** `update` is frontmatter-only (it is the very call `cleanup` uses to CLEAR a `worktree_path` record) and cannot remove a worktree — silently destroying a working tree on a status flip is the wrong default — so it REPORTS the dropped claim's footprint on the same call that drops it (additive `claimFootprint` receipt naming the release path per surface). The release itself is an explicit, distinct `cleanup` action: `arggon cleanup --release <id>` / native `cleanup({ release })`, classified by the shared kernel rule `classifyReleaseEntry` — remove worktree + branch, reap `.arggon.env` + `arggon-claim.json` stamp, clear `worktree_path`, reported as its own `release`/`released` family (never mixed into `pruned`; `--release` and `--prune` are mutually exclusive).
- [x] Kernel-owned and CLI+native parity: the release path lives in `lib/src/cleanup.ts` (`classifyReleaseEntry` + `worktreeReleaseRefusal`), the worktree domain, not in prose; both surfaces call it and execute the same ordered steps. The native `update` tool surfaces the same contract through the kernel `claimFootprint` receipt (`release.native` = `tools.arggon.cleanup({ release: "<id>" })`) — it cannot release a worktree it does not own.
- [x] Tests: `cli/src/worktree.test.ts` "claim release — unclaim leaves nothing" (7 cases: claim → unclaim → release leaves worktree, record, branch, stamp and env gone; the in-worktree shape where the record dies with the copy; a plain unclaim of a never-worktree item is byte-identical and its release is a reported refusal; release refused while ANOTHER session's live writer holds the worktree, with the audited take-over hatch; refusal under a live claim; `--release` + `--prune` refused; the human/`--json` CLI surfaces) plus native parity in `opencode/plugins/arggon/tools.test.ts` (domain removal observed, stamp reaped, record cleared, refusal + take-over, native `update` carrying `claimFootprint`).
- [x] Docs: agents.md's claim duty (PR #589) now states the consequence and names the release path (the bullet says "unclaim **and release**"), §Unclaim explains what survives an unclaim and what the receipt reports, §Cleanup documents `--release <id>` (+ `--take-over-worktree`, the where-to-run note and the mutual exclusion); `json-output.md` §cleanup + §update carry the new payload fields, `opencode2.md` the native arm, `convention.md` the stamp-lifecycle clause.

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
