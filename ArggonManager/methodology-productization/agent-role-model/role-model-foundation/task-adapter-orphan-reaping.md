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

### 2026-10-04 @ses_ef703fae0ffeWMIXzKu8aOors8
## PR #640 — verdict: approve (gates re-run on the branch, expected vs observed)

Branch `feat/task-adapter-orphan-reaping` @ `7f019125`, PR https://github.com/Arggon/ArggonManager/pull/640 (**merge, do not squash**). ADR 0016 impact class: **Behavioral** (adopter-facing behavior + one new `doctor --agents` status).

### Problem → approach
`arggon init` never deletes, so a template that leaves a release strands its destination — and under `.opencode/agents/*.md` a stranded file stays **dispatchable**, which is what made the rename unsafe (ADR 0021 §6.2a′). The provenance already ships, so an orphan is detectable with **zero new data**: a recorded `template:` absent from this version's template set.

One classifier, `planOrphanReaps` (`cli/src/docs.ts`), returns `action` + `reason` **together** (a refusal can never be reported with the words of a reap); `init` acts on it and `doctor --agents` reports it. `init` reaps only when every rule holds — inside the repo root · a regular file (`lstat`; never a directory, never a symlink) · recorded by no NEWER arggon (a downgrade reports) · not acknowledged · byte-identical to the recorded checksum. Reaping is its own action family (`reaped[]`/`reapRefused[]`, never folded into the write counts nor `adapters.counts`), one human line per file, `--dry-run` previews it writing nothing, and the reaped destination loses its `x-generated` entry in the same run (idempotence + a self-consistent commit).

### Gates (all re-run in the worktree after the last edit)
| gate | expected | observed |
| --- | --- | --- |
| `npm run build` | clean, bundle byte-stable | ok — `build:plugin` 42 modules, 464371 bytes, no diff |
| `npm run arggon -- validate` | `ok (0 warning(s))` | `arggon validate: ok (0 warning(s), convention v5)` |
| `npm run arggon -- spec validate` | ok | `ok (34 doc(s), 5 warning(s))` — 5 pre-existing DOC_NUMBER_COLLISION warnings, none from this PR |
| `npm run arggon -- spec analyze` | no NEW findings | `10 finding(s) across 21 spec(s)`, identical to the pre-change baseline; none name spec-agent-rename-019 |
| `npx prettier --check` on every touched file (2 docs + 6 `cli/src`) | clean | `All matched files use Prettier code style!` |
| `npm test` | green | `Test Files 128 passed (128) · Tests 2649 passed (2649)` (24 new) |
| `npm run check:plugin` | no bundle drift | exit 0, `git diff --exit-code` clean |
| `npm run smoke:native-start-cold` | pass | `smoke:native-start-cold passed` |

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

### 2026-10-04 @ses_ef703fae0ffeWMIXzKu8aOors8
### AC 8 judgment — accepted, on the record (lead architect, 2026-10-04)

Spec AC 8 says the end-to-end test must report `orphaned` for "the four old destinations" and create "the new ids". Both clauses describe the **rename**, which is a later item; this item is only its precondition, so neither the four old ids nor the new ids exist to be asserted here. The test therefore drives the same assertions at seam scale — a generated OpenCode seam, two agent templates removed from a copy of the installed package: `doctor --agents` reports `2 orphaned` and `0 missing`, `init` reaps the untouched one and refuses the edited one, and a second `init` is a no-op. Hardcoding "four old destinations" would have duplicated rename logic inside a reaping test and asserted a state this PR does not create.

The checklist row now carries this reasoning inline. A second, complementary test covers the rename's own shape without the rename: the **real spawned CLI** on a tree whose `x-generated` records a template the install never shipped (exactly what a rename leaves behind) — reaped, reported in `reaped[]`, one human line, and idempotent on the next run.

### 2026-10-04 @ses_ef703fae0ffeWMIXzKu8aOors8
## Review round 2 — the acknowledged veto is gone; README in; AC 8 on the record

PR #640 @ `16f46991` (branch merged with `origin/main`, no force-push anywhere). **CI: `cli` / `tasks-validate` / `ui-smoke` all green.** Item left `in_progress`, nothing merged.

### 1. The acknowledged-baseline veto — removed, and the migration is unblocked

Your verification holds and I re-checked it myself: `runAdoptAck` (`cli/src/adopt.ts:730`) iterates `Object.keys(prevState)` — **every** `x-generated` entry — and `.opencode/agents/*.md` are entries (`ArggonManager/.convention.yml:84–96`). A repo that adopted properly therefore carries `acknowledged: true` on its agent files, and the veto I shipped would have stranded the dead agent in exactly those repos while `.opencode/agents/` stays auto-discovered. Implemented as instructed.

**What I found while implementing, and what it changed in the code (you should see this):** `runAdoptAck` also **re-baselines** the recorded checksum — `const checksum = checksumOf(readFileSync(abs, "utf8"))` (`adopt.ts:733`) — for every entry it touches. So for an acknowledged entry, "matches the recorded checksum" means **unchanged since the ack**, *not* "arggon wrote these exact bytes". A file that was curated and *then* acked matches too, and is reaped. Nothing in the recorded state separates the two cases (the marker survives edits too). Your rule is therefore implemented as specified — reaped when byte-identical, refused when the bytes differ — and the limit is now stated in three places instead of being left for someone to re-derive wrongly: the `classifyOrphan` policy comment (`cli/src/docs.ts`), the reap reason string, and `docs/agents.md` §Orphaned destinations ("read this before 'fixing' it"). I kept the ack **loud rather than silent**: a reaped acknowledged orphan's reason names `(acknowledged baseline, adopt --ack)`, so `doctor --agents` shows the removal coming before `init` acts. If you want a hard stop there instead, it is one line — but it re-blocks adopted trees, so it is your call, not mine to take quietly.

Removed from the classifier: the `entry.acknowledged` veto and its reason string. Every message that claimed "init never deletes them" for the acked case is gone — `docs/agents.md`, `docs/json-output.md` (both reason enumerations) and the JSON doc row now say what reaping deletes vs refuses. No stale claim survives; I grepped for it.

### 2. Tests that prove both branches

- `REAPS an acknowledged orphan whose bytes are unchanged — the adoption migration case` — acks exactly as `runAdoptAck` does, **re-baseline included** (the `ackEntry` helper re-records the checksum from disk, so the fixture is faithful, not a hand-set flag), drops the template, asserts `action: "reap"`, asserts the reason names the ack, then runs `init` and asserts the file is gone and `reapRefused` is empty.
- `REFUSES an acknowledged orphan whose bytes changed after the ack` — one appended line; `action: "refuse"`, reason names `adopter-edited`, `init` keeps the file.
- `REFUSES an unacknowledged orphan whose bytes changed since generation` — the edit branch on the unacked flavor, so "bytes differ ⇒ refused" is proven on **both** entries.
- Plus a doctor-side assertion that an acknowledged reap carries `reap.action: "reap"` and its ack-naming reason. The file is now 26 tests (was 24).

### 3. `README.md` — in, per the §Documentation maintenance mapping

`README.md` now carries: the orphan rule in the init re-run semantics (the four DELETES conditions, what is REFUSED, and why `acknowledged` is not a refusal); `orphaned` + its per-file `reap.action` verdict in the `doctor --agents` status list; a **refreshed real** `doctor --agents` sample (the old one predated the acknowledged buckets) plus a **real** orphan/refusal sample, both pasted from actual runs of this branch's CLI; and the `plan[].decision` enumeration corrected — `stale` no longer exists there, it is now `orphan-reap` | `orphan-refused`. Length kept in line with the surrounding prose: one bullet plus two fenced blocks.

### 4. AC 8 — recorded and ticked with the reason

Ticked inline on the checklist row and posted as its own comment: spec AC 8's "four old destinations" and "creates the new ids" both describe the rename, which is a later item, so the end-to-end test drives the same assertions at seam scale (two dropped templates, one reapable one refused, `0 missing`, second `init` a no-op). The rename's own shape is covered separately by the real-CLI provenance test (a recorded template the install never shipped) — no rename logic is duplicated.

### Gates (re-run in the worktree after the last edit)
| gate | expected | observed |
| --- | --- | --- |
| `npm run build` | clean, bundle byte-stable | ok — 42 modules, 464371 bytes, no diff |
| `npm run arggon -- validate` | ok, 0 warnings | `arggon validate: ok (0 warning(s), convention v5)` (also after the `origin/main` merge) |
| `npm run arggon -- spec validate` | ok | `ok (34 doc(s), 5 warning(s))` — 5 pre-existing DOC_NUMBER_COLLISION |
| `npm run arggon -- spec analyze` | no NEW findings | `10 finding(s) across 21 spec(s)` — unchanged from baseline |
| `npx prettier --check` on all 10 touched files (README + 2 docs + item + 6 `cli/src`) | clean | `All matched files use Prettier code style!` |
| `npm test` | green | `Test Files 128 passed (128) · Tests 2651 passed (2651)` |
| `npm run check:plugin` | no bundle drift | exit 0, `git diff --exit-code` clean |
| `npm run smoke:native-start-cold` | pass | `smoke:native-start-cold passed` |

### CI: the first `cli` run was red — and it was not this PR

`cli` failed once with `SpawnHarnessError … kind: child-boot-failed` and `SyntaxError: The requested module './sync-command.js' does not provide an export named 'runSync'`, plus the harness's own `kernel artifact drift: lib/dist … REWRITTEN while this child ran`. That is the **already-filed open flake `bug-test-suite-lib-dist-rebuild-race`** (p1, todo), diagnosed from PR #638 — a markdown-only diff — with the same mechanism and a different half-written module. Re-running the failed lane: `cli` **pass** (4m45s); all three lanes green. Evidence it is not mine: the failure is in `lib/dist` (I touched only `cli/src`), the source exports the symbol (`lib/src/sync-command.ts`), and the same lane passed on my first push of this branch. Honest exposure note: my new suite adds **5 spawned-CLI calls** to `cli/src/adapter-orphan-reaping.test.ts`, which cannot cause the race but marginally widens the reader side of it — the fix belongs to the filed bug (isolation, not retry), not to this PR.

### One process correction

While capturing the README samples I ran `npm --prefix <worktree> run arggon -- init --agents opencode .`, and npm resolves the script's cwd to the *prefix* — so `init .` ran against **my own worktree** and auto-committed (`chore(tasks): generated init docs (16 files)`, timestamp-only plus one vendored-plugin checksum line). It was never pushed; I `git reset --mixed` to `7f019125`, discarded the convention-file churn (`git status` clean, branch identical to what CI already validated), and re-took the samples from an explicit target dir. Flagging it because the diff was benign this time by luck of byte-identical re-rendering, not by design — the working tree, not just a temp dir, was the thing at risk.

### handoff 2026-10-04 @ses_ef703fae0ffeWMIXzKu8aOors8 (session: ses_ef703fae0ffeWMIXzKu8aOors8) — next: Review PR #640 round 2 (CI green, all 8 gates green); merge do-not-squash, then flip the item to done. The rename item can then claim.
- branch: feat/task-adapter-orphan-reaping
- open questions: Acked orphans are now REAPED (per your call); ack re-baselines the checksum so curated-then-acked is indistinguishable - made loud in doctor/init instead. Open: whether that deserves a hard stop or a…
