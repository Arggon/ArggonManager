---
type: task
status: in_progress
id: task-orchestrator-lead-architect-review
title: "Orchestrator is lead architect: code-reviews every subagent PR before merge"
assignee: Arggon
parent: story-init-docs
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T19:16:09.067Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-init-docs/task-orchestrator-lead-architect-review.md
  Leaves live only under a story. id is the filename stem: task-orchestrator-lead-architect-review.
  CLI `arggon create task orchestrator-lead-architect-review` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Orchestrator is lead architect: code-reviews every subagent PR before merge

## Context

Decision (2026-09-14): the orchestrator/coordinator agent must not only plan
waves, verify merges and own the tracker — it acts as LEAD ARCHITECT and
code-reviews every PR a subagent opens before merge. Subagent output is not
auto-merged on green CI: the coordinator reviews the diff against the repo's
review bar (conventions first, tests travel with behavior, docs travel with
code, scope stays on the item, acceptance ticks honest), requests changes
where needed, and only approves + merges when the bar is met. This amends the
orchestration modality landed by task-orchestration-default-refile (generated
AGENTS.md Orchestration subsection + docs/agents.md + SKILL.md one-liner).

Applies immediately to coordination in this repo; the docs change
institutionalizes it for adopters.

## Acceptance

- [ ] templates/docs/AGENTS.md Orchestration subsection states the review duty (coordinator = lead architect: reviews every subagent PR against the review bar before merge, requests changes, approves, then merges)
- [ ] docs/agents.md orchestration section documents the review duties formally (what the review checks, request-changes loop, merge authority)
- [ ] skills/arggon-cli/SKILL.md + generated .agents copy sync the one-liner; checksums re-acked (doctor: 0 modified)
- [ ] init-docs test asserts the generated AGENTS.md mentions the review duty

## Notes
