---
type: task
status: done
id: task-adr-0021-role-model-amendment
title: "ADR 0021 amendment (§6.1-§6.2a): name the four agent roles, make the contracts domain-neutral, and record why the role ids stay stable"
assignee: arggon-coordinator
branch: feat/task-adr-0021-role-model-amendment
parent: role-model-foundation
labels: [docs, adr, roles, methodology]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
worktree_path: /home/arggon/Projects/ArggonManager-task-adr-0021-role-model-amendment
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-adr-0021-role-model-amendment.md
  Leaves live only under a story. id is the filename stem: task-adr-0021-role-model-amendment.
  CLI `arggon create task adr-0021-role-model-amendment` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0021 amendment (§6.1-§6.2a): name the four agent roles, make the contracts domain-neutral, and record why the role ids stay stable

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

Product-owner directive (2026-10-04): the shipped agents are not in sync with the
role model ADR 0021 introduced — *"if the human is the product owner, the
coordinator would be the product manager"*, the reviewer a tech lead / architect
who asks for refactors and holds the architecture, the worker the programmer, the
prover manual QA — and **all roles must adapt to any kind of project**, since
ArggonManager is a methodology other projects adopt.

ADR 0021 §6 already decided the *direction* (stop naming human job titles for work
the agents perform). This amendment records the *content*: the role names, the two
boundaries that keep the roles from blurring, the domain-neutrality clause, and the
rejected rename with its adopter cost. The decision body is unchanged — a dated
amendment, the pattern ADR 0020 already uses twice.

## Acceptance

- [x] ADR 0021 carries a dated amendment adding §6.1 (role table: shipped id → role → software analogue marked non-normative → non-software analogue → what it decides) and §6.2 (a role is defined by what it decides, never by software artifacts)
- [x] §6.1 pins the two boundaries: the coordinator sequences and dispatches but the PO owns `priority`; the prover reports observed-vs-expected without deciding the verdict
- [x] §6.2a records the **rejected rename** with its evidence (~320 references across ~130 files; `init` never overwrites and never deletes a generated file, so adopters would keep an orphaned, still-dispatchable fifth agent) and states the id is a stable wire name
- [x] §6.2b states what does NOT change: no permission, tool, capability-matrix, kernel, envelope or schema change
- [x] The ADR's own body is **not** rewritten — an ADR is superseded, never silently rewritten (`docs/engineering.md` §ADR process); the amendment sits in the header block above `## Context`
- [x] `cli/src/adr-index-parity.test.ts` green (7 passed) — the index row status is untouched (`Accepted`)
- [x] `npx prettier --check` clean; `arggon validate` ok
- [x] Follow-ups filed and gated: `task-spec-agent-role-contracts` → `task-agent-role-contracts-seam` (depends on this role table landing first), with `task-wire-role-model-carriers` extended to carry the authoritative table
- [x] Impact class: **Behavioral** (an agent's operating contract changes) — ADR 0016 channel named in the PR
