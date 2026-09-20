---
type: story
status: done
id: story-docs-sync
title: Documentation sync and maintenance rules
assignee: Arggon
branch: docs/story-docs-sync
parent: cli
labels: []
created: "2026-09-11"
updated: "2026-09-11"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-docs-sync/story-docs-sync.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Documentation sync and maintenance rules

## Context

A documentation audit (2026-09-11) found the docs describing the product frozen at Phase 1 while the CLI shipped sync, MCP, instructions, board serve/group-by, the milestone prototype and the container-completion cascade. This story syncs the docs and installs standing maintenance rules so the next drift is caught in the same PR.

## Acceptance

- [x] Drift fixed across json-output.md, README, engineering.md, SKILL.md (task-docs-drift-sync)
- [x] Maintenance instructions for agents in `docs/agents.md` (task-docs-maintenance-rules)

## Notes

Audit report was delivered before any edit, per instruction.
