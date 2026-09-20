---
type: task
status: done
id: task-create-labels
title: "create --labels: label a new item at creation"
assignee: Arggon
branch: feat/task-create-labels
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

- [x] `arggon create ... --labels <csv>` lands (kernel: create.ts gains opts.labels — check if it already accepts labels via the frontmatter writer; wire kernel + CLI flag + MCP arggon_create schema + parity harness entry)
- [x] Semantics match update --labels exactly: replace-style CSV, kebab-case normalization, invalid values refused with the same error text
- [x] SKILL.md syncs in the same PR (the create command guidance mentions --labels); .agents copy via skills:sync; README + json-output additive; agents.md section one-liner if natural
- [x] Tests: create with labels writes them; empty/omitted omits the field (compact rules); invalid CSV refused; MCP parity for the flag

## Notes

### 2026-09-16 @Arggon
Lead-architect review: APPROVED. The finding is poetic: the kernel supported labels all along — the flag was simply never wired, the exact shape of the issue-field gap and further proof that 'kernel-complete, CLI-unwired' is a recurring drift class worth watching. Forever-fix evidence is the best kind: your .description() edit regenerated the SKILL region mechanically (idempotent second run, zero diff), so the flag docs can never go stale. Semantics mirror update exactly (kebab-case, replace CSV, same error text), MCP schema follows the CSV convention, and the compact-envelope omission rules hold. Merge follows.
