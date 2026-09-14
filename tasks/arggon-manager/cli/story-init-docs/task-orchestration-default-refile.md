---
type: task
status: in_progress
id: task-orchestration-default-refile
title: "Init ships the orchestration playbook: agents delegate by default (refile)"
assignee: Arggon
branch: feat/task-orchestration-default-refile
parent: story-init-docs
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T16:59:56.946Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-orchestration-default-refile.md
  Leaves live only under a story. id is the filename stem: task-orchestration-default-refile.
  CLI `arggon create task orchestration-default-refile` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Init ships the orchestration playbook: agents delegate by default (refile)

## Context

Refile of `task-init-orchestration-default`: that item was flipped `done` by the
auto-done bot (PR #152, after PR #151 merged) but PR #151 only FILED the item —
no product change ever landed (templates, tests and docs on main have no
orchestration content). `done` items are never reopened, so the remaining work
is tracked here with the original acceptance checklist.

Five adoption experiments (cv, cuentas-claras, guardian, suizo, racha) +
estanteria (MCP-first) proved the most productive agent modality is
ORCHESTRATION: a coordinator agent delegates non-trivial items to subagents
(one per worktree, file-disjoint waves), verifies each merge, resolves
conflicts, and owns the tracker — while subagents claim/work/PR within their
own item. Today that modality is tribal knowledge; init's generated docs never
tell adopter agents to work this way. Init should ship it as the DEFAULT
operating mode, next to the skill mandate and the MCP registration. Design:
guidance-only (no new config).

## Acceptance

- [ ] templates/docs/AGENTS.md gains the Orchestration subsection (delegate-by-default for non-trivial items: subagents per worktree, file-disjoint waves, coordinator duties, claim/PR rules apply to subagents)
- [ ] docs/agents.md documents the orchestration modality formally (waves, conflict resolution as coordinator, subagent rules)
- [ ] skills/arggon-cli/SKILL.md syncs (one line)
- [ ] init-docs test asserts the generated AGENTS.md contains the orchestration section

## Notes
