---
type: task
status: todo
id: task-cascade-predictability
title: "Cascade predictability: dry-run/warning for high-level containers"
parent: story-container-rollup
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-container-rollup/task-cascade-predictability.md
  Leaves live only under a story. id is the filename stem: task-cascade-predictability.
  CLI `arggon create task cascade-predictability` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Cascade predictability: dry-run/warning for high-level containers

## Context

cuentas-claras feedback: closing the adoption task (sole child of its story) auto-completed story -> epic -> initiative without warning, and the agent then had to reopen done containers to fix the modeling — which is agent-forbidden by the playbook and only possible via the human CLI path. Cascade was mechanically correct but the experience needs a seatbelt and documentation.

## Acceptance

- [ ] Cascade affecting containers at epic level or above (not just the immediate story) prints a visible notice in human output and surfaces in --json (already via autoCompleted — add container levels)
- [ ] `update --status done --no-cascade` documented as THE way to close administrative tasks whose containers must stay open; docs/agents.md guidance: administrative stories should not live as sole children of product containers
