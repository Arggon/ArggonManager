---
type: bug
status: in_progress
id: bug-engineering-doc-stale-adr-statuses
title: "`docs/engineering.md:230` and spec/plan 009 still describe ADRs 0003/0010 as `Proposed`; 0002/0003/0004 were Accepted in their files by c0cdd60b"
assignee: Arggon
branch: fix/bug-engineering-doc-stale-adr-statuses
parent: story-spec-pipeline
labels: [docs, adr]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T12:47:53.140Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-engineering-doc-stale-adr-statuses
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-engineering-doc-stale-adr-statuses.md
  Leaves live only under a story. id is the filename stem: bug-engineering-doc-stale-adr-statuses.
  CLI `arggon create bug engineering-doc-stale-adr-statuses` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/engineering.md:230` and spec/plan 009 still describe ADRs 0003/0010 as `Proposed`; 0002/0003/0004 were Accepted in their files by c0cdd60b

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Commit `c0cdd60b` accepted ADRs 0002/0003/0004 in their FILES but left other surfaces still describing them as `Proposed`:

- `ArggonManager/docs/engineering.md:230` calls ADR 0003 "Proposed" (stale since that commit)
- `ArggonManager/docs/specs/spec-opencode2-009.md:87` and `ArggonManager/docs/plans/plan-opencode2-009.md:24` call ADR 0010 `Proposed` — it is now "Partially superseded by 0011"

Reported (not fixed) by the worker on PR #602 (task-adr-readme-index-missing-adr-0020) while building the ADR index parity test. That PR corrected the index rows for 0002/0003/0004 — it owns the index, and its status-class rule cannot pass otherwise — but reported these rather than widening its diff.

The spec/plan case needs a judgment call, not a blind edit: a spec/plan is a dated record of what was believed at decision time, so it may be CORRECT as history. That is the coordinator's call, hence this item rather than a silent fix.

Acceptance:

- [x] `docs/engineering.md` no longer describes ADR 0003 as Proposed (it is Accepted); check its whole ADR-status reference list, not just line 230
- [ ] Decide the spec/plan 009 case explicitly: either the dated record is correct as history (record that decision where a reader sees it) or the statements are current-tense claims that must be updated — **NOT claimed by this PR: the item's own Context reserves this for the coordinator and the PR is scoped to `engineering.md`.** Facts for the call are in the worker comment below (ADR 0010 is "Partially superseded by 0011 (§2/§3) + layout superseded by 0012"; both statements sit inside dated decision records).
- [x] Sweep the docs tree for ADR status claims against the actual files — the index drift recurred at least three times (05b31fb6 fixed 0014-0017; c0cdd60b left 0002-0004; now this)
- [x] State in the ADR process section that an ADR status change must update every surface describing it, so the sweep is not manual next time

### 2026-10-03 @Arggon
### 2026-10-03 @Arggon
PR #618 · branch `fix/bug-engineering-doc-stale-adr-statuses` · commit 023745e9.

**Impact class: Advisory** (`ArggonManager/docs/agents.md` §Changing the methodology itself). No rule an agent must follow changes, and no gate, command contract or pipeline step is added — both named tests run inside the existing `npm test`. The correction removes a false statement rather than adding an instruction. `npm run skills:sync` synced 7 files with **no diff**, so nothing needed re-syncing and nothing was hand-copied; the PR is safe if the reviewer reads the new §ADR process sentence as a new authoring rule and calls it Behavioral. `docs/agents.md` is owned by another worker this wave and is NOT touched.

**Claim-by-claim — every ADR mention in `engineering.md` (10 refs), not the item's list.**

| Line | Reference | States a status? | Verdict |
|---|---|---|---|
| 3 | ADR 0020 methodology carrier | no | correct, no claim |
| 8 | ADR 0016 upgrade channel | no | correct, no claim |
| 14 | ADR 0001 stack, ADR 0002 board | no | correct, no claim |
| 33 | ADR 0013 lib package | no | correct, no claim |
| 56 | ADR 0002 board | no | correct, no claim |
| 89 | "ADR 0006 spirit" | no | correct, no claim |
| 97/140/141 | ADR 0008 review smoke gate | no | correct, no claim |
| 128 | "ADR 0016 reference when behavioral" | no | correct, no claim |
| **230** | **"milestone field (Proposed)": ADR 0003** | **yes** | **WRONG — file says `Accepted` (dated retroactive note). FIXED.** |

Only line 230 stated a status. The item's premise held, but the list needed proving: the other nine are descriptive/scoping and cannot go stale.

**The fix deletes the restatement instead of updating it.** A carrier that states an ADR's status must be re-edited on every acceptance, so it is eventually not — the mechanism behind this whole bug class (05b31fb6 → c0cdd60b → here). §Related now points at the ADR index as the register; §ADR process states the rule and names the two tests, so a future acceptance/supersession needs no doc edit outside the ADR file and its own index row.

**The check** — `cli/src/adr-status-doc-contract.test.ts`, shape of `adr-index-parity.test.ts` / the merged `mcp-doc-contract.test.ts`:
1. no ADR reference may carry a status, checked over the **label region** (prose before the link *plus* the link's own text) — the defect's shape puts the status *before* the link, so a link-text-only scan would pass vacuously over the exact sentence it exists to catch; the §ADR process lifecycle vocabulary carries no ADR reference so it does not fire;
2. every `./adr/NNNN` link resolves to a real file whose name carries that number (catches the 0015-style rename / a 0020-style renumber).

Status found by rule 1 is reported **with the ADR file's own status** in the message. `docs/adr/*.md` is the authority; nothing is compared to a value derived from the document under test.

**Premise guards matter more than usual here:** the carrier is clean after this fix, so rule 1's `problems` array is legitimately empty and a plain assertion on it proves nothing. Test 1 runs the scanner over synthetic text including the exact pre-fix sentence and asserts it finds `Proposed` on 0003 but not 0001/0008, ignores the lifecycle vocabulary, and does not treat `./adr/README.md` as an ADR. Plus: non-empty ADR directory where every file declares a `- Status:` line, and the carrier links at least one ADR so the rule cannot pass vacuously.

**Drift simulations** (each reverted; sha256 verified identical to the pre-simulation backup after):
- ADR 0003 relabelled `(Proposed)` → `labels ADR 0003 "Proposed" — docs/adr/0003-milestone-field.md says "Accepted"; carriers link to an ADR, they do not restate its status`
- ADR 0008 relabelled `(superseded by ADR 0011)` → caught, message carries 0008's real Accepted status + its date note
- `(Proposed)` moved **inside** the link text → still caught (label region is load-bearing)
- ADR 0020 link renumbered to 0021 → `links ./adr/0021-methodology-first-productization.md, which does not exist`
- clean tree → 4/4 pass

**Acceptance box 2 deliberately NOT ticked** — the item's own Context reserves the spec/plan judgment for the coordinator and this PR is scoped to one file. Facts for the call: ADR 0010's real status is "Partially superseded by [ADR 0011] (§2/§3 and its packaging deferrals); layout superseded by [ADR 0012]"; both stale statements (`specs/spec-opencode2-009.md:87`, `plans/plan-opencode2-009.md:24`) sit inside dated decision records, the spec one as an unchecked `- [ ]` W0 gate. **My recommendation: leave both as history** — the repo supersedes rather than rewrites records (`mcp-doc-contract.test.ts`'s scope note is the precedent), and neither is a carrier, so neither has a reader who acts on it as current.

**Full docs-tree sweep (box 3)** — every ADR+status-word line across `ArggonManager/docs`, root docs, templates, seams and the skill:
CORRECTED: `engineering.md:230`.
STALE, REPORTED: `explorations/exploration-cheap-path-to-prod-001.md:16` calls ADR 0005 `(Proposed)` — it is Accepted. **A fourth instance the item did not list.** Plus the box-2 spec/plan pair.
CORRECT AS HISTORY, LEFT ALONE: `exploration-opencode-v2-native-009.md:258` (`Accepted 2026-09-18` is explicitly dated and was true); `exploration-token-context-efficiency-001.md:189` ("Proposed in this PR; Accepted on merge" self-resolves to Accepted); `CHANGELOG.md:79`; the ADR corpus' own self-references (`0011:87`/`:97`, `0016:5`).
VERIFIED CORRECT: `README.md:177` (ADR 0001 Accepted); `runbooks/release.md:3` (ADR 0018 Accepted).
CLEAN: `templates/`, `.opencode/`, `.zcode-marketplace/`, `skills/`, `.agents/skills/` carry no ADR status claim; `agents.md` (9 refs) and `convention.md` (3 refs) state no status. The skill's `methodology.md:61` only *points at* §ADR process without restating content — that is why skills:sync is a no-diff.

**Same class in `engineering.md`, other fields — reported, NOT widened (per the item's scope):**
- `:44` — the `.github/workflows/` comment enumerates `ci.yml` + `auto-done.yml`; the directory holds **five** (`arggon.yml`, `auto-done.yml`, `ci.yml`, `release-please.yml`, `release.yml`).
- `:100` — "the **last step** of the `cli` job runs `smoke:native-start-cold`" is **no longer true**: `ci.yml:82` added "Playwright lane from a link-farm worktree" after it (`bug-worktree-link-farm-breaks-playwright-runner`).
- `:97` — prescribes **Playwright CLI** (`@playwright/cli`) as the review tool; `@playwright/cli` is not a dependency at all (repo ships `@playwright/test` ^1.63.0 dev-only). Weaker instance — it prescribes rather than restates.
- `convention.md` — links `./adr/0015-done-gate.md`, a file that **does not exist** (real: `0015-done-gate-acceptance-waiver.md`). Dead link in a carrier; also the reason my check is scoped to one file. Repairing it is a one-line follow-up that then unlocks adding `agents.md` + `convention.md` to `CARRIERS`.

**ADR 0021:** does not exist in `docs/adr/` on `origin/main` or in this worktree (not landed). No edit needed here — the check reads the directory dynamically, and `adr-index-parity.test.ts` owns one-row-per-ADR for the index, which this PR does not touch since no ADR status changed.

**Gates** (after `npm run build`): `npm test` 127 files / 2588 tests pass · `npm run lint` 0 · `npm run arggon -- validate` ok (0 warnings) · `npm run check:plugin` clean (bundle byte-identical) · `npm run test:structure` 5 passed · `npm run lint:structure` clean · prettier converged (pass-2 byte-identical to pass-3 on all 3 changed files) · pre-commit gate ran validate. Smoke exempt: docs + one additive test, no CLI behavior change.

Left `in_progress` — completion is the coordinator's call after merge.
