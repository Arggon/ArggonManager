---
type: task
status: in_progress
id: task-single-writer-worktree-enforcement
title: "Single-writer worktree enforcement: detect + refuse concurrent writes into a claimed worktree"
assignee: Arggon
branch: feat/task-single-writer-worktree-enforcement
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, devex]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T23:52:28.218Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-single-writer-worktree-enforcement
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-single-writer-worktree-enforcement.md
  Leaves live only under a story. id is the filename stem: task-single-writer-worktree-enforcement.
  CLI `arggon create task single-writer-worktree-enforcement` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Single-writer worktree enforcement: detect + refuse concurrent writes into a claimed worktree

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from exploration-worktree-env-isolation-017 finding F12 (PR #523): the seam-pin worker's CLAIMED worktree was written into by a concurrent session mid-task (disclosed on PR #544; the writer finished + merged the item's own work). Single-writer ownership is convention, not enforcement.

## Acceptance
- [x] Decide the mechanism (claim-lease stamp on the worktree dir, a lockfile the native tools honor, or start/attach-time detection warning on foreign recent writes) — exploration 017 §F12 + ADR 0019 carry the context. DECIDED: claim stamp (`arggon-claim.json` in the worktree's git dir — no worktree pollution, no cleanup lifecycle) + attach-time detection comparing `git status --porcelain` mtimes against the stamp; foreign identity + newer writes = the F12 signature.
- [x] Implement detection first (warn on foreign-session writes newer than the claim); enforcement (refuse) can be an x-tracker flag like strict-gate-bins. BOTH in this PR: report-only `claim.foreignWrites` warning on CLI + native receipts; `x-tracker.strict-worktree-writes: true` refuses the attach before any item mutation (mirrors strict-gate-bins).
- [x] Tests: concurrent-writer scenario pinned; normal single-writer flow unchanged. Kernel 11 new tests, CLI 8 (incl. byte-identity same-identity attach + plain-start no-field), native 3 (stamp+warn, default identity, strict refusal); full suite 2094 green.
- [x] Docs: the ownership convention stated where adopters read it. docs/agents.md §Single-writer ownership + docs/convention.md x-tracker section (stamp, detection semantics, flag).

### 2026-10-02 @ses_f061e465dffe8vBlyjt8OkhAgz
Implementation complete on branch feat/task-single-writer-worktree-enforcement — PR #568 (draft, not merged).

## Mechanism (decided + implemented)
- Claim stamp: `arggon-claim.json` written in the worktree's GIT DIR (not the work tree) at every start --worktree: { identity, assignee, item, branch, claimedAt, surface }. Git-dir location = never dirties porcelain, never blocks `git worktree remove`, zero cleanup lifecycle (deliberately NOT a worktree-root marker like .arggon.env, which wedges pruning). Checked what start already records: item frontmatter (assignee/claimed_at) is per-item, .arggon.env is worktree-identity — the per-worktree SESSION identity was the missing piece; no duplication.
- Detection: on ATTACH, previous stamp read before replace; foreign identity + tracked files with mtime > stamp.claimedAt (one `git status --porcelain` + stat per dirty path, 10 named / exact total) -> named warning. CLI identity = assignee; native identity = calling session id (threaded tool.sessionID into nativeStart).
- Enforcement: `x-tracker.strict-worktree-writes: true` refuses the attach before any item mutation (reason "strict worktree-write gate refused" native-side), mirroring strict-gate-bins (parse in convention.ts, ignore-unknown preserved).

## Gates (expected vs observed)
- npm test: 115 files / 2094 tests green — 26 new (11 kernel worktree, 8 CLI start, 4 convention parsing, 3 native plugin).
- lint green; build green; check:plugin green AFTER the separate `chore: regen plugin bundle` commit (274f70f8).
- smoke:native-start-cold: green on rerun; first run had ONE ordering check fail ("the final text round preceded the tool round") in the scripted host drive — check untouched by this diff, judged host-drive flake, second run fully green including teardown.
- arggon validate: ok:true (0 warnings).

## Default-identity proof (#533 discipline)
- Same-identity re-attach: claim receipt exactly { stamped: true }, no warning, claim lands (CLI + native pinned).
- Plain start: no claim field (pinned). Kernel callers without deps.claim: receipt shape unchanged (pinned).

## Commits
408eff7a feat(start): detect concurrent writers in a claimed worktree (claim stamp + strict-worktree-writes); 274f70f8 chore: regen plugin bundle; d707a36d chore(tasks): ticked acceptance.

## Findings for the coordinator
1. Detection covers the UNCOMMITTED collision window; foreign work already committed is history (documented). Commit-log-based detection was deliberately out of scope.
2. Cross-surface identity asymmetry: a native-stamped (ses_x) worktree attached via CLI (identity=assignee) fires detection when newer writes exist — accepted (warning only by default); a CLI->session-id passthrough env could make identities uniform later if wanted.
3. ADR 0019 (Proposed) doesn't cover the claim stamp; convention.md + agents.md now do. Say the word if you want an ADR amendment.
