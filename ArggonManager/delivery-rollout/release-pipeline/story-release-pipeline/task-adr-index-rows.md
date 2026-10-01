---
type: task
status: todo
id: task-adr-index-rows
title: "ADR index: add missing rows 0014-0017"
parent: story-release-pipeline
labels: [docs, housekeeping]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-adr-index-rows.md
  Leaves live only under a story. id is the filename stem: task-adr-index-rows.
  CLI `arggon create task adr-index-rows` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR index: add missing rows 0014-0017

## Context

Housekeeping observed during ADR 0018 (PR #537): `ArggonManager/docs/adr/README.md`
lists 0001–0013 plus 0018 but is missing rows for ADRs 0014–0017. Statuses in
the index must mirror the `Status:` line of each ADR file exactly.

## Acceptance

- [ ] `docs/adr/README.md` gains rows for 0014 (zcode-native-seam), 0015 (done-gate-acceptance-waiver), 0016 (adopter-upgrade-channel — now Accepted), 0017 (greenfield-exploration-gate), each with the title and status taken verbatim from the ADR file's front matter/status line.
- [ ] No other rows or content change in the file.

## Notes
