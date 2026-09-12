---
type: task
status: done
id: task-adopt-agent-playbook
title: Adoption agent playbook
assignee: Arggon
branch: feat/story-adopt-impl
parent: story-adopt
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adopt/task-adopt-agent-playbook.md
  Leaves live only under a story. id is the filename stem: task-adopt-agent-playbook.
  CLI `arggon create task adopt-agent-playbook` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adoption agent playbook

## Context

The agent-side procedure so the adoption task is executable by any agent: sweep order, what to extract into which generated doc, the backup convention (backup/<YYYY-MM-DD>/ preserving relative paths), and the report format (comment on the adoption task).

## Acceptance

- [x] docs/agents.md gains the adoption sweep procedure (§Adoption); README documents `arggon adopt`
