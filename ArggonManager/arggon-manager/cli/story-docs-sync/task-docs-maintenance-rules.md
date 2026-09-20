---
type: task
status: done
id: task-docs-maintenance-rules
title: docs-maintenance-rules
assignee: Arggon
parent: story-docs-sync
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-docs-sync/task-docs-maintenance-rules.md
  Leaves live only under a story. id is the filename stem: task-docs-maintenance-rules.
  CLI `arggon create task docs-maintenance-rules` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# docs-maintenance-rules

## Context

Doc drift happens when nothing tells an agent *when* and *where* documentation must change. The four files agents reliably read are `AGENTS.md`, `docs/agents.md`, `docs/convention.md`, `docs/engineering.md`; the maintenance rules land in `docs/agents.md` (the playbook) with pointers where they belong.

## Acceptance

- [x] `docs/agents.md` gains a "Documentation maintenance" section: a change-type → doc mapping table, the same-PR rule, ADR lifecycle reminder, and the specs/plans convention (`docs/specs/spec-<slug>-NNN.md` + `docs/plans/plan-<slug>-NNN.md`, statuses flipped when the feature lands)
- [x] Pre-PR verification checklist included (grep new flags across docs, `arggon validate`)
- [x] §5 documents the container-completion cascade for agents

## Notes

`AGENTS.md` stays a short pointer; the details live in `docs/agents.md` so the playbook remains the single agent-facing rulebook.
