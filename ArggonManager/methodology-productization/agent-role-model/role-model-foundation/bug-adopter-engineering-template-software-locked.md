---
type: bug
status: todo
id: bug-adopter-engineering-template-software-locked
title: templates/docs/docs/engineering.md (the adopter-facing review-bar template) is software-locked — ADR 0021 §6.2 domain neutrality does not reach the file every new adopter reads first
parent: role-model-foundation
labels: [docs, templates, methodology]
priority: p2
created: "2026-10-04"
updated: "2026-10-04"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-adopter-engineering-template-software-locked.md
  Leaves live only under a story. id is the filename stem: bug-adopter-engineering-template-software-locked.
  CLI `arggon create bug adopter-engineering-template-software-locked` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# templates/docs/docs/engineering.md (the adopter-facing review-bar template) is software-locked — ADR 0021 §6.2 domain neutrality does not reach the file every new adopter reads first

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

ADR 0021 §6.2 makes domain neutrality part of the methodology: a rule is named by
**what the project declares**, never by software artifacts. The carriers now honor
that, but `templates/docs/docs/engineering.md` — the template `arggon init` renders
into every adopting repo's `ArggonManager/docs/engineering.md` — still opens with
*"code is cheap; good practices and sound software architecture are always
important"* and keeps *"Tests cover the behavior change"* in its expectations table.

So the first document a non-software adopter reads after `init` teaches them a
software-only bar, while the carriers say otherwise. Found reviewing PR #636 (the
worker flagged it rather than widening scope — correct, `templates/**` was outside its
file set).

## Acceptance

- [ ] The operating principle and the testing-expectations rows are restated as what the adopting project declares, software case kept as one worked example
- [ ] Software-noun table headers generalized the same way
- [ ] The **review bar keeps its teeth**: a generically stated bar is still blocking, still evidenced, still owned — no bar weakened or dropped while being generalized
- [ ] `x-generated` provenance respected — re-running `init` must not read as adopter-edited spuriously
- [ ] `cli/src/init.test.ts` + the prose-format suite green; `arggon validate` ok; prettier clean
- [ ] Cross-checked against `templates/docs/docs/agents.md` and `convention.md` for the same lock — if clean, say so in the item rather than editing them

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
### 2026-10-04 @coordinator — scope widened (finding from PR #638's review)

A worker on `bug-parity-invariant-restated-outside-carriers` found the **same defect in a
sibling file with a larger blast radius**, and it belongs in this item rather than a
near-duplicate:

- **`templates/docs/docs/convention.md:3`** — the adopter template `arggon init` writes into
  every new project still says *"Humans and agents follow the same rules"* **verbatim**,
  which the two-axis rule (ADR 0021 §1) superseded. This is the file that becomes every
  new adopter's `ArggonManager/docs/convention.md`, so it teaches the superseded rule at
  `init` time — before the adopter has read anything else.

**The part that matters more than the sentence:** no test guards it.
`cli/src/init-docs.test.ts:166` asserts the file is *adopter-owned* but never compares its
content against the carriers' invariant block. So an adopter template can carry a
superseded rule, ship green, and be wrong at every adopter's first read. That is the same
class as `bug-x-tracker-option-list-has-no-doc-drift-guard` — a carrier restated in a
second place with nothing tying the two together.

**Added to this item's acceptance:**

- [ ] `templates/docs/docs/convention.md` carries the two-axis rule (or points at the carrier that does) instead of the verbatim parity sentence
- [ ] **A guard exists**: a test asserts the adopter templates' invariant statement matches the carriers' invariant block, so the two cannot drift. Without this row, the fix is one `init` regeneration away from regressing
- [ ] The guard covers `templates/docs/docs/engineering.md`, `agents.md`, `convention.md`, `AGENTS.md` and `README.md` as one set — the whole template family — rather than the single file that happened to break
- [ ] ADR 0016 upgrade-channel note: an **existing** adopter's copy is not refreshed by `init` (never-overwrite), so the corrected template only reaches **new** trees. Say in the release notes that adopters must reconcile their own copies, and decide whether `init --propose` should carry it
- [ ] Cross-checked against `templates/docs/docs/AGENTS.md:17` and `templates/docs/docs/viewer-spike.md` — the work-loop-parity statements there are still correct under the two-axis rule and must be left alone
