---
type: task
status: done
id: task-autocommit-update-import
title: Extend auto-commit to update-cascade and import-issues
assignee: Arggon
branch: feat/task-autocommit-update-import
parent: story-tracker-hygiene
labels: []
created: "2026-09-13"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/task-autocommit-update-import.md
  Leaves live only under a story. id is the filename stem: task-autocommit-update-import.
  CLI `arggon create task autocommit-update-import` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Extend auto-commit to update-cascade and import-issues

## Context

Found by the suizo experiment (2026-09-13): auto-commit (PR #116) covers create/comment/adopt/cleanup, but two high-frequency mutations still leave tasks/ dirty: `update --status done` (which via cascade can touch up to 4 files) and `import-issues` (story + 6 items at once). The suizo agent hit the dirty tree repeatedly right after done-flips, and report --trend depends on those done commits existing.

## Acceptance

- [x] `update` (including cascade multi-file flips) auto-commits its mutated item files with the same surgical staging + message convention (e.g. `chore(tasks): done task-x (cascade: story-a, epic-b)`)
- [x] `import-issues` auto-commits its created items as one commit (`chore(tasks): imported N issues`)
- [x] --no-commit / x-tracker.auto-commit respected everywhere; tests per surface
