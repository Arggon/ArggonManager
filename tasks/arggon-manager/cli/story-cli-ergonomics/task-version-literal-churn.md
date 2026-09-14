---
type: task
status: todo
id: task-version-literal-churn
title: "version literal churn: tests assert hardcoded 0.1.0 instead of arggonVersion()"
parent: story-cli-ergonomics
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-cli-ergonomics/task-version-literal-churn.md
  Leaves live only under a story. id is the filename stem: task-version-literal-churn.
  CLI `arggon create task version-literal-churn` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# version literal churn: tests assert hardcoded 0.1.0 instead of arggonVersion()

## Context

From the task-version-policy review (PR #157): bumping package.json required
editing version literals in 3 test files (adopt.test.ts, init-docs.test.ts,
mcp-server.test.ts). Every future release-wave bump repeats that churn and a
missed file fails CI unrelated to the release.

## Acceptance

- [ ] Version assertions derive the expected value from `arggonVersion()` (or a shared fixture) instead of hardcoded literals; a bump touches only package.json + CHANGELOG

## Notes
