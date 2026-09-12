---
type: task
status: todo
id: task-adopt-command
title: arggon adopt — adoption task generator
parent: story-adopt
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adopt/task-adopt-command.md
  Leaves live only under a story. id is the filename stem: task-adopt-command.
  CLI `arggon create task adopt-command` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon adopt — adoption task generator

## Context

`arggon adopt [--dry-run] [--story <story-id>]`: requires an initialized tree (doctor check first). Default: creates the adoption task (`id` stem `adopt-arggon`, title "Adopt ArggonManager in this repo") under the given story (default: auto-create story `story-arggon-adoption` under the first epic; `--story` overrides). The task body carries the full agent checklist: sweep repo docs (README, existing AGENTS/CONTRIBUTING/conventions, manifests for stack detection), extract valuable content into the generated docs, archive replaced originals to backup/<YYYY-MM-DD>/, report moved items. `--dry-run` prints the migration plan (docs found, exists-already, would-archive) and creates nothing.

## Acceptance

- [ ] adopt creates the tracked adoption task with the checklist body (idempotent: skips when an un-done adopt task already exists); requires initialized tree
- [ ] --dry-run reports the plan (existing docs inventory + planned archives) without writing anything
