---
type: task
status: in_progress
id: task-spec-agent-rename-migration
title: "Spec: the agent rename migration (coordinator→delivery-lead, reviewer→standards-reviewer, worker→maker, prover→verifier) + orphan reaping for adopter trees"
assignee: arggon-coordinator
branch: feat/task-spec-agent-rename-migration
parent: role-model-foundation
labels: [methodology, spec, seam, migration]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
claimed_at: "2026-10-04T20:51:56.148Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-spec-agent-rename-migration
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-spec-agent-rename-migration.md
  Leaves live only under a story. id is the filename stem: task-spec-agent-rename-migration.
  CLI `arggon create task spec-agent-rename-migration` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec: the agent rename migration (coordinator→delivery-lead, reviewer→standards-reviewer, worker→maker, prover→verifier) + orphan reaping for adopter trees

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Scope (inventory taken 2026-10-04 from the repo, not estimated)

### The rename map — role-named ids, software titles stay *analogues*

| old id | new id | role (ADR 0021 §6.1) | software analogue |
| --- | --- | --- | --- |
| `arggon-coordinator` | `arggon-delivery-lead` | Delivery lead | product manager |
| `arggon-reviewer` | `arggon-standards-reviewer` | Practice & standards | tech lead / architect |
| `arggon-worker` | `arggon-maker` | Maker | programmer |
| `arggon-prover` | `arggon-verifier` | Verifier | manual QA |

Naming rule: the id names the **role**, never the software title — that is §6.2
applied to filenames. `arggon-product-manager` / `arggon-tech-lead` were considered
and rejected as ids: they re-import the software framing §6.2 removes. The software
title stays in the role table as a non-normative analogue.

### Surface inventory — every place an agent id is load-bearing

| # | Surface | Files | Coupling |
| --- | --- | --- | --- |
| A | OpenCode agent templates | `templates/docs/opencode/agents/arggon-{coordinator,worker,reviewer,prover}.md` (4) | filename — a rename is a new path |
| B | ZCode agent templates | `templates/docs/zcode/arggon/agents/arggon-{coordinator,worker,reviewer}.md` (3, no prover) | filename |
| C | ZCode hook gate | `templates/docs/zcode/arggon/hooks/gate.mjs:16,150` — `/(^\|:)arggon-reviewer$/` opens the dispatch-scoped read-only window | **string, and security-relevant**: rename the agent, miss the regex, and the reviewer backstop silently stops firing. The sharpest coupling in the migration |
| D | Init/doctor tests | `cli/src/{init,init-opencode,init-zcode,adapter-selection,doctor}.test.ts` (5) | string (generated paths + permission resources) |
| E | Evidence harnesses | `smoke/opencode-smoke.ts`, `smoke/opencode-wave.ts` (2) | string — they dispatch agents by name, so they are the rename's **proof** |
| F | Prose | 57 tracked markdown files | string |
| G | Generated seam copies | `.opencode/agents/*.md` (4), `.zcode-marketplace/arggon/agents/*.md` (3) | refreshed by `init` / `npm test`; never committed |

**Not affected:** the capability matrix (`adapters/capability-matrix.json` has zero
agent-id references — its rows are per *client*), the kernel, the envelopes, the
schema, the CLI flags, the commands, and the permission *semantics* (only the
resource names in the coordinator's allow-list change).

### The blocker, and the finding that dissolves most of it

`arggon init` never deletes (§Prerequisites: *"Selection never deletes… nothing on
disk is removed"*), so a naive rename leaves each adopter with a **dispatchable
orphan** per old agent file — OpenCode auto-discovers `.opencode/agents/*.md`, so
the dead coordinator would still be callable.

**The provenance needed to fix this already exists.** Every generated agent
destination is recorded in the tracker's `x-generated` block with its `template:`
path and `checksum` (`ArggonManager/.convention.yml:84–96, 170–183` — all 7
destinations). So an orphan is already *detectable with zero new data*: a
destination whose recorded template no longer exists in the installed package.
That makes the migration safe **if** the rename ships with reaping, and unsafe
without it — hence `task-adapter-orphan-reaping` is a hard predecessor, not a
nice-to-have.

Reaping rule (must preserve the never-overwrite promise):
`doctor` reports **`orphaned`** (a new status beside present / acknowledged /
adopter-edited / stale / missing / unverified) when an `x-generated` destination's
template is absent; `init` removes the file **only** when its checksum still matches
the recorded one (unmodified). An adopter-edited orphan is reported and **never
deleted** — same rule as an acked doc.

### Waves (file-disjoint; A+B are causally coupled so they ship as one PR)

| Wave | Contents | Depends on |
| --- | --- | --- |
| 1 | **Reaping capability + rename**: `cli/src` doctor/init/adapters, the 7 templates, the hook regex, the 5 tests | this spec (ADR 0017 gate) |
| 2 | **Harnesses**: `smoke/opencode-{smoke,wave}.ts` dispatch by the new names — the rename's execution proof | wave 1 |
| 3 | **Prose**: 57 docs files + `skills/arggon-cli/**` and `.agents/skills/arggon-cli/**` byte-equal | wave 1 |

Waves 2 and 3 are file-disjoint and may run in the same wave.

### Acceptance

- [x] Spec written with `arggon spec new` at `ArggonManager/docs/specs/` (next free number), status `proposed`
- [x] Every row of the surface inventory (A–G) is in the spec with its exact file list, so the rename cannot half-land
- [x] AC: the `/(^\|:)arggon-reviewer$/` gate regex and its two copies (template + generated) are renamed together — a test asserts the hook's reviewer matcher equals the shipped reviewer agent name, so this coupling can never drift again
- [x] AC: the coordinator prompt's subagent allow-list resources use the new names, and a test pins the allow-list to the four shipped ids
- [x] AC: `doctor` gains the `orphaned` status; `init` reaps an unmodified orphan and refuses an adopter-edited one, with the refusal reported (never silent)
- [x] AC: `doctor --agents` on an adopter tree that still holds the four old files reports 4 `orphaned` and **0** `missing` — the migration is observable before `init` acts
- [x] AC: idempotent — a second `init` finds nothing to reap; a re-applied rename introduces no new orphan
- [x] AC: no kernel rule, envelope, schema field, CLI flag or command changes; the capability matrix needs no row change
- [x] AC: the ADR 0021 §6.2a supersede is merged first or in the same PR — the record must not keep saying the rename is rejected
- [x] `arggon spec analyze` reports no NEW findings before this item is done

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
verdict: approve

Spec written at `ArggonManager/docs/specs/spec-agent-rename-019.md` (status
`proposed`; number 019 = next FREE after the 018 that merged as `e14dd75e`).

Gates, expected vs observed:
- `spec validate --file` → `ok (1 doc(s), 0 warning(s))`
- `spec analyze` → 10 findings across 21 specs, all pre-existing; **0 name this spec** — the ADR 0017 hard gate holds
- `prettier --check` → clean
- link probe → **dead links: none** (first pass had `../../../docs/explorations/…`, one level too deep from `docs/specs/` — same slip as spec-018, caught by the same probe, fixed and re-probed)
- `arggon validate` → `ok (0 warning(s), convention v5)`

What the spec settles, beyond restating the scope already on the item:
- **AC 2** binds `isReviewerDispatch`'s `/(^|:)arggon-reviewer$/` matcher to the
  shipped reviewer id **by reading the id out of the shipped template** — so a
  future rename that misses the hook fails CI instead of silently disarming the
  reviewer's read-only window. That is the one failure mode in this migration that
  is both silent and security-relevant.
- **AC 6** adds a rule the scope had not: a *downgrade* (destination newer than the
  installed templates) must report, never delete — otherwise an adopter who pins an
  older arggon loses four agent files to a version that predates them.
- **AC 8** is an end-to-end migration test on a fixture: generate a seam, remove a
  template, assert `orphaned` for the old destinations and `missing` for none, reap
  the unmodified ones, and prove a second `init` is a no-op.
- The **worked example** required to close exploration-018's deferred spike is an
  explicit acceptance clause, scoped to the agent half; the branch/PR model for
  non-code repos is named out of scope with the reason.

The checklist above is complete; the item flips `done` on merge.
