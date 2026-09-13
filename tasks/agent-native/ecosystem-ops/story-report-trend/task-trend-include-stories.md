---
type: task
status: in_progress
id: task-trend-include-stories
title: report --trend should include story completions (or an opt-in flag)
assignee: Arggon
parent: story-report-trend
labels: []
created: "2026-09-13"
updated: "2026-09-13"
claimed_at: "2026-09-13T21:01:13.486Z"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-report-trend/task-trend-include-stories.md
  Leaves live only under a story. id is the filename stem: task-trend-include-stories.
  CLI `arggon create task trend-include-stories` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# report --trend should include story completions (or an opt-in flag)

## Context

Found by the guardian adoption agent (2026-09-13): in a story-driven project, `report --trend` returns empty weeks because `trend.ts` only counts task/bug completions (stories are excluded by design of "cycle time per leaf type"). Story-driven repos (like guardian and ArggonManager itself) get an empty trend — the feature under-delivers for the repo's own methodology.

## Acceptance

- [x] Trend includes story completions in the weekly series (and either a per-type cycle time row for stories or an explicit `--include-stories` opt-in); documented in json-output.md
- [x] Tests: story-driven tree produces non-empty weeks; existing leaf semantics unchanged
