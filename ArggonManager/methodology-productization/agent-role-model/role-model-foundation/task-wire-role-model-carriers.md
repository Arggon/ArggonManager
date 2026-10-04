---
type: task
status: in_progress
id: task-wire-role-model-carriers
title: "Carrier wiring: supersede the parity invariant in agents.md/engineering.md/convention.md + README + both skill copies (ADR 0021 §1, §2, §6)"
assignee: arggon-coordinator
branch: feat/task-wire-role-model-carriers
parent: role-model-foundation
labels: [methodology, docs, roles]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
claimed_at: "2026-10-04T21:05:02.955Z"
depends_on: [task-spec-promotion-policy-and-acceptance]
worktree_path: /home/arggon/Projects/ArggonManager-task-wire-role-model-carriers
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

- [x] Depends on `task-spec-promotion-policy-and-acceptance` (ADR 0017 gate) landing first — verified: that item is `done`, `spec-promotion-policy-018` is on `main` and this branch descends from its merge
- [ ] `README.md:59` (Principle 3), the invariant blocks of `agents.md:6`, `engineering.md:6`, `convention.md:6`, and ADR 0020's invariant block all carry the two-axis rule: **work-loop parity, asymmetric and named authority** — **4 of 5 done**: README:59, README:67 and the three carrier invariant blocks carry it. **Not done: ADR 0020's invariant block (`ArggonManager/docs/adr/0020-methodology-first-productization.md:62`) is outside the five files this item owns** — reported to the coordinator, not edited (also still stated at `docs/claim.md:99`, `spec-methodology-adapters-017.md:49`, `spec-spec-pipeline-002.md:20`, `exploration-product-discovery-002.md:26`, `exploration-methodology-productization-018.md:84`, `agent-native.md:19,30`)
- [x] `engineering.md:12` and the review-bar section headers stop naming human job titles for work the shipped agents perform; architect / reviewer / prover / QA become agent roles — ownership line → roles + role-table pointer; headers are now (practice & standards) / (product owner) / (maker) / (verifier); `grep` for `Software Architect|Project Manager|Software Developer|UI Tester|lead architect` over the five files returns nothing load-bearing (only README:420's board-copy phrase "standing PM view", left as UI copy)
- [x] The bounded **authority map** table lands in `engineering.md` (ADR 0021 §2): the four irreversible powers keep their existing structural gates and are named as such — §Roles and authority carries the 10-row map plus a second table naming steal / waive / force / reopen and the gate each one already had
- [x] The bounded **promotion-policy tier table** lands beside the review bar (ADR 0021 §3) — T0/T1/T2 under §Review bar → Product acceptance, with the "no product owner = compliant by default" rule and the `accept:` convention
- [x] `agents.md` §5 / §Orchestration / §Changing the methodology itself updated where the old wording becomes false; the `SECURITY.md`-contact-is-human-input style human-only notes are kept, not deleted — §5 gained the domain-invariant checklist + the acceptance/tiers paragraphs (the `--waive` human-only note is kept verbatim); §Orchestration names the roles, the prover boundary and sequencing ≠ priority; §Changing the methodology itself needed no edit (impact-class rules unchanged); the §Adoption sweep `SECURITY.md` note is untouched
- [x] `skills/arggon-cli/**` and `.agents/skills/arggon-cli/**` byte-equal in this PR (parity test enforces it) — `.agents/skills/arggon-cli/**` is a **gitignored derived copy** (`cli/src/skill-copy.test.ts` regenerates it from source), so `skills/arggon-cli/**` is the only committed surface; `npm test` runs that test green
- [x] README §The methodology + the release note name the new convention for adopters — README gained the roles paragraph, the promotion-policy paragraph and the carriers pointers; `CHANGELOG.md` is release-please-generated (not hand-editable here), so the adopter-migration note rides the commit body, which is what release-please turns into the release entry
- [x] `arggon validate` and `arggon spec validate` green; no carrier statement left false by this edit — both green; `spec analyze` 10 findings before and after, 0 new, none in a touched file. Residual false-by-omission statements outside the five files are listed in the `verdict: approve` comment
- [x] No kernel rule, schema field, command or per-adapter behavior changed — this item is carriers only — **with one disclosed data mirror**: `adapters/capability-matrix.json` carries the two restated invariant clauses, because `cli/src/capability-matrix.test.ts` pins them verbatim to the carriers' header block (data + `doctor` display only; no rule logic in that file by its own `modeNote`)

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

verdict: changes-requested (scope extended by ADR 0021 §6.1/§6.2 amendment)

The product owner extended this item's scope. Two acceptance criteria are added and
one dependency is wired, because the authoritative role table has to exist before
the seam prompts can cite it (ADR 0021 §6.1):

- [x] The bounded **role table** from ADR 0021 §6.1 lands in `docs/engineering.md`: each shipped id → role (Delivery lead / Practice & standards / Maker / Verifier) + software analogue (marked non-normative) + non-software analogue + what it decides — §Roles and authority → The role table; a bounded 4-row restatement also lands in `skills/arggon-cli/references/orchestration.md` so the skill cites the table instead of duplicating it
- [x] The table states the two boundaries §6.1 pins: the coordinator sequences and dispatches but does **not** own `priority` (the PO does), and the prover reports observed-vs-expected without deciding the verdict — both in `engineering.md` §Roles and authority, in `agents.md` §Orchestration (delivery lead + "sequencing ≠ priority"; verifier "reports, it does not rule") and in `convention.md` §Priority (v4) (owner bullet)
- [x] Gate language in the carriers is domain-neutral (§6.2): each bar is named as _what the project declares_, with the software case as one worked example; the acceptance contract on the item is named as the domain-invariant — `engineering.md` §Review bar lead-in ("a bar is named by what the project declares … the parenthetical gates are the software worked example"), the smoke gate as "the project's own verification gates", §Testing expectations, §Definition of done; the domain-invariant is named in `agents.md` §5, in `convention.md`'s opening and in the skill references
- [ ] Now depends on `task-spec-agent-role-contracts` as well as the promotion-policy spec (ADR 0017 gate) — **not wired, deliberately**: `task-spec-agent-role-contracts` is `cancelled`, folded into `task-spec-agent-rename-migration` (spec-019, merged, `done`), so the ADR 0017 gate this row exists for is already satisfied by that spec. A `depends_on` edge to a cancelled item would record a gate nothing enforces — reported to the coordinator instead of wired
- [x] `task-agent-role-contracts-seam` depends on **this** item — the prompts cite this table, so this lands first — already true: its frontmatter reads `depends_on: [task-wire-role-model-carriers, task-spec-agent-rename-migration, task-adapter-orphan-reaping]`

Everything else in this checklist stands unchanged.
