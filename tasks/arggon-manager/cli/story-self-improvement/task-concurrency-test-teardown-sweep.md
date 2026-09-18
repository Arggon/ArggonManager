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

### 2026-09-18 @Arggon
Evidence (worker Arggon, branch feat/task-concurrency-test-teardown-sweep).

Helper: cli/src/test-tmp.ts — RM_RETRY = { recursive, force, maxRetries: 10, retryDelay: 50 } + removeFixtureTree(path): retrying recursive rm plus the `<basename>-task*` sibling-worktree cleanup, safe on an already-removed path.

Adopted (concurrency test files that spawn async child processes), 9 files:
- cli/src/claim-race.test.ts — plain rmSync + local non-retrying removeFixtureTree -> helper (afterEach + both per-test finally)
- cli/src/comment-race.test.ts — inline retry options -> helper
- cli/src/config-race.test.ts — inline retry options -> helper
- cli/src/tracker-commit.test.ts — local RM_RETRY -> helper
- cli/src/worktree.test.ts — hardened precedent; local RM_RETRY/removeFixtureTree -> helper
- cli/src/board-serve.test.ts — plain afterAll + both per-test finally -> helper
- cli/src/cascade.test.ts — plain afterEach + inline race teardown -> helper
- cli/src/mcp-smoke.test.ts — plain afterEach -> helper
- labs/torture.test.ts — 9 plain teardown sites -> helper

Audited, not adopted (no async child processes / no fixtures; item scope is the spawned-child concurrency family): the remaining ~45 cli/src/*.test.ts plain rmSync afterEach teardowns (spawnSync-only or in-process), opencode/plugins/arggon/index.test.ts (no child processes), smoke/** (no temp fixtures). No assertion or behavior changes anywhere; only teardown calls + comments.

Stress (parallel peer load, private TMPDIR per process, zero failures / zero leftover fixture dirs):
- r1 claim-race || tracker-commit: exit 0/0, leftovers 0/0
- r2 comment-race || config-race + mcp-smoke: exit 0/0, leftovers 0/0
- r3 labs/torture || worktree: exit 0/0, leftovers 0/0
- r4 board-serve || cascade: exit 0/0, leftovers 0/0

Gates (private TMPDIR): npm run build ok; npm run lint ok; npm test 73 files / 1190 tests passed; arggon validate ok (0 warnings, convention v3); arggon spec validate ok (16 docs, 0 warnings).

Finding for coordinator (pre-existing, outside this item's file scope): cli/src/show.test.ts creates `arggon-show-*` mkdtemp dirs with NO teardown at all (8 leftover dirs observed after a full-suite run). It spawns no children and has no rmSync, so it is not part of the spawned-child teardown family — candidate follow-up task under this story.
