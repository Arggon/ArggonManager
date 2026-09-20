---
type: bug
status: todo
id: bug-layout-trend-pathspec
title: "report --trend: legacy tasks pathspec can mine an unrelated tasks/ dir"
parent: native-redesign
labels: []
priority: p3
created: "2026-09-20"
updated: "2026-09-20"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-layout-trend-pathspec.md
  Leaves live only under a story. id is the filename stem: bug-layout-trend-pathspec.
  CLI `arggon create bug layout-trend-pathspec` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# report --trend: legacy tasks pathspec can mine an unrelated tasks/ dir

## Context

Post-merge residual from the PR #371 review (W0, `task-native-layout-rename`):

- `report --trend` on a v5 tree includes the legacy `tasks` pathspec so the
  history crosses the layout move. A v5 repo that happens to contain an
  **unrelated** `tasks/` directory with item-like frontmatter can then add
  false completions (reviewer repro: `{W38:1}`).
- Impact is limited to `--trend` and to that rare scenario; the primary v5
  path and the migrated repo are correct.

## Acceptance

- [ ] The legacy `tasks` pathspec is included only when its history records
      `tasks/.convention.yml` (or the dir is otherwise proven to be a legacy
      tracker), so an unrelated `tasks/` cannot contribute.
- [ ] Regression test: v5 tree + unrelated `tasks/` with item-like frontmatter
      → trend unchanged vs the no-`tasks/` baseline.
- [ ] Migrated-repo trend parity test (F1) still green.
- [ ] `arggon validate` green; CI green.

## Notes

- Filed immediately after the W0 merge per the review-findings rule; not
  blocking.
- Related: `task-native-layout-rename` (merged), `cli/src/trend.ts`.
