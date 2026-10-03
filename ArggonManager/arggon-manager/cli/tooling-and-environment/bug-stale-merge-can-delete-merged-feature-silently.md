---
type: bug
status: todo
id: bug-stale-merge-can-delete-merged-feature-silently
title: A stale branch merge silently DELETES merged code (implementation and its test together) and goes green — nothing in the gates catches a `D` row against main
parent: tooling-and-environment
labels: [ci, git]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-stale-merge-can-delete-merged-feature-silently.md
  Leaves live only under a story. id is the filename stem: bug-stale-merge-can-delete-merged-feature-silently.
  CLI `arggon create bug stale-merge-can-delete-merged-feature-silently` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# A stale branch merge silently DELETES merged code (implementation and its test together) and goes green — nothing in the gates catches a `D` row against main

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Caught in flight, 2026-10-03, by the worker on PR #586 (task-explore-adopter-feedback-channel) while it merged `main` — and ruled a gap by the round-2 reviewer, who noted `docs/agents.md:31` forbids the worker filing it, so the coordinator does.

**The failure.** PR #586 sat unmerged for hours. Meanwhile PRs #605 and #606 landed `cli/src/adapters.ts` and `cli/src/adapter-selection.test.ts`. The worker then merged `origin/main` and diffed — and found its branch would have carried `D cli/src/adapters.ts` and `D cli/src/adapter-selection.test.ts` into the merge: **a merged feature, deleted, implementation and test together, with the lane green.**

Why it is silent, and this is the part that matters:
- git resolves a file deleted on one side and untouched on the other as a delete; there is no conflict to notice
- deleting the implementation AND its test is self-consistent — nothing left to fail
- the CI lanes that exist check build/test/lint, not "did this branch remove code main has"
- the wave planner groups by file-disjointness, which assumes merges stay off each other's toes; it does not assume they do

The worker found this only because it diffed against main after merging — not from anything in its own checklist, which is the honest measure of how invisible the shape is.

Acceptance:
- [ ] A branch that would delete a file present on main is caught: either a CI check comparing the PR's diff for `D` rows against main, or a merge-time guard
- [ ] The check must not fire on legitimate deletions (a file removed on main and still present on the branch is the mirror case and must be equally caught, not silently kept)
- [ ] Consider the pair shape explicitly — an implementation deleted together with its test is the stealthiest form and deserves a named case
- [ ] If a static check is judged too noisy, the documented habit that caught this must live somewhere durable: `docs/agents.md` §0 or the worker's operating rules, so the next worker diffs against main after merging rather than relying on a checklist that omits it
