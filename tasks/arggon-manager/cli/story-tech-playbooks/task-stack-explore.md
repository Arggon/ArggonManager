---
type: task
status: in_progress
id: task-stack-explore
title: arggon stack explore — exploration records
assignee: Arggon
parent: story-tech-playbooks
labels: []
created: "2026-09-12"
updated: "2026-09-12"
claimed_at: "2026-09-12T19:40:22.081Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tech-playbooks/task-stack-explore.md
  Leaves live only under a story. id is the filename stem: task-stack-explore.
  CLI `arggon create task stack-explore` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon stack explore — exploration records

## Context

`arggon stack explore <topic>` scaffolds `docs/explorations/exploration-<slug>-NNN.md`: candidates, comparison criteria, findings with dated sources, and a recommendation — the spike record that precedes the stack ADR.

## Acceptance

- [ ] Exploration template + scaffold command; never overwrites; --json
