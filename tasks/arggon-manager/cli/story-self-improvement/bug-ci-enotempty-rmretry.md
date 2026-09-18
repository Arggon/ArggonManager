---
type: bug
status: in_progress
id: bug-ci-enotempty-rmretry
title: "CI ENOTEMPTY recurs even with rmSync retries (worktree.test.ts, run 35401030576)"
assignee: Arggon
branch: fix/bug-ci-enotempty-rmretry
parent: story-self-improvement
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T22:26:59.188Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-ci-enotempty-rmretry
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-ci-enotempty-rmretry.md
  Leaves live only under a story. id is the filename stem: bug-ci-enotempty-rmretry.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CI ENOTEMPTY recurs even with rmSync retries (worktree.test.ts, run 35401030576)

## Context

F6 from the PR #358 review. CI attempt 1 failed in
`cli/src/worktree.test.ts:35` → `removeFixtureTree` with
`Error: ENOTEMPTY: directory not empty, rmdir '/tmp/arggon-worktree-vtFOi8/.git'`
**with** `RM_RETRY` (`maxRetries: 10, retryDelay: 50`) in place
(`cli/src/test-tmp.ts:29`); attempt 2 passed. The closure of
`bug-tracker-commit-enotempty-flake` (done) therefore reduced but did not
eliminate the class — the retry window can be exhausted when a spawned git
child keeps writing into `.git` longer than ~2.75 s.

## Acceptance

- [ ] Root cause identified with evidence (which child writes `.git` after the
      test body returns; why >~2.75 s under CI load).
- [ ] Deterministic mitigation (e.g. settle/kill the child before removal, or a
      longer/adaptive retry window) with a stress repro.
- [ ] Link the failing run; no reopen of the done flake item (this is a new
      instance under the hardened helper).

## Notes

- CI-only; local runs have not reproduced it since the retry helper landed.
