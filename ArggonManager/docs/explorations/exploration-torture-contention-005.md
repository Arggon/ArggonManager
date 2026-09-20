---
exploration_id: torture-contention-005
title: "labs/torture contention flake, third recurrence — root cause and structural fix"
status: decided
created: "2026-09-16"
---

# Exploration: labs/torture contention flake, third recurrence — root cause and structural fix (torture-contention-005)

Item: `bug-torture-contention-flake3` (story-self-improvement). Family:
`bug-autocommit-silent-skip` (PR #168, 10s wall-clock retry) →
`bug-torture-contention-flake2` (PR #214, test-level retry of reported skips) →
this. `task-nothing-to-commit-masking` (PR #241) added the residue probe.

## Occurrences (CI log evidence)

1. **2026-09-14T22:33Z, run 34904682283** (PR #207 first run, branch
   `feat/task-adopt-scan-count-constant`, pre-#214/#241). `AssertionError:
   expected 'M tasks/launch/auth/story-login/task-…' to be ''` at the
   then-clean-tree assert (`labs/torture.test.ts:317` at that revision),
   scenario 2 (N=6 commenting processes), 3292ms test time. Passing on rerun.
2. **2026-09-15T16:21Z, run 34994442279** (main push, merge of PRs #229/#231;
   post-#214, 24 min before #241 merged — very likely this run triggered
   #241). `AssertionError: expected 'M tasks/launch/auth/story-login/task-a.md'
   to be ''` at `labs/torture.test.ts:341`.
3. **2026-09-15T22:30Z, PR #260 first run** (branch
   `feat/task-handoff-provenance-session-identifier-in-handoff-sections`,
   post-#214 AND post-#241). Dirty `task-f.md` per the item body; the run's
   logs were overwritten by the green re-run attempt (GitHub keeps only the
   latest attempt's logs), so the assertion detail is lost. Persisting despite
   (a) the 10s retry budget, (b) the test-level retry, (c) the residue probe.

## Root cause: what the retry-at-observation-level still misses

The shared-index clobber mechanism: a process's `git add` stages its entry;
another process's `git commit` then rewrites the index (git writes back the
index as committed), evicting the first process's staged entry; the first
process's `git commit` then reports "nothing to commit" while its mutation
sits written-but-uncommitted. git's `index.lock` serializes each single
command, NOT the logical add→commit sequence — so the retry budget (#168)
re-rolls the dice instead of removing the race.

With #214+#241 live, a dirty file should still be impossible — unless the
**test-level retry itself re-enters contention (occurrence-3 interleave)**:
the torture retry loop asserted only `ok:true` on the retry process; the
retry re-appends the comment and its own commit can lose the clobber race
again (`ok:true` + `commit.skipped`), leaving the file dirty with the final
clean-tree assertion failing. Beyond that, retries just multiply the exposed
windows: with 6 processes racing, every retry is another add→commit
interleave that CI-load scheduling can split.

## Research (dated)

- git's `index.lock` guards individual index WRITES, not logical sequences:
  concurrent `add`/`commit` remain racy, and community guidance for scripted
  git is to serialize with an external file lock ("avoid concurrent git
  processes in the same worktree … use file-locking around scripted git
  operations") (source: https://www.pluralsight.com/resources/blog/guides/understanding-and-using-gits-indexlock-file,
  2026-09-16; https://tylercipriani.com/blog/2023/11/30/racy-git/ — racy-git
  stat races around freshly staged content, 2026-09-16).
- `git commit --only -- <paths>` builds a temporary index from HEAD plus the
  working-tree content of the named paths and does NOT sweep content staged
  elsewhere (source: https://git-scm.com/docs/git-commit, 2026-09-16).
  Evaluated as candidate B; prototyped and REJECTED: under a foreign commit
  storm (~200 commits/s) the `--only` temp-index path produced NEW reported
  failure modes ("nothing to commit, working tree clean" with a differing
  worktree — the racy-stat territory above) while adding no protection the
  repo-level lock does not already give for arggon writers. Verified no data
  loss either way; the plain `git commit -m` + lock combination is the
  smaller, failure-mode-free diff.
- Vitest isolation: `fileParallelism: false` / projects with serialization
  exist (source: https://vitest.dev/guide/parallelism, 2026-09-16;
  https://github.com/vitest-dev/vitest/issues/2852), but the torture fixtures
  already use per-test temp git trees — vitest-level parallelism is NOT the
  mechanism; the race is among the 6 spawned arggon processes on ONE fixture
  repo. Test-side serialization would be the weakest possible fix
  (candidate C), kept only as a complement (the #214 retry stays).

## Candidates

- **A. Repo-level git-mutation lock** (lock.ts family, keyed on the repo's
  shared `.git` common dir so linked worktrees of one repo contend on the
  same lock): wrap the ENTIRE add+commit sequence in `commitTrackerMutation`.
  Kills the clobber class between arggon writers outright; the existing 10s
  wall-clock + reported-skip semantics apply at the outer lock; the inner
  index.lock retry stays as belt-and-suspenders for non-arggon writers.
- **B. `git commit --only -- <paths>`**: path-exact commit immune to index
  rewrites of OTHER paths. Prototyped; rejected (new racy failure modes under
  foreign writer storms; no benefit among arggon writers once A lands).
- **C. CI-load-aware test strategy** (quarantine/serialize the scenario):
  test-side only, weakest — complements, never replaces.

## Criteria

- Removes the failure MECHANISM, not the last observed interleave.
- Clean-tree contract preserved (no assertion weakening); skips stay reported.
- Minimal failure-mode surface; best-effort semantics intact (non-git trees,
  `--no-commit` unchanged).
- Cross-process, cross-worktree correctness for real agent usage.

## Findings

- Occurrence-3 interleave confirmed by code reading: the #214 retry checked
  only `ok:true`, not the retry's own `commit` payload (fixed in this item:
  the lab now fails if a retry commit skips).
- The repo-level lock makes add→commit atomic among arggon processes; with
  the lock, the clobber cannot happen between them, so reported contention
  skips can only come from non-arggon writers holding `index.lock` past the
  budget — same reported-skip semantics as before.
- Stress reproduction (documented method): a deterministic unit test
  (`N=4 concurrent processes commit distinct mutations with a clean tree` in
  `cli/src/tracker-commit.test.ts`) fails on the pre-fix code (children's
  staged entries clobber/sweep each other → skipped children) and passes
  with the lock; verified by swapping the module. Additionally, a
  tight-loop foreign committer harness (~200 commits/s) showed the old code
  losing 1–4 of 6 children per run, and the new code keeping the tree clean
  in every run (skips degrade to benign "content already committed").
  Generic CPU load (`yes` x8) did NOT reproduce (the 10s budget absorbs it).
- Evidence: `labs/torture.test.ts` ×10 green on the fix (plus ~25 further
  green scenario-2 runs across iterations); full suite 937/937 green.

## Recommendation

Candidate A (repo-level git-mutation lock), plus closing the lab's retry
assertion hole. B and C rejected as above.

## Decision

Implemented in `fix/bug-torture-contention-flake3`:
`cli/src/tracker-commit.ts` (`resolveCommonGitDir`, `trackerGitLockKey`,
add+commit under `withItemLock`), `cli/src/tracker-commit.test.ts` (5 new
tests), `labs/torture.test.ts` (retry asserts its commit landed). No separate
ADR: this is a bug fix within the existing tracker-hygiene design, not an
architecture decision.
