---
type: task
status: todo
id: task-adr-index-title-rule-unwritten-in-engineering-md
title: "The ADR index Title rule (\"verbatim unless the ADR declares `- Index title:``) is enforced by the suite but written down nowhere an agent or author reads"
parent: methodology-improvements
labels: [docs, adr]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr-index-title-rule-unwritten-in-engineering-md.md
  Leaves live only under a story. id is the filename stem: task-adr-index-title-rule-unwritten-in-engineering-md.
  CLI `arggon create task adr-index-title-rule-unwritten-in-engineering-md` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The ADR index Title rule ("verbatim unless the ADR declares `- Index title:``) is enforced by the suite but written down nowhere an agent or author reads

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q
Filed from the PR #620 review (verdict: approve, landed as ed773495). This was the reviewer's blocking-adjacent follow-up F1 and it is **unfiled** work, so it needed an item.

### Context

`cli/src/adr-index-parity.test.ts` now enforces that each ADR index row's Title column copies that ADR's own `# NNNN Title` heading **byte for byte**, unless the ADR declares a deliberate editorial divergence with a `- Index title: …` line in its own metadata list. Three ADRs (0002, 0003, 0018) carry that declaration today.

That rule is enforced in code and documented **only** in `ArggonManager/docs/adr/README.md` — the file under test. Nothing tells an ADR author it exists. `docs/engineering.md` §ADR process has a "Location & naming" subsection, and the rule belongs there.

The live consequence was measured during the #620 merge: main had grown ADR 0021 and 0022 *after* that branch was cut, and **two index rows on main did not match their own H1**. The new suite caught them on first run. Neither was declared, so both were drift. The rule earned its keep immediately — and it will keep catching this class only if the rule is written where authors read it, not only where the test reads it.

### Acceptance

- [ ] `docs/engineering.md` §ADR process → "Location and naming" states the rule: the index row's Title copies the ADR's own H1 byte for byte, and a deliberate editorial row must declare `- Index title: …` in the ADR's metadata list
- [ ] The sentence points at the enforcing suite (`cli/src/adr-index-parity.test.ts`) by name, the way other carrier statements point at their gate
- [ ] It does not restate the per-ADR corpus composition (which ADRs declare today) — that is a moving fact and belongs to the index file, not the carrier. This is the delete-don't-correct decision PR #618 already made for ADR statuses
- [ ] Verified against the authority: the rule as implemented in `readAdr`/the title assertion, not against the README's own prose
- [ ] Impact class stated per `docs/agents.md` §Changing the methodology
- [ ] `npx prettier --check ArggonManager/docs/engineering.md` clean, and `arggon validate` ok

Note: whoever writes this clause must land it **together with** the #618 author if #618 is still editing the same §ADR process paragraph — see `task-decide-adr-0021-index-title-editorial-vs-verbatim` and the merge-order note on `bug-engineering-doc-stale-adr-statuses`.
