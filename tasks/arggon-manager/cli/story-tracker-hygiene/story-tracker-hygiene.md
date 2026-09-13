---
type: story
status: todo
id: story-tracker-hygiene
title: Tracker hygiene and GitHub linking
parent: cli
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/story-tracker-hygiene.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Tracker hygiene and GitHub linking

## Context

Top-priority improvements from the cuentas-claras adoption agent's feedback (2026-09-13, session sess_46c8442d): the #1 friction was tracker mutations (create/comment/cleanup) leaving tasks/ dirty, which blocks `start`'s clean-tree precondition and forced a manual commit dance five times in one session; and GitHub issue->PR closure was semimanual (the agent hand-wrote "Closes #N" in every PR).

## Acceptance

- [ ] Tracker mutations auto-commit their own changes (opt-out); `start`'s clean-tree precondition never blocks tool-generated state
- [ ] Issue->PR closure loop is automatic for imported tasks
