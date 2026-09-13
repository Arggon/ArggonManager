---
type: task
status: in_progress
id: task-self-host-init-docs
title: "Run init --full on this repo: bundle skill, generate missing docs"
assignee: Arggon
parent: story-dogfood-self-host
labels: []
created: "2026-09-13"
updated: "2026-09-13"
claimed_at: "2026-09-13T15:45:33.187Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-dogfood-self-host/task-self-host-init-docs.md
  Leaves live only under a story. id is the filename stem: task-self-host-init-docs.
  CLI `arggon create task self-host-init-docs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Run init --full on this repo: bundle skill, generate missing docs

## Context

Run `arggon init --full` on this repo: bundles the skill at .agents/skills/arggon-cli/SKILL.md and generates the missing governing docs. Existing docs (AGENTS.md, CONTRIBUTING.md, docs/convention.md, docs/engineering.md, README) will land in skipped[] — they stay adopter-owned; only the MISSING ones generate (SECURITY.md, .editorconfig, .github/CODEOWNERS, PR template, ARCHITECTURE.md, CHANGELOG.md, SUPPORT.md, docs/runbooks/, docs/tracking.md). Generated docs get their fill-me placeholders completed where the repo's real content answers them (project description, architecture) and stay flagged where human input is required (SECURITY contact).

## Acceptance

- [ ] .agents/skills/arggon-cli/SKILL.md exists; missing docs generated; existing ones untouched (skipped[])
- [ ] Generated ARCHITECTURE.md/AGENTS-description filled from the repo's real content; SECURITY contact left flagged for human
- [ ] committed; validate ok; doctor reports the state
