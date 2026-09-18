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

- [x] Root cause identified with evidence (which child writes `.git` after the
      test body returns; why >~2.75 s under CI load).
- [x] Deterministic mitigation (e.g. settle/kill the child before removal, or a
      longer/adaptive retry window) with a stress repro.
- [x] Link the failing run; no reopen of the done flake item (this is a new
      instance under the hardened helper).

## Notes

- CI-only; local runs have not reproduced it since the retry helper landed.

### 2026-09-18 @Arggon
## Root cause (bug-ci-enotempty-rmretry)

**Writer.** `git commit`/`git merge` spawn a detached
`git maintenance run --auto --quiet --detach` child. Verified with
`GIT_TRACE2_EVENT` on a fixture-like repo: the commit's own trace2 stream
carries `"child_start" ... "argv":["git","maintenance","run","--auto","--quiet","--detach"]`.
`maintenance_run_tasks()` (git `builtin/gc.c`) takes the repo lock
`.git/objects/maintenance.lock` **before** `daemonize()` and rolls it back only
after the background tasks, so the lock is held for the daemon's whole
lifetime; under CI CPU starvation that lifetime can exceed the retry window.

**Why the ~2.75s retry window cannot cover it.** Node 22's recursive `rmSync`
(`internal/fs/rimraf.js`, `_rmdirSync`) removes a directory's children ONCE and
then only re-tries the bare `rmdir` (maxRetries x retryDelay = 10 x 50ms with
`RM_RETRY`); it never re-reads the children. An entry that arrives after that
single children pass — the daemon's held/recreated lock — is invisible to every
remaining attempt, and the error surfaces as the ENOTEMPTY `rmdir` on `.git`.

## Evidence

- Failing run: https://github.com/Arggon/ArggonManager/actions/runs/35401030576
  (attempt 1, `cli/src/worktree.test.ts:35`,
  `ENOTEMPTY rmdir '/tmp/arggon-worktree-vtFOi8/.git'`; attempt 2 passed).
- trace2 control: plain `git commit` → `child_start` for
  `maintenance run --auto`; same commit with `maintenance.auto=false` → no
  child at all. Pinned in `cli/src/test-tmp.test.ts`.
- Node 22 race harness (16 tight-loop writers recreating `.git` entries during
  teardown; `/usr/bin/node` v22.23.2, same major as CI): old rmSync-only helper
  throws **19/20** `ENOTEMPTY rmdir '<fixture>/.git'` at ~2.75s (30/30 on the
  `.git/objects` variant); the new `removeFixtureTree` settles **0/20**.
- In-suite stress repro: 4 parallel worker processes x 2 worktree-style
  workloads (init / commit / merge / worktree add+remove) under 4 CPU loaders:
  every teardown clean and every trace free of maintenance children.
- Suite: `npm test` 76 files / 1265 tests passed (private TMPDIR);
  `npm run lint` clean; `npm run build` clean; `arggon validate` ok 0/0;
  `arggon spec validate` ok (16 docs, 0 warnings).

## Mitigation

1. Fixture repos opt out: `disableAutoMaintenance(dir)` (right after
   `git init`, before the first commit) in `worktree.test.ts` and
   `tracker-commit.test.ts` — with `maintenance.auto=false` commit/merge spawn
   no detached child, so the writer never exists.
2. `removeFixtureTree` now re-reads the tree from scratch on retriable errors
   (short inner window, 15s deadline), so a late writer from any other source
   is settled instead of being retried with bare rmdirs.

No reopen of `bug-tracker-commit-enotempty-flake` (done); this is a new instance
under the hardened helper.

### handoff 2026-09-18 @Arggon — next: Review draft PR #362 (base opencode2, CI green: https://github.com/Arggon/ArggonManager/actions/runs/35403358563) — root-cause trace2 test + settling helper + fixture opt-out; merge it, verify on mai…
- branch: fix/bug-ci-enotempty-rmretry
- open questions: The removeFixtureTree backstop also covers the other fixture suites (claim-race, cascade, comment-race, config-race, board-serve, mcp-smoke, show, torture); extending disableAutoMaintenance to those …
