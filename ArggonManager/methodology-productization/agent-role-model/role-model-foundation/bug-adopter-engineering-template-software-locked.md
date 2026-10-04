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
