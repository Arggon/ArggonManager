---
type: task
status: in_progress
id: task-agent-role-contracts-seam
title: "Seam: bring the four generated agent prompts + ZCode variants in sync with the role model and the domain-neutral contract (ADR 0021 §6.1-§6.2a)"
assignee: arggon-coordinator
branch: feat/task-agent-role-contracts-seam
parent: role-model-foundation
labels: [methodology, seam, roles]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
claimed_at: "2026-10-04T23:52:10.835Z"
depends_on: [task-wire-role-model-carriers, task-spec-agent-rename-migration, task-adapter-orphan-reaping]
worktree_path: /home/arggon/Projects/ArggonManager-task-agent-role-contracts-seam
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

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
### 2026-10-04 @coordinator
verdict: changes-requested (one more file set to sweep, from PR #636's review)

The carrier wiring landed a **role table carrying the old ids** in
`ArggonManager/docs/engineering.md` (§Roles and authority) and a four-row table in
`skills/arggon-cli/references/orchestration.md`. Both name the ids this item renames, so
the rename must refresh them **in the same PR** or the carriers will contradict the
seam:

- [ ] `docs/engineering.md` role table: the **Shipped id** column becomes the four new ids
- [ ] `skills/arggon-cli/references/orchestration.md`: the four-row table plus the two surrounding sentences naming the old ids
- [ ] `skills/arggon-cli/**` and `.agents/skills/arggon-cli/**` stay byte-equal
- [ ] `docs/agents.md` §Orchestration agent list and the review-bar headings use the new ids

A stale id in a carrier is worse than a stale id in prose: the carriers are what every
adopter's agents read as the contract. It also keeps
`task-agent-identity-claim-discipline` honest — it must not tell agents to claim as an
id that no longer ships.

### 2026-10-05 @coordinator
verdict: approve

Closes the seam migration in one PR: **rename + role contracts + domain-neutral gate language** (ADR 0021 §6.1/§6.2/§6.2a′, spec-agent-rename-019). PR #641 — **merge, do not squash**.

### The rename

`arggon-coordinator` → `arggon-delivery-lead` · `arggon-reviewer` → `arggon-standards-reviewer` · `arggon-worker` → `arggon-maker` · `arggon-prover` → `arggon-verifier` (7 templates via `git mv`; history follows).

Each prompt opens with `**Role: <role>.**` + what it decides and cites `docs/engineering.md` §Roles and authority instead of duplicating it; `description:` carries the role (what a dispatcher shows); gates are now "the gates this project declares" / "the blocking bar the project's engineering docs declare", each keeping ONE software worked example; both boundaries (delivery lead ≠ priority owner, verifier reports-does-not-rule) are stated in the contracts. Identity discipline (§5, folded in): claim as the **role id**, never the PO's login, with the why and the `@me` note.

Carriers refreshed in the same PR: `docs/engineering.md` role table, `docs/agents.md` §Orchestration, `skills/arggon-cli/references/orchestration.md` (+ byte-equal `.agents` copy), README, opencode playbook.

### AC 2 / AC 3 — the drift guards (both derived, never restated)

- **AC 2**: `init-zcode.test.ts` reads the reviewer id out of the **shipped template** (identified by the verdict channel in its `tools:` allowlist) and asserts the gate's own `isReviewerDispatch` matcher matches it, plain and plugin-qualified, and matches **no other** shipped agent. *Verified by breaking it:* reverting the matcher to `arggon-reviewer` → 3 failures, incl. `the gate matches arggon-reviewer but the shipped reviewer is arggon-standards-reviewer`. The behavioural gate probes now derive the same id.
- **AC 3**: the delivery lead's `subagent` allow-list is pinned to exactly the shipped subagent ids (from the templates dir; `mode: primary` = the lead) + `explore`. *Verified by breaking it:* dropping `arggon-verifier` from the list fails; keeping a stale `arggon-worker` entry fails.
- **AC 12**: the whole deny set pinned per role (action + named resource) — dropping `arggon_branch` from the verifier fails. Allow-lists stay with AC 3.

### Gates — expected vs observed

| gate | expected | observed |
| --- | --- | --- |
| `npm run build` | ok | ok |
| `arggon validate` | ok, 0 warnings | `ok (0 warning(s), convention v5)` |
| `arggon spec validate` | ok | `ok (34 doc(s), 5 warning(s))` — pre-existing doc-number collisions |
| `arggon spec analyze` | no NEW findings | `10 finding(s) across 21 spec(s)` — byte-identical to `main` (re-ran on a stashed tree to prove it) |
| `prettier --check` (43 touched files) | clean | `All matched files use Prettier code style!` |
| `npm test` | green | **2661 passed / 128 files, 0 failed** (after `npm run build`) |
| `npm run check:plugin` | bundle current | clean — regenerated, committed, re-run after the last edit |
| `npm run smoke:native-start-cold` | passed | passed |
| `npm run smoke:opencode:wave` (AC 9) | passed on the new ids | **`passed — 2 fixture(s), 0 failures`** |
| CI drift gate (`init` + porcelain) | clean | clean |

Wave detail: reviewer edit denied, maker cannot nest, lead launches `explore`/`arggon-maker`/`arggon-standards-reviewer` and is denied `general`, two foreground makers in disjoint worktrees, **both claims stamped with a role id**, reviewer verdicts on both items (vacuous-match guard green), local merges, done flips, validate green, accounting exported.

### Two things the reviewer should know

1. **The wave's first run failed 50/50 on `AI.Error.QuotaExceeded: Go usage limit exceeded`** — present in **all 13** session transcripts, i.e. the harness's pinned default model (`opencode-go/deepseek-v4-flash`) is out of quota, not a code fault. Re-ran with `OPENCODE_WAVE_MODEL=opencode-go/space-bunny-free` → green. The committed default is unchanged.
2. **This repo's generated seam is TRACKED, not gitignored** (contrary to the briefing): `.opencode/` + `.zcode-marketplace/` are committed, and CI's drift gate regenerates them and requires byte-equality. So the six old destinations were reaped by hand after verifying each is byte-identical to what its old template generated (`doctor` refuses them — their recorded checksums predate a re-stamp), their stale `x-generated` entries dropped as `init` instructs, and **`.opencode/agents/arggon-prover.md` deleted outright** — it has no provenance entry (the filed `bug-prover-agent-has-no-x-generated-entry`), so neither `init` nor the reap can see it, and leaving it would have stranded a fifth still-dispatchable agent on the pre-rename contract.

### Findings reported, not filed (coordinator's call)

- **ADR 0021 §5 still lists the old ids** (`arggon-coordinator, arggon-worker, arggon-reviewer, arggon-prover`) as what agents claim as. It is now factually wrong, and §6.2a′ is the amendment that supersedes the naming. ADRs are not mine — needs a status note or a §5 refresh.
- **`cli/src/docs.ts:990`** names `.opencode/agents/arggon-coordinator.md` as the stranded-file example; one-token comment fix, file is not mine.
- **`templates/docs/AGENTS.md:17`** (the *generated* AGENTS.md) still says "a coordinator assigns each item to a subagent … the coordinator (lead architect) code-reviews". No id, so nothing contradicts the seam, but the role word is pre-rename. File is not mine.
- **Historical claims keep their old ids.** Every `assignee: arggon-coordinator` on the 525 tracked items is now a retired id. Data, not drift; worth a line in the release note so adopters are not surprised.
- **Harness observation (not a failure, not from this change):** the wave's "the probe file was never created" check is model-dependent — on one run the reviewer wrote it with `shell` (`echo probe > reviewer-write.txt`), which it is *designed* to have; `edit * deny` is not a filesystem sandbox. The permission-layer check (`no edit/write/patch tool call`) passed on that same run and is the deterministic one.
- **Scope I extended** (flagged in the PR): the command templates' `agent:` frontmatter (a dispatch pointer — leaving it would make `/arggon-review` dispatch a non-existent agent), `cli/src/adapter-orphan-reaping.test.ts` (`dropTemplate` asserts the template exists, so the rename breaks it outright), and the wave's claim assertion (it pinned `assignee: arggon-maker-*`, encoding the older "each maker claims itself" expectation this PR's claim-before-dispatch contract supersedes — now asserts the identity doctrine instead).

### handoff 2026-10-05 @coordinator (session: ses_ef6aa92bcffeaB2GIFj8EdtG5i) — next: Review and merge PR #641 (merge, do not squash); the item is complete and must not be flipped to done by me
- branch: feat/task-agent-role-contracts-seam
- open questions: ADR 0021 §5 still lists the old ids as what agents claim as (not mine to edit); cli/src/docs.ts:990 example path and templates/docs/AGENTS.md:17 role word are stale too. Historical claims keep retire…
