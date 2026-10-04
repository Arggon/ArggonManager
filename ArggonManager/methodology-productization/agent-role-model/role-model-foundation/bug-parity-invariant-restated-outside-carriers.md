---
type: bug
status: todo
id: bug-parity-invariant-restated-outside-carriers
title: "ADR 0020 §Decision.1 and docs/claim.md:99 still state the superseded parity invariant — live normative text left behind by the carrier wiring"
parent: role-model-foundation
labels: [docs, methodology, roles]
priority: p2
created: "2026-10-04"
updated: "2026-10-04"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-parity-invariant-restated-outside-carriers.md
  Leaves live only under a story. id is the filename stem: bug-parity-invariant-restated-outside-carriers.
  CLI `arggon create bug parity-invariant-restated-outside-carriers` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0020 §Decision.1 and docs/claim.md:99 still state the superseded parity invariant — live normative text left behind by the carrier wiring

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

PR #636 wired ADR 0021 §1 into the three carriers' invariant blocks
(`agents.md`, `engineering.md`, `convention.md` — now byte-identical and stating
*work-loop parity + asymmetric named authority*). Two **live normative** statements
of the old rule sit outside that file set and were correctly left alone by the
worker:

- `ArggonManager/docs/adr/0020-methodology-first-productization.md:62–64` — the
  decision that declares those carriers to be the product, whose invariants list still
  reads *"humans and agents follow the same rules"*
- `ArggonManager/docs/claim.md:99` — *"Agents and humans follow the same rules"*

Frozen records are **not** to be rewritten: `spec-methodology-adapters-017.md:49`,
`spec-spec-pipeline-002.md:20`, `spec-deps-001.md:19` and the explorations are
historical statements of what was true when written. ADR 0020 and claim.md are not —
they are live text a reader consults today, and both now contradict the carriers.

## Acceptance

- [ ] ADR 0020's invariant list carries a **dated amendment** naming ADR 0021 §1 as the superseding rule — superseded, never rewritten
- [ ] `docs/claim.md:99` carries the two-axis rule with a pointer to ADR 0021
- [ ] No spec, plan or exploration is edited — frozen records stay as taken
- [ ] `npx prettier --check` clean on both files; `arggon validate` ok
- [ ] If `cli/src/capability-matrix.test.ts` pins either file verbatim, the amendment satisfies it and the suite stays green
