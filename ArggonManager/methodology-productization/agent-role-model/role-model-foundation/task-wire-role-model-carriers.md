---
type: task
status: done
id: task-wire-role-model-carriers
title: "Carrier wiring: supersede the parity invariant in agents.md/engineering.md/convention.md + README + both skill copies (ADR 0021 §1, §2, §6)"
assignee: arggon-coordinator
branch: feat/task-wire-role-model-carriers
parent: role-model-foundation
labels: [methodology, docs, roles]
priority: p1
created: "2026-10-04"
updated: "2026-10-05"
depends_on: [task-spec-promotion-policy-and-acceptance]
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
- [x] `README.md:59` (Principle 3) and the invariant blocks of `agents.md:6`, `engineering.md:6`, `convention.md:6` all carry the two-axis rule — **shipped in #636** (`f2163380`); verified byte-identical across the three carriers
- [x] ~~ADR 0020's invariant block~~ — **not this item's job and not shipped here**: ADR 0020 is outside the five files this item owns, so the clause stayed. Filed as `bug-parity-invariant-restated-outside-carriers` (with `docs/claim.md:99`) rather than ticked dishonestly
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
- [x] ~~Now depends on `task-spec-agent-role-contracts`~~ — **row obsolete**: that spec was `cancelled` and folded into `task-spec-agent-rename-migration` (spec-019, merged `9fbb81d4`); the only remaining dependency is the promotion-policy spec, which is satisfied
- [x] `task-agent-role-contracts-seam` depends on **this** item — the prompts cite this table, so this lands first — already true: its frontmatter reads `depends_on: [task-wire-role-model-carriers, task-spec-agent-rename-migration, task-adapter-orphan-reaping]`

Everything else in this checklist stands unchanged.

### 2026-10-04 @ses_ef74390b4ffeZmQ20CTdt3vI10
verdict: approve

Methodology carriers rewired to ADR 0021's role model. **Impact class: Behavioral**
(agents must re-learn their operating contract) — shipped through the ADR 0016
channel; `skills/arggon-cli/**` is the committed source and
`.agents/skills/arggon-cli/**` is its gitignored generated copy (the parity test
rebuilds it, `npm test` green).

## Gates — expected vs observed

| Gate | Expected | Observed |
| --- | --- | --- |
| `npm run arggon -- validate` | ok, 0 warnings | ok, 0 warnings, convention v5 — also green on both commits (pre-commit gate) |
| `npm run arggon -- spec validate` | ok, 5 pre-existing DOC_NUMBER_COLLISION warnings | ok (34 docs, 5 warnings) — identical before and after |
| `npm run arggon -- spec analyze` | 0 NEW findings attributable to this change | 10 findings before, 10 after, **0 new / 0 gone**; 0 findings name a touched file. With `--baseline ArggonManager/spec-analyze-baseline.json`: "5 new, 1 resolved, 5 unchanged" — **identical before and after my edits**; those 5 are pre-existing doc-number collisions in specs/plans/explorations I did not touch |
| `npx prettier --check` on every file I touched | clean | clean on all 9 touched files. `skills/arggon-cli/references/exploration.md` fails `--check` — **also fails at HEAD** (pre-existing, not mine; not fixed, to keep the diff on-item) |
| `npm test` | green, no code change | **2590 passed / 126 files, 0 failed** — after `npm run build`, which the suite requires. First run failed one suite (`headless-ci.test.ts`: "run `npm run build` first") purely because a fresh worktree has no `dist/`; after building, that suite passes 7/7 and the whole suite is green |
| `npm run arggon -- report` | read-only, closes with validate green | ran clean; validate green afterwards |
| extra: `npm run lint`, `npm run test:structure`, `npm run check:plugin` | green | green (0 findings / 5 passed / plugin current) |

## What landed

- **Two-axis rule** (ADR 0021 §1) in the three carrier invariant blocks + README
  Principle 3 and README §The methodology. The carriers' `**Invariants:**` line is
  pinned **verbatim** to `adapters/capability-matrix.json` by
  `cli/src/capability-matrix.test.ts`, so the two restated clauses are mirrored
  there — that is the only file outside my five, it is data (`doctor` display), and
  the change is forced by the test. Full disclosure in the checklist.
- **`engineering.md` §Roles and authority** (new): the role table (shipped id →
  role → software analogue *marked non-normative* → non-software analogue → what it
  decides), the two §6.1 boundaries, the 10-row authority map, and a second table
  naming the four irreversible powers with the gate each already had (steal =
  armed config + TTY; waive = ADR 0015, no agent parameter; force = refused for
  agent callers in `lib/src/rules.ts`; reopen = TTY, piped stdin refused).
- **Promotion-policy tiers** beside the review bar (T0 leaves self-certified and the
  default / T1 containers recorded as an `accept:` comment / T2 the irreversible
  powers), the bounded `accept:` convention, and "no product owner = compliant by
  default, never blocked".
- **Review-bar headers** now read practice & standards / product owner / maker /
  verifier; bars are named as *what the project declares* with the software case as
  one worked example; the acceptance contract on the item is named as the
  domain-invariant.
- `agents.md` §5 (done contract + acceptance is recorded-never-gated), §Orchestration
  (roles, "sequencing ≠ priority", verifier "reports, it does not rule");
  `convention.md` (parity + named authority in the opening, product-owner naming on
  steal and reopen, a `priority` owner bullet). **Human-only notes kept, not
  deleted** — the `--waive` note in §5 and the `SECURITY.md`-contact-is-human-input
  note in the §Adoption sweep are untouched.
- Skill: a bounded 4-row role restatement + the parity/authority summary in
  `references/orchestration.md`, a "Who decides" section in
  `references/pitfalls.md`, the checklist-as-done-contract line in
  `references/methodology.md`, and two pointers in `SKILL.md`.

## Reported, not edited (outside the five files I own)

1. **ADR 0020's invariant block** (`adr/0020-methodology-first-productization.md:62`)
   still states the superseded one-axis invariant, and so do
   `docs/claim.md:99`, `docs/specs/spec-methodology-adapters-017.md:49`,
   `docs/specs/spec-spec-pipeline-002.md:20`,
   `docs/explorations/exploration-product-discovery-002.md:26`,
   `docs/explorations/exploration-methodology-productization-018.md:84` and
   `ArggonManager/agent-native/agent-native.md:19,30`. Specs/explorations are
   historical records, so I read those as correctly frozen; `claim.md` and ADR 0020
   are live normative text and **should** get the same wording — that needs an
   owner, and it is why checklist row 2 stays unticked.
2. **`templates/docs/docs/engineering.md`** (the adopter-owned review-bar
   template) is hard-coded software: "code is cheap; sound software architecture",
   "Tests cover the behavior change". It carries no job titles and no invariant
   block, so nothing it asserts became false — but it is the first thing a
   non-software adopter reads. `templates/**` is out of my scope.
3. **`skills/arggon-cli/references/exploration.md` fails `prettier --check` at
   HEAD** (pre-existing).
4. **The one item in the item-adjacent batch whose id I could not satisfy**:
   the amendment asks this item to depend on `task-spec-agent-role-contracts`,
   which is `cancelled` and folded into `task-spec-agent-rename-migration`
   (spec-019, merged). I did not add a `depends_on` edge to a cancelled item.

## Notes for the reviewer

- The **ids stay** `arggon-coordinator|worker|reviewer|prover` in these carriers,
  with one sentence naming them wire names and pointing at ADR 0021 §6.2a′; the
  role table states what a role *decides*. Whoever lands the §6.2a′ rename has to
  update that column + the `references/orchestration.md` role table (5 + 4 cells and
  one sentence each) — flagged so it is not forgotten.
- `README.md:420` keeps the phrase "standing PM view" describing the board summary
  header; that is UI copy, not an authority assignment, so I left it.
- Release note: `CHANGELOG.md` is release-please-generated
  (`release-please-config.json`, `skip-github-release`, conventional-commit
  sections), so the adopter-migration note lives in the commit body — that is what
  becomes the release entry.

### handoff 2026-10-04 @ses_ef74390b4ffeZmQ20CTdt3vI10 (session: ses_ef74390b4ffeZmQ20CTdt3vI10) — next: Coordinator: review + merge (do not squash) the carriers PR; then unblock task-agent-role-contracts-seam (its prompts cite the new role table).
- branch: feat/task-wire-role-model-carriers
- open questions: ADR 0020 invariant block + docs/claim.md:99 still state the superseded one-axis rule — file/assign that (not mine); templates/docs/docs/engineering.md is software-locked for non-software adopters; di…
