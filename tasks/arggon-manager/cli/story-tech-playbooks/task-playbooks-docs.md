---
type: task
status: todo
id: task-playbooks-docs
title: Playbooks docs + AGENTS.md wiring
parent: story-tech-playbooks
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tech-playbooks/task-playbooks-docs.md
  Leaves live only under a story. id is the filename stem: task-playbooks-docs.
  CLI `arggon create task playbooks-docs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Playbooks docs + AGENTS.md wiring

## Context

Docs + wiring: the init-generated AGENTS.md must reference docs/playbooks/ so agents follow current best practices by default.

## Acceptance

- [ ] README + agents.md (maintenance section) document the pipeline: explore -> ADR -> playbook -> status/--file-task
- [ ] init-generated AGENTS.md includes the playbooks pointer (template updated + test)
