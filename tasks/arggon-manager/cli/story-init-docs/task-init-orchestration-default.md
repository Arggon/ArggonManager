---
type: task
status: todo
id: task-init-orchestration-default
title: "Init ships the orchestration playbook: agents delegate by default"
parent: story-init-docs
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-init-orchestration-default.md
  Leaves live only under a story. id is the filename stem: task-init-orchestration-default.
  CLI `arggon create task init-orchestration-default` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Init ships the orchestration playbook: agents delegate by default

## Context

Five adoption experiments proved the most productive agent modality is ORCHESTRATION: an agent acting as coordinator delegates non-trivial items to subagents (one per worktree, file-disjoint waves), verifies each merge, resolves conflicts, and owns the tracker — while subagents claim/work/PR within their own item. Today that modality is tribal knowledge (the ArggonManager maintainer orchestrates by hand); nothing in init's generated docs tells adopter agents to work this way. Init should ship the orchestration playbook as the DEFAULT operating mode for agents in adopter repos, next to the skill mandate and the MCP registration.

Design: guidance-only (no new config) — the generated AGENTS.md gains an "Orchestration" subsection in the Task workflow (delegate non-trivial items to subagents, one per worktree, file-disjoint waves, coordinator verifies merges and owns tracker state, subagents follow the same claim/PR rules), and ArggonManager's own docs/agents.md documents the modality formally (it is the playbook source). SKILL.md: one line. init-docs test asserts the section exists in the generated AGENTS.md.

## Acceptance

- [ ] templates/docs/AGENTS.md gains the Orchestration subsection (delegate-by-default for non-trivial items: subagents per worktree, file-disjoint waves, coordinator duties, claim/PR rules apply to subagents)
- [ ] docs/agents.md documents the orchestration modality formally (waves, conflict resolution as coordinator, subagent rules)
- [ ] skills/arggon-cli/SKILL.md syncs (one line)
- [ ] init-docs test asserts the generated AGENTS.md contains the orchestration section
