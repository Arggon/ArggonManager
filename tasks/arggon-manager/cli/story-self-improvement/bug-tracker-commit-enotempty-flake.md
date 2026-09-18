---
type: bug
status: in_progress
id: bug-tracker-commit-enotempty-flake
title: "Flaky concurrency/cleanup tests on CI: tracker-commit ENOTEMPTY + comment-race fixture race"
assignee: Arggon
branch: fix/bug-tracker-commit-enotempty-flake
parent: story-self-improvement
labels: []
priority: p1
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T14:33:56.017Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-tracker-commit-enotempty-flake
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

### 2026-09-18 @Arggon
### New instance (2026-09-18): `worktree.test.ts` afterEach ENOTEMPTY

CI run [35355987158](https://github.com/Arggon/ArggonManager/actions/runs/35355987158/job/105635334028) on PR #336 (`task-opencode-v2-doctor-polish`, head `b00bbeb`) failed with `Error: ENOTEMPTY: directory not empty, rmdir '/tmp/arggon-worktree-my80VX/.git'` in `cli/src/worktree.test.ts` > `start --worktree` > "attaches on re-run instead of failing or duplicating the worktree" → `removeFixtureTree` (afterEach `rmSync`). Result: 1 failed / 1131 passed; the PR diff touches only `cli/src/doctor.ts`, `cli/src/doctor.test.ts`, `cli/src/docs.ts` and the item file, so this is the same temp-fixture/parallel-git cleanup family tracked here (no separate item; this is the worktree.test.ts sibling the `task-vitest-global-teardown` review mentioned). Local full suite is 1132/1132 green.

### 2026-09-18 @Arggon
#### Root causes, fix, stress evidence

**PR:** draft `fix(bug-tracker-commit-enotempty-flake): deterministic tmp cleanup for concurrency tests` (opened right after this comment).
**Files:** `cli/src/tracker-commit.test.ts`, `cli/src/worktree.test.ts`, `cli/src/comment-race.test.ts`; no product code touched. Product finding filed as **bug-comment-torn-read**.

#### 1. ENOTEMPTY (tracker-commit + worktree): recursive rm vs a still-settling writer

The `afterEach` used `rmSync(dir, { recursive: true, force: true })`. Recursive removal is readdir → unlink children → rmdir; if any entry is present at the final `rmdir` (or appears between readdir and rmdir), `rmdir` fails `ENOTEMPTY`. `force: true` only suppresses `ENOENT` — it does **not** cover ENOTEMPTY — and Node only retries `ENOTEMPTY`/`EBUSY`/`EPERM` when `maxRetries > 0` (default is **0**). This is documented, expected shape (nodejs/node#54561 was closed with "pass maxRetries"; Next.js CI hit the same). CI load widens the window.

What can still be writing after the test body returns:

- **git children:** `git commit` forks a detached `git maintenance run --auto --detach` child on every commit — verified locally with `GIT_TRACE=1` (`run_command: git maintenance run --auto --quiet --detach`). Tiny fixtures make it a no-op, but on an oversubscribed runner it (and other spawned git processes) can still be winding down inside the fixture while cleanup deletes it.
- **test-spawned children:** `tracker-commit.test.ts` spawned detached node children to release `index.lock`/the repo lock (`releaseLockAfter`, the repo-lock test) with `child.unref()` and never awaited them, so their fs work could overlap teardown.
- Ordering was already correct in comment-race (children awaited on `close` before `finally` teardown); the fixture dirnames come from `mkdtempSync`, so there are no shared `/tmp` name collisions across concurrent runs (reviewed in all three files; worktree siblings derive from the unique mkdtemp basename).

**Failure mode reproduced deterministically** (scratch harness: 6000-file tree, a child creating root entries for ~400 ms while cleanup runs): default `maxRetries=0` → **8/8 runs ENOTEMPTY**; same tree with `{ maxRetries: 20, retryDelay: 50 }` → **0/8**.

CI references: run `35353108632` attempt 1 (`tracker-commit.test.ts:40`, test "tracker auto-commit on update > commits ONE commit …"), run `35355987158` (`worktree.test.ts:24` `removeFixtureTree`, rmdir of `.git`).

**Fix:** tracker-commit tracks the lock-release children (`spawnLockRelease`) and afterEach awaits them (2 s grace, then SIGKILL) before removing fixtures; all three files remove with `{ maxRetries: 10, retryDelay: 50 }` (`removeFixtureTree` also retries the `<base>-task-*` siblings).

#### 2. comment-race "lost fixture": the fixture was never deleted — it is a torn read of the in-place write

The CI failure (`id 'task-race' not found under tasks/` instead of the lock error, run `35353108632` attempt 2) is not fixture deletion: the test awaits every spawned CLI child on `close` before teardown, and the dir is `mkdtemp`-unique.

Actual mechanism: `runComment` (`cli/src/comment.ts`) serializes the read-modify-write with `withItemLock`, but the **first `loadItems` lookup (~line 101) runs outside the lock**, and the write is a plain in-place `writeFileSync` (open+truncate, then write) — not `writeFileAtomic` (`cli/src/atomic.ts`). A contender scanning `tasks/` inside the truncate window reads an **empty** file; `softTryLoadItem` treats a file that does not start with `---` as `skip`, so `itemsById` has no entry and the process reports "not found".

**Reproduced locally:** 100 fixture races (4 parallel harnesses × 25 iterations, 3 torn-read reader children each + the 4 real `comment --json` processes): **388 observations of the file with length 0**, and **1 CLI process failed with exactly `id 'task-race' not found under tasks/`** once the write window was widened under load — the CI failure, reproduced.

**Test-side handling (assertions unchanged):** a `COMMENT_FAILED` + `not found under tasks/` result is routed to the test's existing sequential-retry path (the same one the clean 10 s lock-timeout uses); every other failure still hits the original `expect`s, and a persistent not-found still fails at the retry's `expect(status)`. Deterministically verified: hide the item during the concurrent phase, restore before retries → all 4 processes report "not found", all 4 retries land, and the final "exactly once" + validate assertions pass. The product race itself is **bug-comment-torn-read** (atomic write + locked initial read; drop this retry when it lands).

#### 3. Stress evidence (fixed side)

- `npx vitest run cli/src/tracker-commit.test.ts cli/src/worktree.test.ts cli/src/comment-race.test.ts` **10 consecutive times: 10/10 green** (68/68 tests each → 680 executions), while **3 pre-fix peer loops ran the same files concurrently from a separate worktree** (4 vitest processes at once, CI-like load). Summary logs kept during the run.
- Pre-fix peer loops: 30 runs, 0 failures — the CI flake is rare and did not reproduce here; the before-evidence is the CI logs plus the deterministic reproductions above.
- Full suite after the change: **69 files / 1135 tests green, twice consecutively**; `npm run lint`, `npm run build`, `arggon validate` (0 warnings), `arggon spec validate` (16 docs, 0 warnings) all green.

Acceptance mapping (left unticked for the coordinator): race explained (this comment), cleanup robust (maxRetries + child settlement), stress evidence (above), no shared `/tmp` collisions (reviewed), full suite green (above); "CI stable across two consecutive PR runs" needs the PR checks after opening.
