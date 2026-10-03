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

| Line       | Reference                                  | States a status? | Verdict                                                           |
| ---------- | ------------------------------------------ | ---------------- | ----------------------------------------------------------------- |
| 3          | ADR 0020 methodology carrier               | no               | correct, no claim                                                 |
| 8          | ADR 0016 upgrade channel                   | no               | correct, no claim                                                 |
| 14         | ADR 0001 stack, ADR 0002 board             | no               | correct, no claim                                                 |
| 33         | ADR 0013 lib package                       | no               | correct, no claim                                                 |
| 56         | ADR 0002 board                             | no               | correct, no claim                                                 |
| 89         | "ADR 0006 spirit"                          | no               | correct, no claim                                                 |
| 97/140/141 | ADR 0008 review smoke gate                 | no               | correct, no claim                                                 |
| 128        | "ADR 0016 reference when behavioral"       | no               | correct, no claim                                                 |
| **230**    | **"milestone field (Proposed)": ADR 0003** | **yes**          | **WRONG — file says `Accepted` (dated retroactive note). FIXED.** |

Only line 230 stated a status. The item's premise held, but the list needed proving: the other nine are descriptive/scoping and cannot go stale.

**The fix deletes the restatement instead of updating it.** A carrier that states an ADR's status must be re-edited on every acceptance, so it is eventually not — the mechanism behind this whole bug class (05b31fb6 → c0cdd60b → here). §Related now points at the ADR index as the register; §ADR process states the rule and names the two tests, so a future acceptance/supersession needs no doc edit outside the ADR file and its own index row.

**The check** — `cli/src/adr-status-doc-contract.test.ts`, shape of `adr-index-parity.test.ts` / the merged `mcp-doc-contract.test.ts`:

1. no ADR reference may carry a status, checked over the **label region** (prose before the link _plus_ the link's own text) — the defect's shape puts the status _before_ the link, so a link-text-only scan would pass vacuously over the exact sentence it exists to catch; the §ADR process lifecycle vocabulary carries no ADR reference so it does not fire;
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
CLEAN: `templates/`, `.opencode/`, `.zcode-marketplace/`, `skills/`, `.agents/skills/` carry no ADR status claim; `agents.md` (9 refs) and `convention.md` (3 refs) state no status. The skill's `methodology.md:61` only _points at_ §ADR process without restating content — that is why skills:sync is a no-diff.

**Same class in `engineering.md`, other fields — reported, NOT widened (per the item's scope):**

- `:44` — the `.github/workflows/` comment enumerates `ci.yml` + `auto-done.yml`; the directory holds **five** (`arggon.yml`, `auto-done.yml`, `ci.yml`, `release-please.yml`, `release.yml`).
- `:100` — "the **last step** of the `cli` job runs `smoke:native-start-cold`" is **no longer true**: `ci.yml:82` added "Playwright lane from a link-farm worktree" after it (`bug-worktree-link-farm-breaks-playwright-runner`).
- `:97` — prescribes **Playwright CLI** (`@playwright/cli`) as the review tool; `@playwright/cli` is not a dependency at all (repo ships `@playwright/test` ^1.63.0 dev-only). Weaker instance — it prescribes rather than restates.
- `convention.md` — links `./adr/0015-done-gate.md`, a file that **does not exist** (real: `0015-done-gate-acceptance-waiver.md`). Dead link in a carrier; also the reason my check is scoped to one file. Repairing it is a one-line follow-up that then unlocks adding `agents.md` + `convention.md` to `CARRIERS`.

**ADR 0021:** does not exist in `docs/adr/` on `origin/main` or in this worktree (not landed). No edit needed here — the check reads the directory dynamically, and `adr-index-parity.test.ts` owns one-row-per-ADR for the index, which this PR does not touch since no ADR status changed.

**Gates** (after `npm run build`): `npm test` 127 files / 2588 tests pass · `npm run lint` 0 · `npm run arggon -- validate` ok (0 warnings) · `npm run check:plugin` clean (bundle byte-identical) · `npm run test:structure` 5 passed · `npm run lint:structure` clean · prettier converged (pass-2 byte-identical to pass-3 on all 3 changed files) · pre-commit gate ran validate. Smoke exempt: docs + one additive test, no CLI behavior change.

Left `in_progress` — completion is the coordinator's call after merge.

### handoff 2026-10-03 @Arggon (session: ses_efe310c5effeaOs8Nra70sfiUu) — next: Coordinator reviews PR #618 and merges; then flip the item to done (3 of 4 boxes ticked; box 2 is theirs to decide on the spec/plan 009 dated-record case).

- branch: fix/bug-engineering-doc-stale-adr-statuses
- open questions: Box 2 (spec/plan 009, ADR 0010 Proposed) reserved for coordinator; recommend leaving both as dated history. Four other-class findings in engineering.md reported not fixed (:44 workflows list, :100 la…

### 2026-10-03 @reviewer

### 2026-10-03 @reviewer

verdict: request-changes (two small edits; everything else approved)

Reviewed by reading: the item + its comments, `git diff main...HEAD` (3 files, +316/-6), the new suite end-to-end, both sibling doc-contract tests it models, every ADR reference in all four carriers, every ADR file's `- Status:` line, `ci.yml`, `package.json`, `agents.md` §Documentation maintenance / §Changing the methodology / §ADR authoring, `sync-skills.ts`, the skill copies, `prose-format.test.ts`, `spec.ts`'s decision-gap detector, and `gh pr checks` (cli / tasks-validate / ui-smoke all SUCCESS). I ran no gates.

**F1 (must fix, one sentence):** `ArggonManager/docs/engineering.md:193` misdescribes the gate it names. It says a carrier — listing `agents.md`, this file, `convention.md`, `skills/arggon-cli/**` — "never restates that ADR's status", then that `cli/src/adr-status-doc-contract.test.ts` "fails a PR whose carrier states a status for an ADR or links to one that does not resolve". `CARRIERS` is `["ArggonManager/docs/engineering.md"]` (test:66). A status restated in `agents.md` or `convention.md` today gets a green lane, so the doc asserts coverage the suite does not have — the same shape as the defect this PR fixes, in the sentence this PR wrote. Either (a) name the scope ("`engineering.md` today; `agents.md`/`convention.md` are clean and widen with bug-convention-md-links-nonexistent-adr-0015"), or (b) split the constant: rule 1 over all three carriers now, rule 2 on `engineering.md` until the 0015 link is repaired. I recommend (b) — I read every `./adr/NNNN` reference in `agents.md` (3, 8, 24, 36, 288, 314, 473, 476) and `convention.md` (3, 8, 124) and no label region holds a status word, so (b) closes the class for the carriers the sentence names at zero cost today. (The test's own header at :45-50 already documents the scope honestly, which is what makes the doc/test disagreement intra-PR rather than a discovery.)

**F2 (should fix, one assertion):** the premise guards do not pin the link-text half of the region the PR calls load-bearing. Test 1 (:157-185) exercises only the before-the-link shape; "moved inside the link text" rests entirely on a reverted simulation. Narrowing the region to pre-link prose leaves every test green while losing coverage the header advertises. Add `statedStatuses(adrReferences("- x: [ADR 0003 (Proposed)](./adr/0003-milestone-field.md)")[0].label)` → `["Proposed"]`.

**F3 (note, closing the defect class):** rule 1 inspects only text _preceding_ each link. I traced `adrReferences` (:119-133): `line.slice(from, at)` covers prose + link text, the slice after a link only becomes the _next_ match's label, and the trailing slice after a final match is never read. So `… [ADR 0003](./adr/0003-milestone-field.md) (Proposed)` — the natural place to write a supersession note — passes. Not a false claim in the header, so not blocking; but `:193` promises "never restates" unqualified. Close it (`line.slice(from)` for the final match) or say so in the scope note. Probe 1 below is the observation I could not take myself.

**What I verified as correct**

- **The defect is real and was the whole of it.** ADR 0003's file is `- Status: Accepted`; `:230` read `milestone field (Proposed): [ADR 0003](…)`. I re-grepped every ADR _mention_ in the carrier (links at 3/8/14/97/140/141, bare mentions at 33/56/89/128) — only :230 stated a status, so the item's list needed no widening and got none.
- **Delete-don't-correct is right.** No reader loses anything: Lifecycle (:191) still explains how statuses move, and §Related points at the ADR index as the register. Box 4 asked for "update every surface describing it"; the PR inverts it to "there are no surfaces", which is strictly stronger and satisfies the box's intent.
- **The premise guards are real and coupled to the rule** — the risk the worker flagged is genuinely closed. The rule test (:193-213) calls exactly `adrReferences` + `statedStatuses`, the two functions test 1 pins, so the guards are not parallel decoration. `:167-171` asserts the _pre-fix_ sentence yields `["Proposed"]` **only** on ADR 0003, i.e. it asserts the scanner CATCHES; `:176-182` is the necessary false-positive guard (the new §ADR process prose is full of the vocabulary); `:184` guards `./adr/README.md`, a link this very PR added at :232; `:211` blocks vacuous passage if the link pattern stops matching. Delete the guards and the surviving `expect(problems).toEqual([])` runs over a carrier the same PR cleaned — it passes with an inverted, stubbed, or always-empty scanner. That is the silent-gate-deletion failure, and it does not happen here.
- **The label-region claim holds, and the simulation did exercise it.** `ADR_LINK` matches from the `(` of the target, so `match.index` lands after the link text and the label includes `[ADR 0003 (Proposed)]` as well as `milestone field (Proposed): `; `from` advances past `)` so the target never leaks into the next label; `:` is deliberately not a delimiter, which is exactly what makes the defect detectable. Before-link → caught, inside-link-text → caught, surrounding prose → correctly ignored, after-link → not caught (F3).
- **Vocabulary parity claim is accurate**: `STATUS_WORDS` is exactly `STATUS_CLASSES` (adr-index-parity.test.ts:125-131), same six classes, longest-first.
- **Scoping is right.** One dead link (`convention.md:124` → `./adr/0015-done-gate.md`; real file `0015-done-gate-acceptance-waiver.md`) is verified, and it is the only dead ADR link in any carrier. Blocking on someone else's carrier to widen would have meant shipping no check or a red lane; the blocker is named at the constant and filed with its own boxes. Two notes for `bug-convention-md-links-nonexistent-adr-0015`: its "readable message naming … what does exist at that directory" box is already delivered by test:221-224, and its "all four carriers" box needs the path pattern widened too — `explorations/**` links use `../adr/…`, not `./adr/…`, so `exploration-cheap-path-to-prod-001.md:16` would still slip through a carrier-list-only widening.
- **The sweep: all four confirmed stale and all four filed.** `:100` — `ci.yml:76` runs `smoke:native-start-cold`, then `:82-83` adds the link-farm Playwright lane, so "last step" is false. `:44` — five workflows exist, two are listed. `:97` — `@playwright/cli` is not a dependency (`@playwright/test ^1.63.0` is). `explorations/exploration-cheap-path-to-prod-001.md:16` — ADR 0005 is `Accepted`; the exploration's own frontmatter is `created: 2026-09-14`, the ADR's date too, so it was correct when written and went stale — the in-scope case, in a file no gate reads. **Addition for that item:** `README.md:177` also states a status ("ADR 0001 Accepted with this scaffold") — correct today, same hand-edited-on-every-acceptance surface; my repo-wide sweep found nothing else beyond the worker's list. (`runbooks/release.md:3`'s "Superseded by automation (ADR 0018…)" is about the runbook, not ADR 0018 — not a finding.)
- **Spec/plan 009: read correctly.** `spec-opencode2-009.md:87` ("W0 foundation: ADR 0010 Proposed", inside an unchecked acceptance box) and `plan-opencode2-009.md:24` were true when written — ADR 0010 went Proposed → Partially superseded by 0011 and never flipped to Accepted — so the worker classifying them as STALE rather than "correct as history" is the right bucket, and `mcp-doc-contract.test.ts`'s scope note is real and verbatim on point. Two refinements for the coordinator's box-2 call: the precedent establishes exemption from _machine pinning_, not that a stale statement must stay; and box 2's own "record that decision where a reader sees it" was not done, so the decision currently lives only in a tracker comment the spec's reader never sees. Also nothing flags it — `STALE-PROPOSED-ADR` (`spec.ts:752`) detects the opposite direction (an ADR file still Proposed), so it would not fire on a superseded one.
- **ADR 0021 will not break this gate.** `git ls-tree origin/main ArggonManager/docs/adr/` ends at 0020 + README; `adrFiles()` is `readdirSync` + filter, so the corpus is dynamic and 0021 needs no edit here. The in-flight 0021 PR lands `Proposed` with a `- Status:` line (premise 2 stays green), and its own note records that flipping 0021 to Accepted without its README row turns main red via `adr-index-parity.test.ts` — a pre-existing gate this PR does not touch (no ADR status changed). Both PRs edit `engineering.md` at disjoint lines (3 vs 193/232).
- **Impact class: the Advisory call is weakly argued but harmless.** The cited duties (`engineering.md:71`, `:212`) are about _keeping_ docs accurate; `:193` is a new _authoring_ rule (remove the field, don't update it), which reads Behavioral under `agents.md:476`'s own wording. What makes it a nit: `skills/arggon-cli/references/methodology.md:61` points at §ADR process rather than copying it, so the Behavioral obligations (ADR 0016 reference, byte-equal skill copies) are already met — consistent with the `skills:sync` no-diff claim (`.agents/skills/` is gitignored, a marker-prefixed generated copy, pinned by `cli/src/skill-copy.test.ts` inside `npm test`). `agents.md` is not touched, as claimed.
- **Smoke exempt is correct** (`engineering.md:94` docs-only exemption; `:146` not triggered — no CLI behavior change). The new suite runs inside the existing `npm test` (`ci.yml:49`); no pipeline step added, which is the load-bearing half of the Advisory claim. `"!**/*.test.*"` in `files` keeps the new test out of the tarball. The new test is typechecked in CI (`tsconfig.typecheck.json` includes `cli/src/**/*.ts` with `exclude: []`). Prettier is **not** a CI gate — `prose-format.test.ts` pins token-glue/code-span invariants, not `--check` — so the "prettier converged" claim is hygiene, not merge evidence.
- **Item bookkeeping:** branch/worktree/claim recorded, status `in_progress` with 3 of 4 boxes ticked and box 2 explicitly reserved — correct per `docs/agents.md` §5.

## Probes needed

cwd `/home/arggon/Projects/ArggonManager-bug-engineering-doc-stale-adr-statuses` (branch head `fceb27f7`), each edit reverted afterwards with `git status --porcelain` clean.

1. **F3 observation.** Append to `ArggonManager/docs/engineering.md:232`: change `milestone field: [ADR 0003](…)` → `milestone field: [ADR 0003](./adr/0003-milestone-field.md) (Proposed)`. Run `npx vitest run cli/src/adr-status-doc-contract.test.ts`. Expected (rule 1's stated intent): the "states no status" test FAILS. Observed (my trace of :119-133): 4/4 pass → a trailing restatement is invisible to the gate. Result changes: if it fails, F3 closes as a defect to fix now; if it passes, it stands as a documented coverage limit.
2. **F1's recommended fix is free.** Temporarily set `CARRIERS` to `["ArggonManager/docs/engineering.md","ArggonManager/docs/agents.md","ArggonManager/docs/convention.md"]` and run the same file. Expected: "states no status" passes for all three (my read says all three are clean on the field), and "links only to ADRs that exist" fails exactly once, naming `./adr/0015-done-gate.md` and `docs/adr/0015-done-gate-acceptance-waiver.md does`. Result changes: if rule 1 passes on all three, fix F1 by widening rule 1 to the carriers `:193` names; if rule 1 fails on `agents.md`/`convention.md`, my "zero cost today" claim is wrong and F1 must be fixed as option (a), the doc-scope note.
3. **F2 fix discriminates.** Add the inside-link-text assertion from F2, confirm it passes; then narrow the label to pre-link prose only (`line.slice(from, at).split(…).pop()` → the slice minus the bracketed link text) and confirm the new assertion FAILS while every other test still passes. Result changes: if the narrowed scanner keeps all tests green today, F2 is confirmed as an unpinned claim and the assertion is required; if it already fails elsewhere, F2 drops to optional.
4. **Gates on the final head after F1/F2 land:** `npm run build && npm test` (expected: the new file green, count +1 assertion over the recorded 2588) and `npm run lint` (expected 0). CI already shows cli / tasks-validate / ui-smoke SUCCESS at `fceb27f7`; re-confirm on the amended head.

Unverified by me: every execution claim above; the worker's five reverted simulations (their expected-vs-observed messages and sha256 reverts are recorded on the item but I did not reproduce them); the prettier-convergence claim; and CI for any head after the F1/F2 edits.

### 2026-10-03 @Arggon
### 2026-10-03 @Arggon
Round 1 addressed · commit aa86f434 · PR #618 · branch unchanged.

**Merged `origin/main` first** (was 18 behind). The item file conflicted — the verdict landed on main while my ticked boxes lived only on this branch. Resolved as a **union**: main's frontmatter, my ticked acceptance list, and every `###` block from both sides (my worker comment + handoff, and the reviewer's full verdict). No partial claim block; `validate` ok.

**The reviewer's three probes, run first, all confirmed — I did not assume them:**

| Probe | Predicted | Observed |
|---|---|---|
| 1 (F3) trailing restatement after the link | 4/4 pass = hole | **4/4 pass** — confirmed invisible |
| 2 (F1) widen `CARRIERS` to three | rule 1 passes on all three, rule 2 fails once on the 0015 link | **exactly that** — 1 failed / 7 passed, `convention.md: links ./adr/0015-done-gate.md, which does not exist — docs/adr/0015-done-gate-acceptance-waiver.md does` |
| 3 (F2) narrow region to pre-link prose | all green = unpinned | **4/4 pass** — confirmed unpinned |

**F1 — fixed by widening, not by softening the sentence.** The constant is now split:

- `STATUS_CARRIERS` = `engineering.md`, `agents.md`, `convention.md` (rule 1). All three were clean on the field, so the reviewer's "zero cost today" read was right.
- `LINK_CARRIERS` = `engineering.md` only (rule 2), because `convention.md:124`'s dead ADR 0015 link is still broken in the merged tree — that item is filed but not merged. Re-verified after the merge.

`:193` now ends in an explicit coverage statement instead of an unqualified "fails a PR whose carrier": **"Coverage: status restatement in `engineering.md`, `agents.md`, `convention.md`; link resolution in `engineering.md`."** — so the doc is *true*, not approximately true, and it says out loud why the link rule is narrower.

**F1's second half — the gate.** The doc sentence and the two arrays are the same fact stated twice, so a new test reads the coverage statement back out of `engineering.md` and asserts it names exactly the carriers the rules iterate. Verified in both directions:
- narrow `STATUS_CARRIERS` to one → `rule 1: doc vs constant: expected [ Array(3) ] to deeply equal [ 'ArggonManager/docs/engineering.md' ]`
- soften the **doc** (drop `agents.md`/`convention.md` from the sentence) → `expected [ 'ArggonManager/docs/engineering.md' ] to deeply equal [ Array(3) ]`

Delimiters are ASCII on purpose (`**Coverage: status restatement in ` … `; link resolution in ` … `**`): my first attempt parsed an em dash and I could not get the needle and the prose to agree on the codepoint through the shell — a parse that fragile would fail for reasons no reader could act on. An explicit coverage line is also better prose than burying the scope in a long sentence.

**F2 — all three shapes pinned in the premise guards.** Added, alongside the existing before-the-link case: inside the link text, after the link, a clause that must NOT be read (`… [ADR 0011](…) is the contract, and a change is accepted only once it is explicitly recorded.` → `[]`), and that ADR 0001 does not inherit ADR 0003's word across a `·`. Discriminating, confirmed:
- strip the trailing window → fails on the after-the-link assertion
- strip the link text from the head → fails on the inside-the-link-text assertion
Each half now fails on its own, so neither can be narrowed away silently.

**F3 — closed, not documented as a limit.** `adrReferences` now builds each reference's region from prose + link text + one trailing clause. The trailing clause stops at a sentence end, comma or list delimiter (`TAIL_STOPS`), because an unbounded window would run to end-of-line and `agents.md:473` continues for hundreds of characters past its ADR links — a window that wide would report prose with nothing to do with any ADR's status. The reviewer's probe 1 now **fails loudly**: `engineering.md: labels ADR 0003 "Proposed" — docs/adr/0003-milestone-field.md says "Accepted"; carriers link to an ADR, they do not restate its status`.

**End-to-end on the newly covered carriers** (previously a green lane):
- `(Proposed)` after ADR 0012's link in `agents.md` → caught, message carries 0012's real Accepted status
- `(Proposed)` after ADR 0016's link in `convention.md` → caught, same shape

**Original five simulations re-run, all still loud** (each reverted, sha256 verified against the pre-simulation backup afterwards): A `0003 (Proposed)` before the link → caught · B `0008 (superseded by ADR 0011)` → caught with 0008's real Accepted status + its date note · C inside the link text → caught · D after the link → caught (new) · E renumbered `0020`→`0021` → `links ./adr/0021-methodology-first-productization.md, which does not exist`. Clean tree 7/7.

**Impact class unchanged: Advisory.** No rule, gate, command contract or pipeline step; the suite still runs inside the existing `npm test`. The reviewer's nit stands as recorded — `:193` is a new *authoring* rule and reads Behavioral under `agents.md:476`'s wording — and the answer is unchanged: `skills/arggon-cli/references/methodology.md:61` points at §ADR process rather than copying it, so the Behavioral obligations are already met and nothing was hand-copied.

**Not touched, per the round-1 instruction:** the delete-don't-correct decision, §Related's pointer to the index as the register, the file-scope note in the test header, both sibling doc-contract tests, and the four swept findings now owned by `task-engineering-doc-restates-more-drifted-facts` / `bug-convention-md-links-nonexistent-adr-0015` (including the reviewer's added `README.md:177` instance). The 0015 link is still broken in this tree, so the two-constant split stays until that lands.

**Gates** (after `npm run build`): `npm test` 127 files / 2593 tests pass · `npm run lint` 0 · `npm run arggon -- validate` ok (0 warnings) · `npm run check:plugin` clean · `npm run test:structure` 5 passed · `npm run lint:structure` clean · prettier converged (pass-2 byte-identical to pass-3 on both changed files) · pre-commit gate ran validate. Smoke exempt: docs + one additive test, no CLI behavior change. Pushed fast-forward; no force.

Left `in_progress` — completion is the coordinator's call after merge.

### handoff 2026-10-03 @Arggon (session: ses_efe310c5effeaOs8Nra70sfiUu) — next: Coordinator re-reviews PR #618 (aa86f434) for F1/F2/F3 and merges; then flip the item to done. Box 2 (spec/plan 009) still theirs to decide.
- branch: fix/bug-engineering-doc-stale-adr-statuses
- open questions: Impact class still argued Advisory while the reviewer reads :193 as a new authoring rule (Behavioral); nothing to sync either way. LINK_CARRIERS widens when bug-convention-md-links-nonexistent-adr-00…
