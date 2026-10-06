---
type: task
status: todo
id: task-wire-decision-brief-carriers
title: "Wire the decision-brief convention into the carriers, the generated delivery-lead contract, both skill copies and the ADR 0016 adoption channel"
parent: role-model-foundation
labels: [methodology, seam, adopters]
priority: p0
created: "2026-10-06"
updated: "2026-10-06"
depends_on: [task-spec-owner-decision-brief]
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

- [ ] Carriers carry the convention: `docs/agents.md` §Orchestration and `docs/engineering.md` §Roles and authority state the six brief fields, the answer grammar and the routing rule, with the ADR 0021 §2 authority map restated as **unchanged** — the content is fixed by [spec-owner-decision-brief-021](../../docs/specs/spec-owner-decision-brief-021.md), not re-decided here
- [ ] The **software worked example** appears in the carriers, labelled as this project's worked example only — never as the convention's own language (ADR 0026 §7, spec AC 14). The spec's own non-software example stays; the carriers carry the software one alongside it
- [ ] The generated `arggon-delivery-lead` contract gains the duty, phrased in role language ("what the lead brings to the product owner"), **citing** §Roles and authority rather than duplicating it. Edit the **template** `templates/docs/opencode/agents/arggon-delivery-lead.md` (recorded in `x-generated`: `ArggonManager/.convention.yml:84–85`) and let `arggon init` regenerate the worktree copy — do not hand-edit the generated file
- [ ] A **dated amendment to ADR 0026's Consequences** records the chosen surface — `show --json` carries the additive `decision_brief`, `report` and `sync` stay byte-identical — which ADR 0026 §Consequences left to this chain ("Not decided here: which read-only surface reports a brief that was never answered"). Nothing above the amendment note is rewritten
- [ ] The skill carrier updated from its **single committed source**: edit `skills/arggon-cli/references/orchestration.md` (and `methodology.md` if the pipeline table needs it), run `npm run skills:sync`, and let `cli/src/skill-copy.test.ts` decide. **Corrected 2026-10-06:** the earlier wording said "both skill copies … `.agents/skills/arggon-cli/` and `skills/arggon-cli/`"; `.agents/skills/` is **gitignored and generated** (`.gitignore:14`) and only `skills/arggon-cli/**` is committed, so there is no second copy to land in the PR — the parity test regenerates it
- [ ] The ADR 0016 adoption channel names the change in the release note and `arggon init --propose` delivers the convention to adopters
- [ ] **Kernel implementation is NOT this item's job** — the parser, the `show` field, the finding and its tests are `task-implement-decision-brief-kernel` (spec AC 1–8). This item carries the prose and the generated seam; keep the two PRs disjoint
- [ ] The three live cases named in exploration 025 are re-briefed or recorded as decided under the new convention, so the convention ships against real input rather than a fixture alone

## Notes

### 2026-10-06 @ses_eee869ac3ffeNvrvsvJxm9t0FG

**Blocked by the ADR 0017 hard gate.** Do not claim this until `task-spec-owner-decision-brief` exists and `arggon spec analyze` reports no NEW findings. Implementing the convention before its spec clears the gate is the exact failure the gate exists to prevent.

Behavioral change: it reaches every adopter's tree through the generated seam, so the surfaces are carriers + both skill copies + the generated contract + the ADR 0016 channel. **A Behavioral change must land with both skill copies byte-equal in the same PR** (`.agents/skills/arggon-cli/` and `skills/arggon-cli/`) — run `npm run skills:sync` and let the drift test decide, do not hand-sync.

### Acceptance (superseded — the lead's original filing, kept as history)

<!--
  Demoted from `## Acceptance` on 2026-10-06. Written into a comment as a heading,
  it created a SECOND `## Acceptance` in the body, so the live contract stayed a
  template placeholder while this draft shadowed it — and the done gate reads the
  live section (ADR 0025), so this item could not have been flipped honestly.
  The live section above is authoritative. The two rows this draft is missing are
  in it: the software worked example and the dated ADR 0026 amendment, both of
  which spec-owner-decision-brief-021 assigns to this item.
-->

- [ ] `ArggonManager/docs/agents.md` §Orchestration and `ArggonManager/docs/engineering.md` §Roles and authority carry the convention: brief fields, answer grammar, routing rule, and the unchanged ADR 0021 §2 authority map
- [ ] The generated `arggon-delivery-lead` contract gains the duty, phrased in role language ("what the lead brings to the product owner"), citing §Roles and authority instead of duplicating it
- [ ] Both skill copies updated and **byte-equal**; `npm run skills:sync` run; the skill drift test green
- [ ] The ADR 0016 adoption channel states the change in the release note and `arggon init --propose` delivers the convention to adopters
- [ ] Report-only `spec analyze` finding shipped and tested; **no transition, command or CI lane consults it** — asserted by a test, not by prose
- [ ] Tests travel with the change: brief/answer parsing, supersede-by-later-`decided:`, the routing rule, and the opt-in finding
- [ ] The three live cases named in exploration 025 are re-briefed or recorded as decided under the new convention, so the convention ships against real input rather than a fixture alone
