---
type: task
status: in_progress
id: task-spec-promotion-policy-and-acceptance
title: "Spec: the promotion-policy tier table and the `accept:` product-acceptance convention (ADR 0021 §3-§4)"
assignee: arggon-coordinator
branch: feat/task-spec-promotion-policy-and-acceptance
parent: role-model-foundation
labels: [methodology, spec, roles]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
claimed_at: "2026-10-04T20:35:22.462Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-spec-promotion-policy-and-acceptance
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-spec-promotion-policy-and-acceptance.md
  Leaves live only under a story. id is the filename stem: task-spec-promotion-policy-and-acceptance.
  CLI `arggon create task spec-promotion-policy-and-acceptance` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec: the promotion-policy tier table and the `accept:` product-acceptance convention (ADR 0021 §3-§4)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

ADR 0021 §3–§4 (from [exploration-agent-primary-workers-019](../../../docs/explorations/exploration-agent-primary-workers-019.md))
settle two conventions and one bounded table. This item is the **spec gate**:
under ADR 0017 no implementation task is claimed before it exists and
`arggon spec analyze` reports no NEW findings. `task-wire-role-model-carriers`
and `task-role-model-report-only-detector` both depend on it.

The two report-only surfaces this needs already ship:
`arggon sync --json` parses a bounded comment header and classifies items
report-only (`ArggonManager/docs/engineering.md:109`), and `spec analyze`
already emits decision-pipeline findings (`ArggonManager/docs/agents.md:450`).

## Acceptance

- [ ] Spec written with `arggon spec new` at `ArggonManager/docs/specs/` (next free number), status `proposed`
- [ ] Defines the promotion-policy tier table: which item classes need a recorded product acceptance, which the agent self-certifies on review-bar evidence; **the default tier is agent-self-certified so a repo with no product owner is compliant and never blocked**
- [ ] Defines the `accept: approve | changes-requested` comment header (bounded first line, author-attributed, then evidence) as documentation, not schema
- [ ] AC: acceptance is **never a gate** — the tracker has no identity (`agents.md:414`), so a gate would be forgeable or unusable; the enforced human steps remain the four irreversible ones
- [ ] AC: `sync --json` classifies `accepted` / `changes-noted` / `none` report-only, and reports `self-accepted` when the acceptance author equals the item's own assignee
- [ ] AC: an additive `spec analyze` finding fires for a container closed with no recorded acceptance; report-only, never fails the run, silent-as-information on a corpus with zero acceptances
- [ ] AC: forward-only — no backfill; a late acceptance clears the finding on the next run; re-running never mutates state
- [ ] AC: no timers, no PO-blocked status, no SLA — acceptance is a comment at any hour
- [ ] AC: the metric that would ever justify a kernel gate is defined: acceptance share per closed container + human-only hatches used (waivers/steals) per closed container
- [ ] No new command, no schema field, no `role:`/`owner:` frontmatter (rejected in ADR 0021)
- [ ] `arggon spec analyze` reports no NEW findings before this item is done
