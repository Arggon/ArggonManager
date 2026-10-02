---
type: task
status: in_progress
id: task-methodology-carriers
title: Declare the methodology in carriers + README (plan T1)
assignee: Arggon
branch: feat/task-methodology-carriers
parent: story-methodology-carriers
labels: []
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T18:59:09.458Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-methodology-carriers
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-methodology-carriers/task-methodology-carriers.md
  Leaves live only under a story. id is the filename stem: task-methodology-carriers.
  CLI `arggon create task methodology-carriers` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Declare the methodology in carriers + README (plan T1)

## Context

Declare scope/invariants/version/upgrade-channel of the methodology in agents.md, engineering.md, convention.md headers; README §The methodology with links to carriers and the adapter matrix

## Acceptance

- [ ] `README.md` links every carrier in one hop
- [ ] carriers carry the same invariant list verbatim
- [ ] PR states impact class (Behavioral) per agents.md §Changing the methodology itself
- [ ] `arggon validate` green

## Notes
