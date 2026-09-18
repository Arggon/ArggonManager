---
type: task
status: todo
id: task-opencode2-orchestration
title: "Orchestration on OpenCode V2: coordinator, workers, waves"
priority: p1
depends_on: [task-opencode-v2-spec, task-opencode-v2-plugin]
parent: story-opencode-v2
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode2-orchestration.md
  Leaves live only under a story. id is the filename stem: task-opencode2-orchestration.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Orchestration on OpenCode V2: coordinator, workers, waves

## Context

W4 of [plan-opencode2-009](../../../../docs/plans/plan-opencode2-009.md):
the orchestration model in [docs/agents.md](../../../../docs/agents.md)
(coordinator delegates, one subagent per item per worktree, lead-architect
review of every PR, merge verification, tracker ownership) becomes native V2
agents, commands and flows — same rules, better runtime primitives
(background subagents, context isolation, permissions, Code Mode batching).

## Acceptance

- [ ] Generated agents: `arggon-coordinator` (primary; wave planning, review,
      merge verification, tracker ownership), `arggon-worker` (subagent; one
      item, own worktree, reports findings instead of filing), `arggon-reviewer`
      (subagent; edits denied through permissions, reads/tests allowed, encodes
      the review bar + smoke gate from engineering.md).
- [ ] Commands: `/arggon-review` (reviewer verdict with smoke evidence, verdict
      posted via `arggon comment`) and `/arggon-done` (verify checklist + gates,
      then `update --status done`); `agent`/`subagent` frontmatter correct.
- [ ] Subagent permission probes: a worker is denied `subagent` launches
      (no nesting beyond one); the reviewer is denied `edit`; the coordinator
      can launch only the worker/reviewer ids (allow-list), verified with
      evidence.
- [ ] End-to-end scripted wave on a fixture with a local bare remote: two
      file-disjoint items, two background workers with separate worktrees,
      reviewer verdict, coordinator merge verification; transcript as evidence.
- [ ] Context accounting for the run recorded (feeds task-opencode2-context):
      per-worker prompt/tool token estimate before and after the item block.
- [ ] Docs: orchestration section of `docs/agents.md` updated to describe the
      V2 flow as the reference implementation (rules unchanged).

## Notes

- Depends on task-opencode-v2-spec (agent generation contract) and
  task-opencode-v2-plugin (context injection makes worker sessions anchored).
- Without the plugin this task degrades to agents + commands only; the
  end-to-end evidence requires the plugin wave merged.
