---
type: bug
status: todo
id: bug-start-worktree-npm-ci-claim
title: start --worktree claim commit failed in a fresh worktree until a manual npm ci (tsx resolved from a sibling worktree)
parent: story-start-worktree
labels: [worktree, review-followup]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/bug-start-worktree-npm-ci-claim.md
  Leaves live only under a story. id is the filename stem: bug-start-worktree-npm-ci-claim.
  CLI `arggon create bug start-worktree-npm-ci-claim` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# start --worktree claim commit failed in a fresh worktree until a manual npm ci (tsx resolved from a sibling worktree)

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Filed from the bug-dependency-cycle-chain-rotation-duplicates-a-node worker's environment report (PR #506).

## Context
tools.arggon.start --worktree on a fresh worktree hit a claim-commit failure: the worktree had no npm ci install and tsx resolved from a SIBLING worktree's node_modules. The worker followed the reported remediation (worktree-local npm ci, then re-run start to attach) and the claim commit landed — so the failure/recover path worked as designed, but the readiness prep (link farm + workspace pre-build, see bug-native-start-worktree-no-install) did not cover this tsx/bin resolution case, and a sibling-worktree resolution can silently mask a broken worktree install.

## Acceptance
- [ ] Reproduce the cold-worktree claim-commit failure mode, or instrument start readiness to report WHICH node_modules tsx/bin resolve from (worktree vs primary vs sibling).
- [ ] Either fix readiness to verify bin/tsx resolution inside the worktree, or extend the failure error to name the observed resolution source + the exact remediation (expected vs observed in the smoke).
- [ ] npm run smoke:native-start-cold stays green; linkedNodeModules/linkedWorkspaces reporting unchanged or improved.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
Second incident of the same class, from the bug-tsx-board-dead-script worker (PR #510): start --worktree left the worktree with no install, so the claim commit failed its pre-commit gate; worker recovered via worktree-local npm install + attach. Two independent occurrences (cycle-rotation worker: npm ci + sibling tsx resolution; board worker: no install at all) — strengthening this item's reproduce-first acceptance: capture BOTH flavors (missing install; wrong resolution source) in the readiness report.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
verdict: request-changes (docs travel with the contract change — single blocker)
- BLOCKING (B1, reviewer-verified): gateBins is now part of TWO documented contracts but no normative doc moved: ArggonManager/docs/json-output.md start --worktree envelope table lacks the gateBins row (cli.ts:2275 emits it); ArggonManager/docs/agents.md:193 "ready is the conjunction of three clauses" is now four (lib/src/worktree.ts:924-929) + receipt field list omits gateBins; ArggonManager/docs/opencode2.md:111 native preparation enumeration same staleness (index.ts:2214 forwards gateBins); skills/arggon-cli/ sync line. Precedent: 9c21e293 updated all four docs in-PR for the comparable receipt extension. Fix is mechanical — land it on this PR.
- Everything else PASSES: scope (11 files, bundle regen standalone), security (read-only probe, no writes/subprocess/interpolation), kernel logic (resolution order matches npm-run semantics; empty report = unchanged semantics), tests (8 new kernel tests + CLI failure message + native receipt; smoke 23/23 with both incident flavors — coordinator re-ran worktree/start tests 46/46 and the smoke green), ticks honest.
- Contract call ENDORSED: report-only readiness with named-source errors is the right reading of the documented design; opt-in strict mode filed as follow-up (p4).
- Non-blocking notes accepted: kernel conjunction unit gap (env-injected PATH case), CLI path/external wording branches, handoff truncation (tracker field cap — re-record the full strict-mode question as a plain comment in the fix pass), stale "draft" wording, sanitize asymmetry, bounds consistency.
