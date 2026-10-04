---
type: task
status: todo
id: task-adapter-orphan-reaping
title: "Reap orphaned generated adapter files: `doctor` reports `orphaned` when an x-generated destination's template is gone; `init` removes it only when unmodified"
parent: role-model-foundation
labels: [cli, adapters, safety]
priority: p1
created: "2026-10-04"
updated: "2026-10-04"
depends_on: [task-spec-agent-rename-migration]
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

- [ ] `doctor --agents` gains a **`orphaned`** status beside `present` / `acknowledged` / `acknowledged-drifted` / `adopter-edited` / `stale` / `missing` / `unverified`: an `x-generated` destination whose recorded `template` is absent from this arggon version
- [ ] Each status still names what `init` would do (the existing contract), and `orphaned` names the remedy: `init` removes it, or the adopter deletes it by hand
- [ ] `init` removes an orphan **only when its checksum still matches the recorded one** (unmodified since generation)
- [ ] An **adopter-edited** orphan is reported and **never** deleted — the never-overwrite promise (`docs/agents.md` §Prerequisites) applies to reaping exactly as it does to refresh
- [ ] Report-only is never enough to hide an action: a reaped orphan appears in the `--json` envelope (`reaped[]`/its own action family) and in human output; a refused one names the path and why
- [ ] Idempotent: a second `init` reaps nothing and reports nothing outstanding
- [ ] Dry-run (`init --dry-run`) previews the reaping without touching the tree
- [ ] A test drives the real scenario: generate a seam, remove one template from the package, assert `doctor` says `orphaned` and `init` reaps the unmodified file but refuses the edited one
- [ ] Never reaps a file outside the tracker-root repo, never reaps a path not recorded in `x-generated`, and never reaps anything whose destination is unknown to provenance
- [ ] Kernel/report surfaces documented in the same PR (`docs/json-output.md`, `README.md` doctor section)
- [ ] No schema change, no CLI flag removed; a flag is **added** only if the spec asks for an opt-out
- [ ] `arggon validate` + `npm test` + `npx vitest run cli/src/doctor.test.ts cli/src/init.test.ts` green
