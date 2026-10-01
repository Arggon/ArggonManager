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
