---
type: task
status: in_progress
id: task-adapter-orphan-reaping
title: "Reap orphaned generated adapter files: `doctor` reports `orphaned` when an x-generated destination's template is gone; `init` removes it only when unmodified"
assignee: arggon-coordinator
branch: feat/task-adapter-orphan-reaping
parent: role-model-foundation
labels: [cli, adapters, safety]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
claimed_at: "2026-10-04T22:14:18.299Z"
depends_on: [task-spec-agent-rename-migration]
worktree_path: /home/arggon/Projects/ArggonManager-task-adapter-orphan-reaping
---

<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/task-adapter-orphan-reaping.md
  Leaves live only under a story. id is the filename stem: task-adapter-orphan-reaping.
  CLI `arggon create task adapter-orphan-reaping` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Reap orphaned generated adapter files: `doctor` reports `orphaned` when an x-generated destination's template is gone; `init` removes it only when unmodified

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

Hard predecessor for the agent rename (`task-spec-agent-rename-migration`).
`arggon init` never deletes, so renaming the shipped agents strands a
**dispatchable orphan** per old file in every adopting tree — OpenCode
auto-discovers `.opencode/agents/*.md`, so the dead coordinator stays callable.

**The provenance this needs already exists.** Every generated agent destination is
in the tracker's `x-generated` block with its `template:` path and `checksum`
(`ArggonManager/.convention.yml:84–96` for the four OpenCode agents, `:170–183`
for the three ZCode ones). An orphan is therefore detectable with **zero new data**:
a destination whose recorded template no longer exists in the installed package.
This item is also worth shipping on its own — the same leak applies to any
destination that disappears from a future template set.

## Acceptance

- [x] `doctor --agents` gains a **`orphaned`** status beside `present` / `acknowledged` / `acknowledged-drifted` / `adopter-edited` / `stale` / `missing` / `unverified`: an `x-generated` destination whose recorded `template` is absent from this arggon version
- [x] Each status still names what `init` would do (the existing contract), and `orphaned` names the remedy: `init` removes it, or the adopter deletes it by hand
- [x] `init` removes an orphan **only when its checksum still matches the recorded one** (unmodified since generation)
- [x] An **adopter-edited** orphan is reported and **never** deleted — the never-overwrite promise (`docs/agents.md` §Prerequisites) applies to reaping exactly as it does to refresh
- [x] Report-only is never enough to hide an action: a reaped orphan appears in the `--json` envelope (`reaped[]`/its own action family) and in human output; a refused one names the path and why
- [x] Idempotent: a second `init` reaps nothing and reports nothing outstanding
- [x] Dry-run (`init --dry-run`) previews the reaping without touching the tree
- [x] A test drives the real scenario: generate a seam, remove one template from the package, assert `doctor` says `orphaned` and `init` reaps the unmodified file but refuses the edited one — **AC 8 judgment (accepted by the lead architect, 2026-10-04):** spec AC 8 says "the four old destinations", which presumes the agent rename itself. This item is the _precondition_, and the rename is a later item, so the end-to-end test drives the same assertions at seam scale (a generated OpenCode seam, two agent templates removed from a copy of the installed package: `doctor --agents` reports `2 orphaned` and `0 missing`; `init` reaps the untouched one and refuses the edited one; a second `init` is a no-op). Hardcoding "four old destinations" would have duplicated rename logic inside a reaping test and asserted a state this PR does not create.
- [x] Never reaps a file outside the tracker-root repo, never reaps a path not recorded in `x-generated`, and never reaps anything whose destination is unknown to provenance
- [x] Kernel/report surfaces documented in the same PR (`docs/json-output.md`, `README.md` doctor section) — both, per the doc mapping in `docs/agents.md` §Documentation maintenance: `docs/json-output.md` (init `reaped[]`/`reapRefused[]`, the `adapters`/`agents` blocks, the `plan[]` decision vocabulary, both samples) and `README.md` (the `orphaned` status + per-file verdict in the `doctor --agents` list, the orphan rule in the init re-run semantics, the refreshed `doctor --agents` sample plus a real orphan/refusal sample, and the corrected `plan[]` `decision` enumeration — `stale` no longer exists there)
- [x] No schema change, no CLI flag removed; a flag is **added** only if the spec asks for an opt-out — no flag added (the spec asks for none); the additive test injection points `templatesDir`/`templatesRoot` are internal options, never CLI surface
- [x] `arggon validate` + `npm test` + `npx vitest run cli/src/doctor.test.ts cli/src/init.test.ts` green
