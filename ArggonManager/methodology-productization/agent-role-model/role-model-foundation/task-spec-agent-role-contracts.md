---
type: task
status: cancelled
id: task-spec-agent-role-contracts
title: "Spec: the four agent role contracts (Delivery lead / Practice & standards / Maker / Verifier) + domain-neutral gate language (ADR 0021 §6.1-§6.2)"
parent: role-model-foundation
labels: [methodology, spec, seam, roles]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-spec-agent-role-contracts.md
  Leaves live only under a story. id is the filename stem: task-spec-agent-role-contracts.
  CLI `arggon create task spec-agent-role-contracts` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec: the four agent role contracts (Delivery lead / Practice & standards / Maker / Verifier) + domain-neutral gate language (ADR 0021 §6.1-§6.2)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

ADR 0021 §6.1/§6.2 (amendment 2026-10-04, product-owner directive): the four
shipped agent contracts were written for a software-only loop while the carriers
declare the scope *"any project — not only software"* (ADR 0020 §Decision.1,
`spec-methodology-adapters-017.md:16–18`). Evidence of the contradiction today:
`arggon-worker.md` says *"Tests travel with behavior; run the project gates
(tests, lint, build)"*; `arggon-reviewer.md` binds the blocking bar to
*"probe evidence for CLI changes, real-browser drive for UI changes"*;
`arggon-prover.md` says *"suites import the kernel's built output"* and
*"no `--fix`, no `--write`, no formatters, no codegen"*. An adopter running a
non-software project reads those and gets a methodology that does not apply to it.

Classification: **bounded** (an existing flow to read and extend — the seam
generator and its four prompt templates) → spec first per the methodology table,
then the ADR 0017 hard gate.

## Acceptance

- [ ] Spec written with `arggon spec new` at `ArggonManager/docs/specs/` (next free number), status `proposed`
- [ ] Specifies the **role contract** of each of the four agents as *what it decides*, not what tool it touches: Delivery lead (PM), Practice & standards (tech lead / architect), Maker (programmer), Verifier (manual QA) — the software column is an example mapping, explicitly non-normative
- [ ] AC: the coordinator sequences and dispatches but does **not** own the `priority` field; it recommends priority changes and the PO owns them (ADR 0021 §2 unchanged) — the boundary is stated so the two roles cannot blur
- [ ] AC: the prover **reports** observed-vs-expected against the specification (manual QA) while still **not deciding the verdict** — the reviewer's judgment and the coordinator's merge call are unchanged. The existing no-mutation, no-verdict rules are restated in role language, not re-decided
- [ ] AC: every gate is named as *the project's verification gates* (what the adopting project declares), with the software case (tests, lint, typecheck, build, ADR 0008 smoke) given only as a worked example
- [ ] AC: the domain-invariant is the **acceptance contract on the item**, not the checking tool — stated once and used as the acceptance test for every contract
- [ ] AC: the role ids (`arggon-coordinator|worker|reviewer|prover`) are **unchanged wire names**; the spec pins that permissions, the ZCode manifest, the capability matrix and existing adopter files keep resolving (ADR 0021 §6.2a)
- [ ] AC: no permission, tool, capability-matrix, kernel, envelope or schema change — the contracts already enforce the roles structurally
- [ ] AC: a non-software worked example for **at least one** full pass (claim → work → review → verify → done) proving the contracts read sanely for a non-software project — this is the check exploration-018's edge-case row deferred as a *spike item* ("branch/PR model evaluated for non-code repos")
- [ ] `arggon spec analyze` reports no NEW findings before this item is done
