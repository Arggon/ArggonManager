---
type: task
status: todo
id: task-agent-role-contracts-seam
title: "Seam: bring the four generated agent prompts + ZCode variants in sync with the role model and the domain-neutral contract (ADR 0021 §6.1-§6.2a)"
parent: role-model-foundation
labels: [methodology, seam, roles]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
depends_on: [task-spec-agent-role-contracts, task-wire-role-model-carriers, task-spec-agent-rename-migration]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-agent-role-contracts-seam.md
  Leaves live only under a story. id is the filename stem: task-agent-role-contracts-seam.
  CLI `arggon create task agent-role-contracts-seam` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Seam: bring the four generated agent prompts + ZCode variants in sync with the role model and the domain-neutral contract (ADR 0021 §6.1-§6.2a)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

ADR 0021 §6.1/§6.2/§6.2a — implement the role model in the generated seam. The
authoritative role table lands in `task-wire-role-model-carriers`
(`ArggonManager/docs/engineering.md`); the prompts **cite** it rather than
duplicating it, so the two cannot drift.

Renaming the agent files was considered and rejected (ADR 0021 §6.2a): ~320
references across ~130 files in this repo, and every adopter's copy is
materialized where `init` never overwrites and never deletes — a rename would
strand an orphaned, still-dispatchable fifth agent in each adopting tree.

## Acceptance

- [ ] Depends on `task-spec-agent-role-contracts` (ADR 0017 gate) **and** `task-wire-role-model-carriers` (the role table must exist before the prompts cite it)
- [ ] `templates/docs/opencode/agents/arggon-{coordinator,worker,reviewer,prover}.md` each open with their role (Delivery lead / Practice & standards / Maker / Verifier) plus a one-line pointer to the role table in `docs/engineering.md`
- [ ] Software-locked nouns replaced by the project's own terms, each keeping one software example: worker "tests travel with behavior" → "evidence travels with the change; run the gates the project declares"; reviewer "probe evidence for CLI changes, real-browser drive for UI" → "the blocking bar the project's engineering docs declare"; prover "suites import the kernel's built output" → "a gate may need its project's build step first"
- [ ] The `description:` frontmatter of each prompt carries the role, since that is what a dispatcher shows
- [ ] The ZCode agent variants (`templates/docs/zcode/arggon/agents/`) carry the same roles in ZCode frontmatter
- [ ] Permission blocks unchanged; a test pins that the four ids, their `mode` and their least-privilege denials survive the rewrite
- [ ] `cli/src/init.test.ts` / `init-zcode.test.ts` green; capability matrix needs no row change (no capability changes)
- [ ] `skills/arggon-cli/**` and `.agents/skills/arggon-cli/**` byte-equal if a reference changes (ADR 0016 channel, Behavioral class)
- [ ] `arggon validate` + `npm test` green; `npx prettier --check` on every touched file

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
verdict: changes-requested (scope widened by PM sequencing, 2026-10-04)

This item now carries **three** changes in **one PR**, because they are the same
files and the same migration:

1. **Rename** the seven agent files to their role ids (§6.2a′):
   `arggon-coordinator` → `arggon-delivery-lead`,
   `arggon-reviewer` → `arggon-standards-reviewer`, `arggon-worker` → `arggon-maker`,
   `arggon-prover` → `arggon-verifier`
2. **Role contracts** (§6.1) — each prompt opens with its role and cites the role table
3. **Domain-neutral language** (§6.2) — gates named as what the project declares

Splitting these would mean two passes over the same seven templates, two
Behavioral releases, and a window where the ids and the contracts disagree.

New dependencies: `task-spec-agent-rename-migration` (the folded spec) **and**
`task-adapter-orphan-reaping` — the rename is forbidden from landing before reaping
exists, or adopters keep a dispatchable orphan per old file (§6.2a′).

Everything else in this checklist stands; the role-contract and domain-neutrality
criteria from the cancelled `task-spec-agent-role-contracts` moved here verbatim.
