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
