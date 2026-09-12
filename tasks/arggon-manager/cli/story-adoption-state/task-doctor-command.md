---
type: task
status: todo
id: task-doctor-command
title: arggon doctor — installation state report
parent: story-adoption-state
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-doctor-command.md
  Leaves live only under a story. id is the filename stem: task-doctor-command.
  CLI `arggon create task doctor-command` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon doctor — installation state report

## Context

`arggon doctor`: report-only command answering "is ArggonManager installed here, and in what shape": initialized (tasks/.convention.yml present + convention version), tracked generated docs (count, stale-template count), adopter-modified count, missing-docs count. Pure read, exit 0, `--json`.

## Acceptance

- [ ] doctor reports initialized + conventionVersion + docs state (managed/modified/stale counts) from x-generated
- [ ] Works on non-initialized repos (reports initialized: false, no crash); --json envelope; report-only (never writes)
