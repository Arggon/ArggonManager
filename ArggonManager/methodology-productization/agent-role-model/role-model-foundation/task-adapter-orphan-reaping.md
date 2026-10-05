---
type: task
status: done
id: task-adapter-orphan-reaping
title: "Reap orphaned generated adapter files: `doctor` reports `orphaned` when an x-generated destination's template is gone; `init` removes it only when unmodified"
assignee: arggon-coordinator
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

### 2026-10-04 @ses_ef703fae0ffeWMIXzKu8aOors8
## Review round 3 — the acknowledged case is now opt-in behind `x-tracker.reap-acked-orphans`

PR #640 @ `34b92ebc` (branch merged with `origin/main`, no force-push). **CI: `cli` / `tasks-validate` / `ui-smoke` green on the first run** — no `child-boot-failed` rerun needed this time. Item left `in_progress`, nothing merged, templates untouched.

### Why refuse-with-flag, and not the two options you and I first considered

All three of us converged on the same fact from different directions: `adopt --ack` re-records the recorded checksum **from disk** (`adopt.ts:733`), so for an acknowledged entry a match proves only *unchanged since the ack* — never *arggon wrote exactly these bytes* — and nothing recorded can separate "unedited" from "curated then acked" (the generated marker survives hand edits too). That single limit decides the policy:

- **Reap by default** (round 2, your first instruction): deletes an adopter's curated agent file. Data loss in the one place the repo cares most — never-overwrite. Rejected.
- **Refuse always** (my round-2 "safe reading"): never loses content, but it also never clears the dead agent for exactly the repos that adopted properly — and `.opencode/agents/*.md` is auto-discovered, so the file stays **dispatchable**. That defeats ADR 0021 §6.2a′, which gates the rename on reaping. Rejected as a migration blocker, not as unsafe.
- **Refuse by default, arm to widen** (what shipped): the unknowable case is the operator's explicit choice; the default cannot lose content, and arming still unblocks the migration. Same shape as `x-tracker.allow-steal` — default refused, arming explicit — which is the precedent you named.

| case | action |
| --- | --- |
| unacknowledged + bytes match the baseline | **reap automatically** — unambiguously our fossil |
| acknowledged + bytes match, **unarmed** | **report only, never deleted**; the reason names the flag *and* the manual alternative |
| acknowledged + bytes match, **armed** | **reap**, and the reason still names `(acknowledged baseline, adopt --ack)` so the record shows a sanctioned file removed deliberately |
| bytes **differ**, either flavour | **refuse, always** — a known edit, not an unknowable one |

### What changed

- **kernel** (`lib/src/convention.ts`): `TrackerConfig.reapAckedOrphans` + the parser branch, rejecting a non-boolean by name like every other `x-tracker` option; unknown nested keys stay ignored.
- **classifier** (`cli/src/docs.ts`): the flag threads through the one decision path, read **once per plan** from the tree so `init` and `doctor` cannot disagree; an unreadable config resolves to UNARMED — the parser is the loud layer (`arggon validate` names the key), that read is the floor behind it. The policy comment now carries the full reasoning, so the next reader cannot "fix" it on the false premise.
- **reasons**: unarmed refusal → "NOT deleted by default … Delete it by hand, or set `x-tracker.reap-acked-orphans: true`"; armed reap → names the baseline *and* the arming; edited → "refused; your edits are never deleted, **whatever the reaping flag says**". No message claims a blanket "never deletes" while arming a path that does, or vice versa.
- **docs**: `docs/agents.md` (policy in DELETES/REFUSES form + the limitation, "read this before fixing it"), `docs/convention.md` §Tracker hygiene (official-options list, representative YAML, its own meaning bullet, parse-error sentence), `docs/json-output.md` (both the reaping-family bullet and the `reapRefused` row), `README.md` (init re-run bullet + the `doctor --agents` verdict line). All five state the checksum limitation plainly.
- **bundle**: `lib/src/convention.ts` is inlined into the committed plugin, so the regenerated `opencode/plugins/arggon/index.bundle.ts` is committed — `check:plugin` gates those bytes.

### Tests that prove all three rows (29 in the file now)

- `does NOT delete an UNARMED acknowledged orphan, and says why + how to arm` — asserts the file survives, the refusal names `NOT deleted by default`, the flag and `Delete it by hand`, and the provenance survives so arming later reaps exactly that file.
- `REAPS an armed acknowledged orphan whose bytes are unchanged (the migration case)` — reason names the ack **and** `reap-acked-orphans: true`.
- `reads the arming from the tree ONCE — doctor and init cannot disagree` — the same orphan flips `refuse`→`reap` in `doctor --agents` when the flag lands.
- `refuses an acknowledged orphan whose bytes changed after the ack, ARMED OR NOT` — looped over both states, and asserts the reason does **not** even mention the flag.
- `REFUSES an unacknowledged orphan whose bytes changed since generation` — the unacked flavour of the same branch.
- `a malformed arming value is reported by validate and deletes nothing` — **verified, not assumed**: I expected init to fail loudly on a malformed value; it does not. `arggon validate` is the loud layer (exit 1, names the key), while init's own state read degrades to an empty set on an unparseable convention file — pre-existing, and the safe direction (nothing is deleted). The test pins the pair.
- Plus the flag's parse contract in `cli/src/acceptance-convention.test.ts`: absent → `null`, `true`/`false` read, non-boolean → parse error naming the key, unknown nested key ignored.

### Gates (re-run after the last edit, then again after the `origin/main` merge)
| gate | expected | observed |
| --- | --- | --- |
| `npm run build` | clean | ok — 42 modules, 464796 bytes (bundle grew: the kernel option is inlined) |
| `npm run arggon -- validate` | ok, 0 warnings | `arggon validate: ok (0 warning(s), convention v5)` (also post-merge) |
| `npm run arggon -- spec validate` | ok | `ok (34 doc(s), 5 warning(s))` — 5 pre-existing DOC_NUMBER_COLLISION |
| `npm run arggon -- spec analyze` | no NEW findings | `10 finding(s) across 21 spec(s)` — unchanged from baseline |
| `npx prettier --check` on all 10 touched files | clean | `All matched files use Prettier code style!` |
| `npm test` | green | `Test Files 128 passed (128) · Tests 2657 passed (2657)` |
| `npm run check:plugin` | no bundle drift | exit 0 **after committing the regenerated bundle** (it legitimately changed — I caught this rather than reporting a false green) |
| `npm run smoke:native-start-cold` | pass | `smoke:native-start-cold passed` |

### One adjacent observation, not acted on

`init --force` re-scaffolds `.convention.yml` from a fixed template string, which drops the **whole** `x-tracker` block — so a forced re-scaffold would silently disarm this flag (and `allow-steal`, and `strict-*`). Pre-existing, affects every `x-tracker` key, and it errs in the safe direction here (reaping stops, nothing is deleted). Reporting rather than fixing it: widening `init --force` to preserve the block is its own item and your call.

### handoff 2026-10-04 @ses_ef703fae0ffeWMIXzKu8aOors8 (session: ses_ef703fae0ffeWMIXzKu8aOors8) — next: Review PR #640 round 3 (CI green first run, all 8 gates green); merge do-not-squash, then flip the item to done.
- branch: feat/task-adapter-orphan-reaping
- open questions: Adjacent, unowned: init --force drops the whole x-tracker block (disarms this flag, allow-steal, strict-*); safe direction, worth its own item. Also: no CLI setter exists for reap-acked-orphans (conv…

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
verdict: approve (coordinator, 2026-10-04) — PR #640 merged `fe6f0063`

The policy went through two corrections and the final shape is the one I would defend:

| case | action |
| --- | --- |
| unacknowledged + bytes match | **reap automatically** — unambiguously our fossil |
| acknowledged + bytes match, **unarmed** (default) | **report only, never deleted** — names the flag *and* the manual route |
| acknowledged + bytes match, armed | reap, reason still names the ack |
| bytes differ, either flavour | **refuse, always** — "whatever the reaping flag says" |

**The correction that mattered.** My first instruction was "byte-identical ⇒ reap, acked
or not". The worker found that `runAdoptAck` (`cli/src/adopt.ts:730-733`) **re-baselines the
checksum from disk**, so "matches" means *unchanged since the ack* — not *arggon wrote these
bytes*. A file an adopter curated and then acked is indistinguishable from an untouched one,
so my rule would have deleted their work. The default is now refuse-with-flag
(`x-tracker.reap-acked-orphans`, the `allow-steal` shape), because the unknowable case must be
the operator's explicit choice and the default must be the one that cannot lose work.

This is also what makes the rename migration actually work: adopted repos can clear the dead
agents by arming one flag, instead of the file staying dispatchable forever or a chore landing
on exactly the adopters who did adoption properly.

The refusal reason states the provenance limitation in the message itself, so the next agent
reads why rather than re-adding a veto on a false premise — and it carries **both** routes out
(delete by hand, or arm the flag), so nobody is left hunting for the switch.

Verified by me on the branch before merge: the flag defaults to `null`/unarmed
(`lib/src/convention.ts:347`), the acked+unarmed branch refuses at `cli/src/docs.ts:1073`,
zero remaining "never deletes them" overclaims in the code, the limitation is stated in
`docs/agents.md`, and all three CI lanes were green. `arggon validate` ok after merge.
