---
type: task
status: done
id: task-cascade-acceptance-aware
title: Cascade should respect container acceptance checkboxes
assignee: Arggon
branch: feat/task-cascade-acceptance-aware
parent: story-container-rollup
labels: []
created: "2026-09-13"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-container-rollup/task-cascade-acceptance-aware.md
  Leaves live only under a story. id is the filename stem: task-cascade-acceptance-aware.
  CLI `arggon create task cascade-acceptance-aware` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Cascade should respect container acceptance checkboxes

## Context

Found by the suizo experiment (2026-09-13): a story created as the container for tie-breakers work was auto-completed by the cascade when its ONLY child (a playbook re-research task) completed — zero lines of the story's actual implementation existed. The cascade mirrors subtree statuses by design ("merge != acceptance", cascade never reads bodies), but the result contradicts the acceptance-first definition of done: a story with unchecked acceptance boxes ended done. Status is authored; acceptance lives in the body — the two sources disagreed and status won silently.

## Acceptance

- [x] Design lands (ADR or documented decision): either the cascade skips containers whose OWN acceptance checklist has unchecked boxes (requires checkbox parsing at cascade time), or the semantic is explicitly ratified and documented ("cascade is purely status-mirroring; containers with pending acceptance must use --no-cascade") with skill/docs guidance
- [x] Tests covering the chosen semantics; the tie-breakers scenario (unimplemented story + completed child) produces the documented outcome
