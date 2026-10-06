---
type: task
status: todo
id: task-wire-decision-brief-carriers
title: "Wire the decision-brief convention into the carriers, the generated delivery-lead contract, both skill copies and the ADR 0016 adoption channel"
parent: role-model-foundation
labels: [methodology, seam, adopters]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-wire-decision-brief-carriers.md
  Leaves live only under a story. id is the filename stem: task-wire-decision-brief-carriers.
  CLI `arggon create task wire-decision-brief-carriers` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Wire the decision-brief convention into the carriers, the generated delivery-lead contract, both skill copies and the ADR 0016 adoption channel

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG
**Blocked by the ADR 0017 hard gate.** Do not claim this until `task-spec-owner-decision-brief` exists and `arggon spec analyze` reports no NEW findings. Implementing the convention before its spec clears the gate is the exact failure the gate exists to prevent.

Behavioral change: it reaches every adopter's tree through the generated seam, so the surfaces are carriers + both skill copies + the generated contract + the ADR 0016 channel. **A Behavioral change must land with both skill copies byte-equal in the same PR** (`.agents/skills/arggon-cli/` and `skills/arggon-cli/`) — run `npm run skills:sync` and let the drift test decide, do not hand-sync.

## Acceptance

- [ ] `ArggonManager/docs/agents.md` §Orchestration and `ArggonManager/docs/engineering.md` §Roles and authority carry the convention: brief fields, answer grammar, routing rule, and the unchanged ADR 0021 §2 authority map
- [ ] The generated `arggon-delivery-lead` contract gains the duty, phrased in role language ("what the lead brings to the product owner"), citing §Roles and authority instead of duplicating it
- [ ] Both skill copies updated and **byte-equal**; `npm run skills:sync` run; the skill drift test green
- [ ] The ADR 0016 adoption channel states the change in the release note and `arggon init --propose` delivers the convention to adopters
- [ ] Report-only `spec analyze` finding shipped and tested; **no transition, command or CI lane consults it** — asserted by a test, not by prose
- [ ] Tests travel with the change: brief/answer parsing, supersede-by-later-`decided:`, the routing rule, and the opt-in finding
- [ ] The three live cases named in exploration 025 are re-briefed or recorded as decided under the new convention, so the convention ships against real input rather than a fixture alone
