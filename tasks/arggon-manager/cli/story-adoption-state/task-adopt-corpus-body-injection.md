---
type: task
status: todo
id: task-adopt-corpus-body-injection
title: "adopt task body: inject detected spec corpus at creation"
parent: story-adoption-state
labels: []
created: "2026-09-16"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-adopt-corpus-body-injection.md
  Leaves live only under a story. id is the filename stem: task-adopt-corpus-body-injection.
  CLI `arggon create task adopt-corpus-body-injection` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# adopt task body: inject detected spec corpus at creation

## Context

Follow-up from task-adopt-corpus-fingerprints (PR #286, review round): detectSpecCorpora reports detected corpora in the adopt INVENTORY, but the adoption task body is a STATIC template (ADOPT_TASK_BODY) — the detected corpus (format, count, origin) is not injected into the created task's body, so the adopting agent must re-derive it from the inventory line.

## Acceptance

- [ ] adopt composes the adoption task body with a corpus-specific section when detection finds corpora (format, count, pointer to the phased checklist)
- [ ] No corpora -> template unchanged; tests both ways

## Notes
