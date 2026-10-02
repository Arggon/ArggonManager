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

Filed from exploration-worktree-env-isolation-017 finding F12 (PR #523): the seam-pin worker's CLAIMED worktree was written into by a concurrent session mid-task (disclosed on PR #544; the writer finished + merged the item's own work). Single-writer ownership is convention, not enforcement.

## Acceptance

- [x] Decide the mechanism (claim-lease stamp on the worktree dir, a lockfile the native tools honor, or start/attach-time detection warning on foreign recent writes) — exploration 017 §F12 + ADR 0019 carry the context. DECIDED: claim stamp (`arggon-claim.json` in the worktree's git dir — no worktree pollution, no cleanup lifecycle) + attach-time detection comparing `git status --porcelain` mtimes against the stamp; foreign identity + newer writes = the F12 signature.
- [x] Implement detection first (warn on foreign-session writes newer than the claim); enforcement (refuse) can be an x-tracker flag like strict-gate-bins. BOTH in this PR: report-only `claim.foreignWrites` warning on CLI + native receipts; `x-tracker.strict-worktree-writes: true` refuses the attach before any item mutation (mirrors strict-gate-bins).
- [x] Tests: concurrent-writer scenario pinned; normal single-writer flow unchanged. Kernel 11 new tests, CLI 8 (incl. byte-identity same-identity attach + plain-start no-field), native 3 (stamp+warn, default identity, strict refusal); full suite 2094 green.
- [x] Docs: the ownership convention stated where adopters read it. docs/agents.md §Single-writer ownership + docs/convention.md x-tracker section (stamp, detection semantics, flag).

## Notes

### 2026-10-01 @Coordinator

Filed from exploration-worktree-env-isolation-017 finding F12 (PR #523): the seam-pin worker's CLAIMED worktree was written into by a concurrent session mid-task (disclosed on PR #544; the writer finished + merged the item's own work). Single-writer ownership is convention, not enforcement.

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

### handoff 2026-10-02 @ses_f061e465dffe8vBlyjt8OkhAgz (session: ses_f061e465dffe8vBlyjt8OkhAgz) — next: Review PR #568 (draft): mechanism, strict-flag shape vs strict-gate-bins, default-identity tests; merge is the completion step.

- branch: feat/task-single-writer-worktree-enforcement
- open questions: Commit-log detection for already-committed foreign work?; CLI session-id passthrough for uniform identities?; ADR 0019 amendment for the claim stamp?

### 2026-10-02 @Coordinator

verdict: request-changes (small, surgical) — the reviewer's stamp-overwrite defect is real and must land in-PR: a refused strict attach rewrites the claim stamp BEFORE the refusal check, so a retry skips detection entirely and can land silently over the stamped owner's uncommitted work (the gate unlocks itself). Fix: kernel-level suppression of the re-stamp when foreignWrites fired, on both surfaces, + the 3-step unlock-sequence pin test. Also in-PR: README + json-output.md §start sentences and the PR's methodology impact class.
Everything else PASSES: scope (cleanup.ts zero-touch — the sibling fence held), atomic git-dir stamp (never dirties porcelain), bounded mtime detection with the identity gate before the scan, strict escalation mirroring strict-gate-bins, #533 default byte-identity discipline on both surfaces, honest uncommitted-window-only limitation.
Rulings: (a) cross-surface identity asymmetry accepted for detection-first p3 (the mixed CLI-start/native-attach benign warning IS the F12 shape); (b) ADR 0019 amendment warranted but not merge-blocking (0019 is Proposed; contracts documented in convention.md/agents.md in-PR) — commissioned as a story follow-up; (c) the dead-owner recovery hatch documented in-PR, a designed hatch filed as a follow-up.

### 2026-10-02 @Coordinator

Fix landed in-PR on this branch: `prepareWorktreeClaim` returns the detection report WITHOUT re-stamping when it fires, so a refused (or warned) attach cannot hand ownership to the attacher and a retry re-detects the same evidence instead of claiming silently over the stamped owner's uncommitted work. Pinned by the anti-unlock tests (`start.test.ts` — the exact 3-step unlock sequence, negative-controlled: without the fix the stamp becomes the refused caller) and by the kernel test (the stamp stays the previous owner). The strict refusal message now names the dead-owner manual recovery (`rm <git-dir>/arggon-claim.json`), documented in convention.md + agents.md. Also in-PR: README §`arggon start` + json-output.md `claim` row/prose (receipt shape, strict refusal token, anti-unlock invariant) and the PR's methodology impact class (Behavioral, ADR 0016). Full suite 2095 green, lint/build/check:plugin/smoke:native-start-cold green, validate ok:true.
