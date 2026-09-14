---
type: task
status: done
id: task-adopt-scan-count-constant
title: "housekeeping: adopt scans docs/deploy.md; shared generated-docs count constant"
assignee: Arggon
branch: feat/task-adopt-scan-count-constant
parent: story-self-improvement
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/task-adopt-scan-count-constant.md
  Leaves live only under a story. id is the filename stem: task-adopt-scan-count-constant.
  CLI `arggon create task adopt-scan-count-constant` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# housekeeping: adopt scans docs/deploy.md; shared generated-docs count constant

## Context

Two housekeeping findings from the wave-1 reviews (PRs #198/#199):

1. `cli/src/adopt.ts` `ADOPT_SCAN_PATHS` does not include the new generated `docs/deploy.md` (PR #199), so adopt's inventory does not report it as arggon-managed.
2. The generated-docs count (17 → 18 in #199) is hardcoded in ~6 places across test files; every template addition forces the same churn. A shared constant (exported from docs.ts/init.ts, e.g. `GENERATED_DOC_COUNT` or derived from the template list) removes it.

## Acceptance

- [x] `ADOPT_SCAN_PATHS` includes docs/deploy.md (adopt inventory reports it)
- [x] A single derived constant replaces the hardcoded generated-doc counts in tests; adding the next template touches only templates/ + docs.ts

## Notes
