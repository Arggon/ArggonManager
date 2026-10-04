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
- [x] A test drives the real scenario: generate a seam, remove one template from the package, assert `doctor` says `orphaned` and `init` reaps the unmodified file but refuses the edited one
- [x] Never reaps a file outside the tracker-root repo, never reaps a path not recorded in `x-generated`, and never reaps anything whose destination is unknown to provenance
- [~] Kernel/report surfaces documented in the same PR (`docs/json-output.md`, `README.md` doctor section) — `docs/json-output.md` done (init `reaped[]`/`reapRefused[]`, the `adapters`/`agents` blocks, the `plan[]` decision vocabulary, both samples); **the `README.md` doctor section is NOT in this PR** (a parallel worker owns `README.md`; reported, not filed)
- [x] No schema change, no CLI flag removed; a flag is **added** only if the spec asks for an opt-out — no flag added (the spec asks for none); the additive test injection points `templatesDir`/`templatesRoot` are internal options, never CLI surface
- [x] `arggon validate` + `npm test` + `npx vitest run cli/src/doctor.test.ts cli/src/init.test.ts` green
