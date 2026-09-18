---
type: task
status: in_progress
id: task-tracker-commit-ignored-nits
title: "Tracker-commit ignored[] nits: dedupe after normalization, fallback/exotic-path tests"
assignee: Arggon
branch: feat/task-tracker-commit-ignored-nits
parent: story-tracker-hygiene
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T22:50:00.197Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-tracker-commit-ignored-nits
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/task-tracker-commit-ignored-nits.md
  Leaves live only under a story. id is the filename stem: task-tracker-commit-ignored-nits.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Tracker-commit ignored[] nits: dedupe after normalization, fallback/exotic-path tests

## Context

Findings F1/F2/F4 from the independent review of PR #359
(`bug-init-ignored-artifacts-dirty-commit`).

- **F1**: `commit.ignored` can carry duplicates when one file reaches the
  primitive in two string forms (abs + root-relative): the dedupe at
  `cli/src/tracker-commit.ts:291` is exact-string while `rootRelativePaths`
  normalizes after. Partition stays correct; the array/human count overcount.
  No production caller mixes forms today — fix is one line
  (`[...new Set(rootRelativePaths(...))]`).
- **F2**: the probe-failure fallback (broken `check-ignore`) deliberately keeps
  the pre-fix behavior but has no automated test (mockable like the existing
  `vi.doMock` tests); a path starting with `:(` makes `check-ignore` die with
  pathspec magic → same fallback (wording nit: "paths may carry any character").
- **F4**: exotic path shapes (spaces/unicode/newline/backslash) are verified by
  probe only; pin them in a fixture.

## Acceptance

- [ ] `ignored[]` deduped after normalization; test with abs+relative forms.
- [ ] Fallback path covered by a mocked test; `:(` edge documented.
- [ ] One fixture covering spaces/unicode/newline/backslash path shapes.
- [ ] Full suite green; small PR to `opencode2`.

## Notes

- Robustness only; every production path is correct today.
