---
type: task
status: todo
id: task-decide-adr-0021-index-title-editorial-vs-verbatim
title: "ADR 0021: decide whether the index row stays editorial (needs `- Index title:`) or copies the H1 verbatim — PR #620's acceptance expected the declaration, the merge shipped the verbatim row"
parent: methodology-improvements
labels: [docs, adr]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-decide-adr-0021-index-title-editorial-vs-verbatim.md
  Leaves live only under a story. id is the filename stem: task-decide-adr-0021-index-title-editorial-vs-verbatim.
  CLI `arggon create task decide-adr-0021-index-title-editorial-vs-verbatim` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0021: decide whether the index row stays editorial (needs `- Index title:`) or copies the H1 verbatim — PR #620's acceptance expected the declaration, the merge shipped the verbatim row

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q
Filed from the PR #620 merge verification (PR merged as ed773495). **This is a discrepancy I introduced and shipped, recorded so it is not lost.**

### Context

#620's acceptance box 5 reads, verbatim:

> ADR 0020 (amended by merged PR #610) and ADR 0021 (renumbered, PR #605) both survive. … Its editorial row title needs the one-line declaration the failure message prints verbatim, which is the gate working, not a rejection of the renumber.

So the item's author **anticipated** exactly the failure the suite raised for ADR 0021, and named the expected remedy: keep the editorial row, add `- Index title: …` to ADR 0021. The row for 0021 is `Agents as primary workers, humans as product owner: role model, promotion policy, recorded acceptance` while ADR 0021's H1 is the shorter `Agents as primary workers, humans as product owner`. The editorial row tracks the **story** title (`agent-role-model`), which reads like intent, not accident.

During the merge I resolved it the other way: I made both drifted rows copy their H1 verbatim. For 0022 that is clearly right — its divergence is `External agent tooling:` vs `External agent tooling —` plus a dropped `and`, which is drift, not editorializing. For 0021 the editorial row may well be deliberate.

The result: the merge is green (9/9, and 130 files / 2751 tests), but a **ticked acceptance box in a merged item now describes a remedy that did not happen**. The suite's default rule ("verbatim unless declared") is satisfied either way, so no invariant is broken — but the record should not assert something untrue.

### Acceptance

- [ ] Decide for ADR 0021 which remedy is canonical: keep the editorial row + add `- Index title: Agents as primary workers, humans as product owner: role model, promotion policy, recorded acceptance` to `0021-agents-primary-workers-human-product-owner.md`, OR keep the verbatim row that merged
- [ ] If the editorial row is chosen, confirm `docs/engineering.md` §ADR process carries the rule from `task-adr-index-title-rule-unwritten-in-engineering-md` **first** — an undocumented declaration is exactly the invisible-divergence case that rule exists to prevent
- [ ] Whatever is decided, correct acceptance box 5 on `task-adr-index-parity-does-not-check-titles` (now `done`) so it records what actually shipped. Amending the prose of a merged item's checklist needs a dated comment or a one-line edit with a `Numbering note`-style addendum — **not** a rewrite of the box's history
- [ ] `npx vitest run cli/src/adr-index-parity.test.ts` green, and the corpus report re-derived: state how many rows are verbatim vs declared after the change
- [ ] Decide whether ADR 0022's verbatim row also wants the declaration instead — its H1 carries an em dash and a comma that the row lacked, which reads as accidental, but the same question applies
