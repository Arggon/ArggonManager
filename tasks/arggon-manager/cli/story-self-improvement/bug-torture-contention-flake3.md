---
type: bug
status: in_progress
id: bug-torture-contention-flake3
title: "labs/torture auto-commit contention flakes in CI for the THIRD time (post-#214 hardening)"
assignee: Arggon
branch: fix/bug-torture-contention-flake3
parent: story-self-improvement
labels: []
created: "2026-09-15"
updated: "2026-09-16"
claimed_at: "2026-09-16T11:42:40.109Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-torture-contention-flake3.md
  Leaves live only under a story. id is the filename stem: bug-torture-contention-flake3.
  CLI `arggon create bug torture-contention-flake3` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# labs/torture auto-commit contention flakes in CI for the THIRD time (post-#214 hardening)

## Context

THIRD CI occurrence of the labs/torture scenario-2 contention flake (family: bug-autocommit-silent-skip -> flake2 -> this). This time in PR #260's first CI run (2026-09-15): dirty `task-f.md` after the run, passing on rerun and locally — PERSISTING despite (a) the 10s wall-clock retry budget (#168) and (b) the test-level retry of reported skips (#214) and (c) the residue-probe reporting (#241). The incremental-hardening approach is not converging: each fix addresses the last observed interleave, and CI load produces a new one.

## Acceptance

- [x] Root-cause pass with fresh eyes: collect ALL observed interleaves (flake, flake2, this) and identify what the retry-at-observation-level still misses (e.g. a skip flavor whose retry re-enters contention, or a window between the residue probe and collection)
- [x] Structural fix landed: either real isolation (per-fixture GIT_DIR/TMPDIR so the 6 workers race only each other, not system git state) or an explicit CI-load-aware strategy — with the clean-tree contract PRESERVED (no assertion weakening)
- [x] Evidence: green across repeated runs AND a stress reproduction (documented method), not a single lucky pass

## Notes

Root cause (see docs/explorations/exploration-torture-contention-005.md):
git's index.lock serializes single commands, not the logical add→commit
sequence; the #168 retry re-rolls the clobber race, and the #214 lab retry
only asserted `ok:true` — its own commit could re-enter contention and skip
again, leaving the mutation dirty (the occurrence-3 interleave).

Structural fix (option A, repo-level git-mutation lock): the whole add+commit
sequence in commitTrackerMutation now runs under a tmpdir withItemLock keyed
on the repo's shared .git common dir (worktrees included) — the clobber class
is structurally impossible between arggon writers. `--only` (option B) was
prototyped and rejected (new racy failure modes under foreign commit storms);
test-side serialization (option C) kept only as the existing #214 complement.

Evidence: labs/torture ×10 green (+ ~25 green scenario-2 runs while
iterating); full suite 937/937; lint + build green. Stress reproduction: the
new `N=4 concurrent processes` tracker-commit test fails deterministically
on the pre-fix code and passes with the lock; a ~200 commits/s foreign
committer harness lost 1–4 of 6 children per run on old code, tree stays
clean on new. Follow-up (not filed): scenario 1 (N=8 mixed) flaked once
locally and in CI run 34998411032 (`labs/torture.test.ts:248`, sibling status
`in_progress` vs `done`) — a cascade lost-update in update.ts's multi-file
write path, distinct from this item's commit-contention family.
