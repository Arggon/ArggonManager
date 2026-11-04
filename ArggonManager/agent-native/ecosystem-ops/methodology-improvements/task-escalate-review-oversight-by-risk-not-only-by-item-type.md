---
type: task
status: in_progress
id: task-escalate-review-oversight-by-risk-not-only-by-item-type
title: "Escalate review oversight by risk, not only by item type"
assignee: arggon-superagent
branch: agent/risk-based-escalation-e8713e4ab5af
parent: methodology-improvements
labels: [methodology, agents]
created: "2026-11-04"
updated: "2026-11-04"
claimed_at: "2026-11-04T18:33:42.521Z"
worktree_path: /home/arggon/.dsh/state/superagent/work/risk-based-escalation-e8713e4ab5af
issue: 871
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-escalate-review-oversight-by-risk-not-only-by-item-type.md
  Leaves live only under a story. id is the filename stem: task-escalate-review-oversight-by-risk-not-only-by-item-type.
  CLI `arggon create task escalate-review-oversight-by-risk-not-only-by-item-type` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Escalate review oversight by risk, not only by item type

## Context

Issue #871 (part 4 of 5 of the 2026-11-03 methodology review) shows the promotion
policy decides review depth from an item's **type**: every `task`/`bug` leaf is T0
(agent self-certification) and T1 is only `story` containers. A one-line auth,
crypto, destructive-migration, public-schema, CI-permission or billing change is
therefore the least-reviewed class of change, and the item holds no record that a
leaf was escalated.

This task makes T0 conditional on a **risk triage**: a leaf with no risk trigger stays
T0, a triggered leaf is T1 (recorded human acceptance) or T2 (human-gated when the
change is irreversible), the triage is recorded on the item as `risk-…` labels, the
PR template asks the question, the authenticated gate is named separately from the
recorded one, and `arggon report --json` gains a report-only audit block (open
risk-triggered leaves whose acceptance is not `accepted`) so the policy is measurable
before it can ever block.

Issue: https://github.com/Arggon/ArggonManager/issues/871

Methodology impact class: **Behavioral** — agents must re-learn the T0 default
(ADR 0016 upgrade channel). The tracker `accept:` record stays report-only; the
authenticated gate remains the GitHub review the project declares (CODEOWNERS).

## Acceptance

- [ ] `ArggonManager/docs/engineering.md` has a risk-trigger table with concrete examples and an explicit T0 exception for triggered leaves.
- [ ] The T0 row no longer says every `task`/`bug` leaf is agent-accepted by default; it says "no risk trigger".
- [ ] The escalation is recordable on an item (`risk-…` labels) and visible in the normal read surfaces (`show`, `list --json` + filter, PR template).
- [ ] Security-sensitive, destructive, compatibility-breaking, supply-chain, and safety-critical changes each have a named escalation path.
- [ ] The policy states which gate is authenticated (GitHub review/CODEOWNERS) and which is only recorded (tracker `accept:`).
- [ ] A test or report query proves a risk-triggered leaf is not classified as routine T0; the first iteration may be report-only.

## Notes
