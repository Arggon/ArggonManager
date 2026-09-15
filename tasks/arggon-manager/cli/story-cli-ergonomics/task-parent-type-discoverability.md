---
type: task
status: in_progress
id: task-parent-type-discoverability
title: "create --parent: document expected parent type per item type (discoverability)"
assignee: Arggon
parent: story-cli-ergonomics
labels: [p3]
created: "2026-09-15"
updated: "2026-09-15"
claimed_at: "2026-09-15T13:00:33.179Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-cli-ergonomics/task-parent-type-discoverability.md
  Leaves live only under a story. id is the filename stem: task-parent-type-discoverability.
  CLI `arggon create task parent-type-discoverability` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# create --parent: document expected parent type per item type (discoverability)

## Context

Feedback from the vencimientos adoption experiment (2026-09-15): `arggon create story --parent <initiative>` fails with "story must live under a epic (got initiative)" — the error is fine once you hit it, but `--help` says only `parent (required except initiative)` and does not document WHICH parent type each item type accepts. The agent burned an attempt and created an epic it had not planned (structural noise in the fresh tree). Also folded here (review batch): init-generated containers carry PLACEHOLDER acceptance checklists, so the acceptance-aware cascade will never auto-complete them until a human/agent replaces the boxes with real criteria — documented behavior worth one line of discoverability.

## Acceptance

- [ ] `create --help` documents the expected parent type per item type (initiative: none; epic: initiative; story: epic; task/bug: story)
- [ ] skills/arggon-cli/SKILL.md: one line on placement rules (NOT the generated AGENTS.md — 30 B budget headroom)
- [ ] docs/convention.md (or the skill line): one sentence noting init-generated containers have placeholder acceptance boxes that block cascade auto-completion until replaced with real criteria
- [ ] The error message stays as-is (it already names the expected type)

## Notes
