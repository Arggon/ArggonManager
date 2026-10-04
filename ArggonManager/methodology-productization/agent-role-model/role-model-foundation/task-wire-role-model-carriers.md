---
type: task
status: todo
id: task-wire-role-model-carriers
title: "Carrier wiring: supersede the parity invariant in agents.md/engineering.md/convention.md + README + both skill copies (ADR 0021 §1, §2, §6)"
parent: role-model-foundation
labels: [methodology, docs, roles]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
depends_on: [task-spec-promotion-policy-and-acceptance, task-spec-agent-role-contracts]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-wire-role-model-carriers.md
  Leaves live only under a story. id is the filename stem: task-wire-role-model-carriers.
  CLI `arggon create task wire-role-model-carriers` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Carrier wiring: supersede the parity invariant in agents.md/engineering.md/convention.md + README + both skill copies (ADR 0021 §1, §2, §6)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

ADR 0021 §1, §2, §6 — supersede the parity invariant everywhere it is stated
and remap the review-bar roles. **Methodology impact class: Behavioral**
(`ArggonManager/docs/agents.md:471–478`): agents must re-learn something, so this
PR references the ADR 0016 upgrade channel, states the impact class in the PR
description and as an item comment, and keeps the skill copies byte-equal.

## Acceptance

- [ ] Depends on `task-spec-promotion-policy-and-acceptance` (ADR 0017 gate) landing first
- [ ] `README.md:59` (Principle 3), the invariant blocks of `agents.md:6`, `engineering.md:6`, `convention.md:6`, and ADR 0020's invariant block all carry the two-axis rule: **work-loop parity, asymmetric and named authority**
- [ ] `engineering.md:12` and the review-bar section headers stop naming human job titles for work the shipped agents perform; architect / reviewer / prover / QA become agent roles
- [ ] The bounded **authority map** table lands in `engineering.md` (ADR 0021 §2): the four irreversible powers keep their existing structural gates and are named as such
- [ ] The bounded **promotion-policy tier table** lands beside the review bar (ADR 0021 §3)
- [ ] `agents.md` §5 / §Orchestration / §Changing the methodology itself updated where the old wording becomes false; the `SECURITY.md`-contact-is-human-input style human-only notes are kept, not deleted
- [ ] `skills/arggon-cli/**` and `.agents/skills/arggon-cli/**` byte-equal in this PR (parity test enforces it)
- [ ] README §The methodology + the release note name the new convention for adopters
- [ ] `arggon validate` and `arggon spec validate` green; no carrier statement left false by this edit
- [ ] No kernel rule, schema field, command or per-adapter behavior changed — this item is carriers only

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
verdict: changes-requested (scope extended by ADR 0021 §6.1/§6.2 amendment)

The product owner extended this item's scope. Two acceptance criteria are added and
one dependency is wired, because the authoritative role table has to exist before
the seam prompts can cite it (ADR 0021 §6.1):

- [ ] The bounded **role table** from ADR 0021 §6.1 lands in `docs/engineering.md`: each shipped id → role (Delivery lead / Practice & standards / Maker / Verifier) + software analogue (marked non-normative) + non-software analogue + what it decides
- [ ] The table states the two boundaries §6.1 pins: the coordinator sequences and dispatches but does **not** own `priority` (the PO does), and the prover reports observed-vs-expected without deciding the verdict
- [ ] Gate language in the carriers is domain-neutral (§6.2): each bar is named as *what the project declares*, with the software case as one worked example; the acceptance contract on the item is named as the domain-invariant
- [ ] Now depends on `task-spec-agent-role-contracts` as well as the promotion-policy spec (ADR 0017 gate)
- [ ] `task-agent-role-contracts-seam` depends on **this** item — the prompts cite this table, so this lands first

Everything else in this checklist stands unchanged.
