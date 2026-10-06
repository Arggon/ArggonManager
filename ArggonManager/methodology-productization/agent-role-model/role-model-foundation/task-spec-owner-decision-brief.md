---
type: task
status: todo
id: task-spec-owner-decision-brief
title: "Spec: the decision-brief convention, its answer grammar, and the unanswered-brief report-only finding (exploration 025 edge cases as acceptance criteria)"
parent: role-model-foundation
labels: [methodology, roles, spec]
created: "2026-10-06"
updated: "2026-10-06"
depends_on: [task-adr-0026-owner-decision-brief]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-spec-owner-decision-brief.md
  Leaves live only under a story. id is the filename stem: task-spec-owner-decision-brief.
  CLI `arggon create task spec-owner-decision-brief` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec: the decision-brief convention, its answer grammar, and the unanswered-brief report-only finding (exploration 025 edge cases as acceptance criteria)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG
Gated behind `task-adr-0026-owner-decision-brief` (the ADR decides; this specifies it). **ADR 0017 hard gate: this spec must pass `arggon spec analyze` with no NEW findings before any implementation task is claimed** — including `task-wire-decision-brief-carriers`.

Every row of exploration 025's edge-case table becomes an acceptance criterion, so nothing stays "unknown". The non-obvious ones:

- **Routing rule** — briefs owed only for the ADR 0021 §2 rows and hard-to-reverse calls; a one-option question is **not** a brief (the lead decides it and records why).
- **Unanswered** — the stated default executes and the brief records that it did. This is the mechanism that makes escalation cheap rather than blocking.
- **Concurrency** — one canonical item per decision; a second brief links to it. No cross-item dedupe scanner in v0: **explicit non-goal**, the volume does not justify a surface.
- **Never a gate** — report-only, inherited from ADR 0021 §4: no transition consults it, no command refuses because of it, CI never fails on it.
- **Time** — absolute ISO dates only; never a relative deadline.
- **Domain neutrality** — every field named in the project's own terms; software is the worked example, never the vocabulary (ADR 0021 §6.2).
- **Upgrade** — `init --propose` delivers it; both skill copies stay byte-equal in the same PR.

## Acceptance

- [ ] `ArggonManager/docs/specs/spec-<owner-decision-brief>-NNN.md` written from `templates/spec.md`, with the six brief fields, the answer grammar, and the routing rule specified
- [ ] **Every** row of exploration 025's edge-case table appears as an acceptance criterion, an explicit non-goal, or a tracked spike — an adversarial re-pass finds no "unknown"
- [ ] The report-only finding specified: a `decide:` header with no later `decided:`, mirroring `MISSING-PRODUCT-ACCEPTANCE`; **opt-in under `x-tracker.product-acceptance`, never CI-failing**
- [ ] Spec states the promotion-policy tiers are unchanged, so product-owner touchpoints per shipped change do not rise
- [ ] `arggon spec validate` green and `arggon spec analyze` reports **no NEW findings** — the gate for `task-wire-decision-brief-carriers`
- [ ] Plan filed with ordered tasks and `depends_on`, per `references/methodology.md`
