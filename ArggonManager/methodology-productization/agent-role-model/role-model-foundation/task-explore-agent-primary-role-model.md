---
type: task
status: in_progress
id: task-explore-agent-primary-role-model
title: "Greenfield exploration: agent-primary role model and the promotion policy (ADR 0017 six-phase protocol)"
assignee: arggon-coordinator
branch: feat/task-explore-agent-primary-role-model
parent: role-model-foundation
labels: [methodology, exploration]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
claimed_at: "2026-10-04T16:42:02.027Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-explore-agent-primary-role-model
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-explore-agent-primary-role-model.md
  Leaves live only under a story. id is the filename stem: task-explore-agent-primary-role-model.
  CLI `arggon create task explore-agent-primary-role-model` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Greenfield exploration: agent-primary role model and the promotion policy (ADR 0017 six-phase protocol)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Acceptance

- [ ] Classified first per `skills/arggon-cli/references/exploration.md` Phase 0 (spike / bounded / greenfield) with the one-way ratchet recorded, including any mid-flight upgrade
- [ ] Exploration recorded at `ArggonManager/docs/explorations/exploration-agent-primary-workers-019.md` from `templates/exploration-project.md`: classification, frontier-rounds log (one entry per round), edge-case table (12 dimensions), approaches considered, decision
- [ ] Research recorded with **dated sources** (candidates / criteria / findings / recommendation) — external practice AND repo-internal citations with file:line
- [ ] Every hunted edge case resolves to exactly one of: a spec acceptance criterion, an explicit non-goal, or a spike item — nothing stays unknown
- [ ] One recommendation with its trade-offs; the rejected candidates say why they lose
- [ ] Cross-cutting decision recorded as an ADR under `ArggonManager/docs/adr/` (Proposed) that links this exploration, with Status / Date / Deciders / Context / Decision / Consequences / Alternatives considered
- [ ] Follow-up work filed as tracked `task`/`bug` items with context + acceptance checklists, `depends_on` wired so the ADR 0017 hard gate holds (no implementation task before a spec passes `spec analyze` with no NEW findings)
- [ ] `arggon validate` and `arggon spec validate` green; PR opened with the methodology **impact class** stated (agents.md §Changing the methodology itself)
