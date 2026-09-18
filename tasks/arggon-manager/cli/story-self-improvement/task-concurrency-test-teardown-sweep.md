---
type: task
status: in_progress
id: task-concurrency-test-teardown-sweep
title: "Concurrency test teardown sweep: shared retrying fixture cleanup"
assignee: Arggon
branch: feat/task-concurrency-test-teardown-sweep
parent: story-self-improvement
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T16:42:47.537Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-concurrency-test-teardown-sweep
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/task-concurrency-test-teardown-sweep.md
  Leaves live only under a story. id is the filename stem: task-concurrency-test-teardown-sweep.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Concurrency test teardown sweep: shared retrying fixture cleanup

## Context

F2 from the independent review of PR #338
(`bug-tracker-commit-enotempty-flake`). The ENOTEMPTY fix hardened
`tracker-commit.test.ts`, `worktree.test.ts` and `comment-race.test.ts`, but the
same plain `rmSync(..., { recursive, force })` teardown shape remains in sibling
concurrency tests with the mkdtemp + spawned-CLI pattern (e.g. the
`claim-race.test.ts` teardowns, and dozens of plain unit teardowns). CI has not
failed there yet; the family is simply unhardened.

## Acceptance

- [ ] A shared fixture-removal helper (retry window `{ maxRetries, retryDelay }`
      as in the fixed files) exists and is applied to the concurrency test
      files that spawn child processes; the audited file list is recorded.
- [ ] No test behavior/assertion changes; fixtures still removed deterministically
      under concurrent load (spot stress evidence).
- [ ] Full suite green; small PR to `opencode2`.

## Notes

- Prefer the helper over copy-pasting the retry constants so the family stays
  consistent (the fixed files can adopt it too if trivial).
