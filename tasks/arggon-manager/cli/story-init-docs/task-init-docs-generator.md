---
type: task
status: todo
id: task-init-docs-generator
title: "Init document generator (AGENTS.md, shims, tier-1/tier-2 set)"
parent: story-init-docs
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-init-docs-generator.md
  Leaves live only under a story. id is the filename stem: task-init-docs-generator.
  CLI `arggon create task init-docs-generator` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Init document generator (AGENTS.md, shims, tier-1/tier-2 set)

## Context

Master templates live in templates/docs/ (ArggonManager-owned, improved by PR); init renders them with placeholders (project name, year). AGENTS.md follows the agents.md spec: project loop (claim -> branch -> PR via arggon), pointers to project docs, playbooks reference. CLAUDE.md shim is exactly `@AGENTS.md`; .github/copilot-instructions.md points to AGENTS.md. Project-local docs/convention.md + docs/engineering.md are adopter-owned templates (they describe the adopter's project, not ArggonManager's).

## Acceptance

- [ ] Tier-1 default set + `--full` tier-2 set, generated in one `arggon init` run (existing init semantics preserved: no overwrite, idempotent)
- [ ] AGENTS.md spec-compliant + CLAUDE.md shim + copilot pointer generated
- [ ] Templates render placeholders (project name/year); all files listed in init --json created[]
