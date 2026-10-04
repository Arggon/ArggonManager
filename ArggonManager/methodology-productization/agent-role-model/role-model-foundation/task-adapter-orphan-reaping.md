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

- [x] `doctor --agents` gains a **`orphaned`** status beside `present` / `acknowledged` / `acknowledged-drifted` / `adopter-edited` / `stale` / `missing` / `unverified`: an `x-generated` destination whose recorded `template` is absent from this arggon version
- [x] Each status still names what `init` would do (the existing contract), and `orphaned` names the remedy: `init` removes it, or the adopter deletes it by hand
- [x] `init` removes an orphan **only when its checksum still matches the recorded one** (unmodified since generation)
- [x] An **adopter-edited** orphan is reported and **never** deleted — the never-overwrite promise (`docs/agents.md` §Prerequisites) applies to reaping exactly as it does to refresh
- [x] An **acknowledged** orphan is refused by default and reaped only when the repo arms **`x-tracker.reap-acked-orphans: true`** (the `x-tracker.allow-steal` shape: default refused, arming explicit, non-boolean is a parse error). Reason: `adopt --ack` acks every entry _and_ re-baselines its checksum from disk, so a match proves only "unchanged since the ack" — provenance cannot separate "unedited" from "curated then acked". Bytes that DIFFER are refused regardless of arming. Documented in `docs/convention.md` §Tracker hygiene, `docs/agents.md` and `README.md`
- [x] Report-only is never enough to hide an action: a reaped orphan appears in the `--json` envelope (`reaped[]`/its own action family) and in human output; a refused one names the path and why
- [x] Idempotent: a second `init` reaps nothing and reports nothing outstanding
- [x] Dry-run (`init --dry-run`) previews the reaping without touching the tree
- [x] A test drives the real scenario: generate a seam, remove one template from the package, assert `doctor` says `orphaned` and `init` reaps the unmodified file but refuses the edited one — **AC 8 judgment (accepted by the lead architect, 2026-10-04):** spec AC 8 says "the four old destinations", which presumes the agent rename itself. This item is the _precondition_, and the rename is a later item, so the end-to-end test drives the same assertions at seam scale (a generated OpenCode seam, two agent templates removed from a copy of the installed package: `doctor --agents` reports `2 orphaned` and `0 missing`; `init` reaps the untouched one and refuses the edited one; a second `init` is a no-op). Hardcoding "four old destinations" would have duplicated rename logic inside a reaping test and asserted a state this PR does not create.
- [x] Never reaps a file outside the tracker-root repo, never reaps a path not recorded in `x-generated`, and never reaps anything whose destination is unknown to provenance
- [x] Kernel/report surfaces documented in the same PR (`docs/json-output.md`, `README.md` doctor section) — both, per the doc mapping in `docs/agents.md` §Documentation maintenance: `docs/json-output.md` (init `reaped[]`/`reapRefused[]`, the `adapters`/`agents` blocks, the `plan[]` decision vocabulary, both samples) and `README.md` (the `orphaned` status + per-file verdict in the `doctor --agents` list, the orphan rule in the init re-run semantics, the refreshed `doctor --agents` sample plus a real orphan/refusal sample, and the corrected `plan[]` `decision` enumeration — `stale` no longer exists there)
- [x] No schema change, no CLI flag removed; a flag is **added** only if the spec asks for an opt-out — no flag added (the spec asks for none); the additive test injection points `templatesDir`/`templatesRoot` are internal options, never CLI surface
- [x] `arggon validate` + `npm test` + `npx vitest run cli/src/doctor.test.ts cli/src/init.test.ts` green

### 2026-10-04 @ses_ef703fae0ffeWMIXzKu8aOors8

## PR #640 — verdict: approve (gates re-run on the branch, expected vs observed)

Branch `feat/task-adapter-orphan-reaping` @ `7f019125`, PR https://github.com/Arggon/ArggonManager/pull/640 (**merge, do not squash**). ADR 0016 impact class: **Behavioral** (adopter-facing behavior + one new `doctor --agents` status).

### Problem → approach

`arggon init` never deletes, so a template that leaves a release strands its destination — and under `.opencode/agents/*.md` a stranded file stays **dispatchable**, which is what made the rename unsafe (ADR 0021 §6.2a′). The provenance already ships, so an orphan is detectable with **zero new data**: a recorded `template:` absent from this version's template set.

One classifier, `planOrphanReaps` (`cli/src/docs.ts`), returns `action` + `reason` **together** (a refusal can never be reported with the words of a reap); `init` acts on it and `doctor --agents` reports it. `init` reaps only when every rule holds — inside the repo root · a regular file (`lstat`; never a directory, never a symlink) · recorded by no NEWER arggon (a downgrade reports) · not acknowledged · byte-identical to the recorded checksum. Reaping is its own action family (`reaped[]`/`reapRefused[]`, never folded into the write counts nor `adapters.counts`), one human line per file, `--dry-run` previews it writing nothing, and the reaped destination loses its `x-generated` entry in the same run (idempotence + a self-consistent commit).

### Gates (all re-run in the worktree after the last edit)

| gate                                                                | expected                  | observed                                                                                                 |
| ------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run build`                                                     | clean, bundle byte-stable | ok — `build:plugin` 42 modules, 464371 bytes, no diff                                                    |
| `npm run arggon -- validate`                                        | `ok (0 warning(s))`       | `arggon validate: ok (0 warning(s), convention v5)`                                                      |
| `npm run arggon -- spec validate`                                   | ok                        | `ok (34 doc(s), 5 warning(s))` — 5 pre-existing DOC_NUMBER_COLLISION warnings, none from this PR         |
| `npm run arggon -- spec analyze`                                    | no NEW findings           | `10 finding(s) across 21 spec(s)`, identical to the pre-change baseline; none name spec-agent-rename-019 |
| `npx prettier --check` on every touched file (2 docs + 6 `cli/src`) | clean                     | `All matched files use Prettier code style!`                                                             |
| `npm test`                                                          | green                     | `Test Files 128 passed (128) · Tests 2649 passed (2649)` (24 new)                                        |
| `npm run check:plugin`                                              | no bundle drift           | exit 0, `git diff --exit-code` clean                                                                     |
| `npm run smoke:native-start-cold`                                   | pass                      | `smoke:native-start-cold passed`                                                                         |

Two pre-existing drift points were updated, both intentional: the `counts` status-key list and the per-agent human-block inline snapshot in `cli/src/adapter-selection.test.ts` (both gained `orphaned`).

### Evidence a reviewer should look at

- `cli/src/docs.ts` `classifyOrphan` / `planOrphanReaps` — the five vetoes, each with its own reason string.
- `cli/src/adapter-orphan-reaping.test.ts` — one test per veto (outside-root, directory, symlink, downgrade, acknowledged, edited, not-on-disk, unrecorded file), the doctor status + per-file verdict, the dry-run preview, idempotence, the AC 8 end-to-end fixture, and two real-spawned-CLI tests.
- `applyDocsPlan` — `rmSync` without `recursive`, so a destination that became a directory between plan and apply fails loudly instead of being removed recursively.
- Reaped paths ride `commitGeneratedDocs` so a committed tree never keeps provenance for a file that is gone.

### Deviations / findings for the coordinator (not filed)

1. **README.md doctor section NOT updated** — deliberately out of my file scope (parallel worker owns it). The item checklist row is marked `[~]` with the reason. `docs/json-output.md` and `docs/agents.md` are updated, and `docs/agents.md`'s "Selection never deletes" is corrected to "selection never deletes; reaping is the one guarded exception".
2. **AC 8's literal "four old destinations"** presumes the rename (a later item); the test drives the same assertions at seam scale (two dropped templates, one reapable, one refused) rather than duplicating rename logic here.
3. **A judgment call worth a reviewer's eye:** an **acknowledged** orphan is REFUSED (reason: "acknowledged baseline — your sanctioned bytes"). `adopt --ack` acks every entry, so in a fully-adopted tree the rename's old files will be reported and kept rather than reaped; the operator deletes them by hand. The spec does not name the ack case explicitly; refusing is the never-overwrite-consistent reading, and it is the safe failure mode (no data loss, observable in `doctor --agents` and `reapRefused[]`). If the intent was to reap acked-but-unmodified orphans, that is a one-line change in `classifyOrphan` — but it would delete sanctioned content.
4. **`docs.stale` was deliberately left alone** (it IS the orphan condition for non-adapter destinations); adding a human hint off it was the minimal way to keep a plain-doc deletion observable without touching the `docs` envelope.

### handoff 2026-10-04 @ses_ef703fae0ffeWMIXzKu8aOors8 (session: ses_ef703fae0ffeWMIXzKu8aOors8) — next: Review PR #640 (merge, do not squash); on merge flip the item to done. The rename item may then claim: orphaned status + guarded reap are in place.

- branch: feat/task-adapter-orphan-reaping
- open questions: Acked orphans are refused, not reaped (safe reading; spec silent). README doctor section still needs orphaned - parallel worker owns README.md.
