---
type: task
status: todo
id: task-handoff-command
title: "arggon handoff <id>: structured bounded resume note (CLI + MCP)"
parent: story-item-comments
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-item-comments/task-handoff-command.md
  Leaves live only under a story. id is the filename stem: task-handoff-command.
  CLI `arggon create task handoff-command` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon handoff task-handoff-command: structured bounded resume note (CLI + MCP)

## Context

Candidate #8 of [product discovery](docs/explorations/exploration-product-discovery-002.md): session end loses working state — Beads sells "resume exactly where you left off" (beads.gascity.com, 2026-09-15) while ArggonManager's `comment` is freeform only. A structured, bounded handoff note turns that into a tracker feature. Effort S; principle: token-context (structured + bounded beats prose).

## Acceptance

- [ ] `arggon handoff <id> --next "..." [--open-questions "..."]` (flag set per spec judgment) appends a STRUCTURED, bounded handoff section to the item (branch, current state, next step, open questions)
- [ ] MCP `arggon_handoff` tool + parity harness entry
- [ ] Tests (structure + bounded output), README + json-output additive docs

## Notes
