---
type: bug
status: todo
id: bug-autocommit-silent-skip
title: autocommit-silent-skip
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-autocommit-silent-skip.md
  Leaves live only under a story. id is the filename stem: bug-autocommit-silent-skip.
  CLI `arggon create bug autocommit-silent-skip` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# tracker auto-commit silently skipped under git index.lock contention

## Context

Exposed by the adversarial lab (`labs/torture.test.ts` scenario 2; origin: suizo "necesité reintentos por lock transitorio"). When N processes mutate the tracker concurrently with `x-tracker.auto-commit: true`, `commitTrackerMutation` can lose the race on git's `index.lock` and then SILENTLY skips the commit: the mutation is written to the item file, the process exits `ok:true`, and the file is left dirty with nothing reporting the skip. State is not corrupted, but the auto-commit contract ("every mutation lands committed") is not honored or reported.

Repro: labs/torture.test.ts scenario 2 (6 concurrent `arggon comment` processes on different items) — intermittently one item file ends modified/unstaged.

## Acceptance

- [ ] `commitTrackerMutation` retries the commit on `index.lock` contention (bounded, e.g. reuse the lock.ts retry/backoff approach) instead of skipping silently
- [ ] If a skip is still unavoidable, it is reported (JSON `commit` payload / stderr warning), never silent
- [ ] labs/torture.test.ts scenario 2's `git status --porcelain`-clean assertion is re-enabled and green

## Notes

- Discovered 2026-09-14 by the adversarial lab while converting adoption-experiment scenarios into a permanent suite.
- Related: bug-comment-race-no-lock (same experiment finding family).


## Notes
