---
type: task
status: todo
id: task-create-labels
title: "create --labels: label a new item at creation"
parent: story-cli-ergonomics
labels: [p2]
created: "2026-09-16"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-cli-ergonomics/task-create-labels.md
  Leaves live only under a story. id is the filename stem: task-create-labels.
  CLI `arggon create task create-labels` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# create --labels: label a new item at creation

## Context

The coordinator's own repeated error (6+ times in this session: `arggon create ... --labels p2` -> unknown option -> silently empty output) IS the user research: labeling an item at creation is a natural act the CLI forces into a second command (`create` + `update --labels`). It also caused real waste: each failed create had to be diagnosed, and once the empty stdout masked a chain failure. Parity with `update --labels` (replace semantics, kebab-case) is the expected surface. Effort S.

Note: this task is also the LIVE TEST of the forever-fix in its flag dimension — --labels is agent-facing (SKILL command guidance), so the standing SKILL-sync rule applies in the same PR.

## Acceptance

- [ ] `arggon create ... --labels <csv>` lands (kernel: create.ts gains opts.labels — check if it already accepts labels via the frontmatter writer; wire kernel + CLI flag + MCP arggon_create schema + parity harness entry)
- [ ] Semantics match update --labels exactly: replace-style CSV, kebab-case normalization, invalid values refused with the same error text
- [ ] SKILL.md syncs in the same PR (the create command guidance mentions --labels); .agents copy via skills:sync; README + json-output additive; agents.md section one-liner if natural
- [ ] Tests: create with labels writes them; empty/omitted omits the field (compact rules); invalid CSV refused; MCP parity for the flag

## Notes
