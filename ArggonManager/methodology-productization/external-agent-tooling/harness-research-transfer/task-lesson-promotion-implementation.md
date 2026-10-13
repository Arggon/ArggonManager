---
type: task
status: in_progress
id: task-lesson-promotion-implementation
title: "Implement ADR 0027 lesson promotion: agents.md rule + maker-prompt trigger (Behavioral)"
assignee: arggon-delivery-lead
branch: feat/task-lesson-promotion-implementation
parent: harness-research-transfer
labels: [methodology, context-budget]
created: "2026-10-13"
updated: "2026-10-13"
claimed_at: "2026-10-13T21:06:19.321Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-lesson-promotion-implementation
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-lesson-promotion-implementation.md
  Leaves live only under a story. id is the filename stem: task-lesson-promotion-implementation.
  CLI `arggon create task lesson-promotion-implementation` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Implement ADR 0027 lesson promotion: agents.md rule + maker-prompt trigger (Behavioral)

## Context

ADR 0027 (Accepted with PR #761) decided: no cross-run lesson store; lessons are promoted, bounded and cited into the carriers that already own the topic — `skills/arggon-cli/references/pitfalls.md` (mechanics), `ArggonManager/docs/playbooks/<tech>.md` (technology), an item's `## Context` (a refuted approach), an ADR (a decision). One line ≤160 chars with a mandatory citation; the trigger belongs in the generated maker prompt. This is the bounded implementation the spike deferred; if it needs a new command, generated surface, gate or package it upgrades to greenfield (ADR 0017) and stops.

## Acceptance

- [ ] the promotion rule lands in `ArggonManager/docs/agents.md`; the trigger sentence lands in `templates/docs/opencode/agents/arggon-maker.md` (and the shipped seam copy if generated)
- [ ] the ≤160-char bound + mandatory citation are stated where the agent meets them
- [ ] `skills/arggon-cli/**` and `.agents/skills/**` stay byte-equal (Behavioral, skill-sync obligation); ADR 0016 adopter propose channel noted
- [ ] context budget checked (`doctor --budget` / `context:report`) or the non-movement justified
- [ ] `arggon validate` ok; affected tests green; impact class stated in the PR

## Notes
