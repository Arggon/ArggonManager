---
type: bug
status: todo
id: bug-tracker-commit-enotempty-flake
title: "Flaky concurrency/cleanup tests on CI: tracker-commit ENOTEMPTY + comment-race fixture race"
parent: story-self-improvement
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-tracker-commit-enotempty-flake.md
  Leaves live only under a story. id is the filename stem: bug-tracker-commit-enotempty-flake.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# tracker-commit.test.ts afterEach ENOTEMPTY race on /tmp cleanup (CI flake)

## Context

CI run `35353108632` on PR #334 (head `6792c80`) failed with
`Error: ENOTEMPTY: directory not empty, rmdir '/tmp/arggon-tracker-commit-xgse1y'`
in `cli/src/tracker-commit.test.ts:40` (the `afterEach` `rmSync`), 1 failed /
1126 passed. The immediately preceding run (`35353091833`) was green and the
PR's diff touches no `cli/src` file; local `npm test` is 1127/1127 green.

Same family as `bug-tmp-fixture-leak` and `task-vitest-global-teardown` (both
done under this story), but this specific race — a spawned git child or a
still-settling fs entry inside the temp dir at cleanup time — has no open item.

**Second instance (same head, next re-run):** CI run `35353108632` failed in
`cli/src/comment-race.test.ts` — "N=4 concurrent comments on the SAME item"
observed `id 'task-race' not found under tasks/` instead of the lock error: the
concurrent CLI processes raced the fixture itself. Two different
concurrency/cleanup tests, both untouched by the PR being reviewed, failed on
consecutive runs of the same head — the family (temp-fixture lifecycle +
parallel CLI processes under CI load) should be hardened together.

## Acceptance

- [ ] The race is explained in the item (what writes into the temp dir after
      the test body returns) and the cleanup becomes robust: bounded `rmSync`
      retries and/or waiting for spawned git processes to exit before removal.
- [ ] Stress evidence: the file (or the suite) runs N consecutive times green
      (e.g. 20x) with the fix, recorded in the item.
- [ ] No shared `/tmp` name collisions across concurrent runs (unique prefix
      per test/worker) reviewed while fixing.
- [ ] Full suite green; CI stable across two consecutive PR runs.

- [ ] `comment-race.test.ts` N=4 no longer loses its fixture under CI load (deterministic fixture setup/teardown or serialized creation), with stress evidence.
## Notes

- Surfaced by the PR #334 review (blocking only in the sense that CI must be
  re-run); fix in a small PR to `opencode2`.
