---
type: bug
status: todo
id: bug-engineering-doc-stale-adr-statuses
title: "`docs/engineering.md:230` and spec/plan 009 still describe ADRs 0003/0010 as `Proposed`; 0002/0003/0004 were Accepted in their files by c0cdd60b"
parent: story-spec-pipeline
labels: [docs, adr]
created: "2026-10-03"
updated: "2026-10-03"
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
- [ ] `docs/engineering.md` no longer describes ADR 0003 as Proposed (it is Accepted); check its whole ADR-status reference list, not just line 230
- [ ] Decide the spec/plan 009 case explicitly: either the dated record is correct as history (record that decision where a reader sees it) or the statements are current-tense claims that must be updated
- [ ] Sweep the docs tree for ADR status claims against the actual files — the index drift recurred at least three times (05b31fb6 fixed 0014-0017; c0cdd60b left 0002-0004; now this)
- [ ] State in the ADR process section that an ADR status change must update every surface describing it, so the sweep is not manual next time

### 2026-10-03 @reviewer
### 2026-10-03 @reviewer
verdict: request-changes (two small edits; everything else approved)

Reviewed by reading: the item + its comments, `git diff main...HEAD` (3 files, +316/-6), the new suite end-to-end, both sibling doc-contract tests it models, every ADR reference in all four carriers, every ADR file's `- Status:` line, `ci.yml`, `package.json`, `agents.md` §Documentation maintenance / §Changing the methodology / §ADR authoring, `sync-skills.ts`, the skill copies, `prose-format.test.ts`, `spec.ts`'s decision-gap detector, and `gh pr checks` (cli / tasks-validate / ui-smoke all SUCCESS). I ran no gates.

**F1 (must fix, one sentence):** `ArggonManager/docs/engineering.md:193` misdescribes the gate it names. It says a carrier — listing `agents.md`, this file, `convention.md`, `skills/arggon-cli/**` — "never restates that ADR's status", then that `cli/src/adr-status-doc-contract.test.ts` "fails a PR whose carrier states a status for an ADR or links to one that does not resolve". `CARRIERS` is `["ArggonManager/docs/engineering.md"]` (test:66). A status restated in `agents.md` or `convention.md` today gets a green lane, so the doc asserts coverage the suite does not have — the same shape as the defect this PR fixes, in the sentence this PR wrote. Either (a) name the scope ("`engineering.md` today; `agents.md`/`convention.md` are clean and widen with bug-convention-md-links-nonexistent-adr-0015"), or (b) split the constant: rule 1 over all three carriers now, rule 2 on `engineering.md` until the 0015 link is repaired. I recommend (b) — I read every `./adr/NNNN` reference in `agents.md` (3, 8, 24, 36, 288, 314, 473, 476) and `convention.md` (3, 8, 124) and no label region holds a status word, so (b) closes the class for the carriers the sentence names at zero cost today. (The test's own header at :45-50 already documents the scope honestly, which is what makes the doc/test disagreement intra-PR rather than a discovery.)

**F2 (should fix, one assertion):** the premise guards do not pin the link-text half of the region the PR calls load-bearing. Test 1 (:157-185) exercises only the before-the-link shape; "moved inside the link text" rests entirely on a reverted simulation. Narrowing the region to pre-link prose leaves every test green while losing coverage the header advertises. Add `statedStatuses(adrReferences("- x: [ADR 0003 (Proposed)](./adr/0003-milestone-field.md)")[0].label)` → `["Proposed"]`.

**F3 (note, closing the defect class):** rule 1 inspects only text *preceding* each link. I traced `adrReferences` (:119-133): `line.slice(from, at)` covers prose + link text, the slice after a link only becomes the *next* match's label, and the trailing slice after a final match is never read. So `… [ADR 0003](./adr/0003-milestone-field.md) (Proposed)` — the natural place to write a supersession note — passes. Not a false claim in the header, so not blocking; but `:193` promises "never restates" unqualified. Close it (`line.slice(from)` for the final match) or say so in the scope note. Probe 1 below is the observation I could not take myself.

**What I verified as correct**

- **The defect is real and was the whole of it.** ADR 0003's file is `- Status: Accepted`; `:230` read `milestone field (Proposed): [ADR 0003](…)`. I re-grepped every ADR *mention* in the carrier (links at 3/8/14/97/140/141, bare mentions at 33/56/89/128) — only :230 stated a status, so the item's list needed no widening and got none.
- **Delete-don't-correct is right.** No reader loses anything: Lifecycle (:191) still explains how statuses move, and §Related points at the ADR index as the register. Box 4 asked for "update every surface describing it"; the PR inverts it to "there are no surfaces", which is strictly stronger and satisfies the box's intent.
- **The premise guards are real and coupled to the rule** — the risk the worker flagged is genuinely closed. The rule test (:193-213) calls exactly `adrReferences` + `statedStatuses`, the two functions test 1 pins, so the guards are not parallel decoration. `:167-171` asserts the *pre-fix* sentence yields `["Proposed"]` **only** on ADR 0003, i.e. it asserts the scanner CATCHES; `:176-182` is the necessary false-positive guard (the new §ADR process prose is full of the vocabulary); `:184` guards `./adr/README.md`, a link this very PR added at :232; `:211` blocks vacuous passage if the link pattern stops matching. Delete the guards and the surviving `expect(problems).toEqual([])` runs over a carrier the same PR cleaned — it passes with an inverted, stubbed, or always-empty scanner. That is the silent-gate-deletion failure, and it does not happen here.
- **The label-region claim holds, and the simulation did exercise it.** `ADR_LINK` matches from the `(` of the target, so `match.index` lands after the link text and the label includes `[ADR 0003 (Proposed)]` as well as `milestone field (Proposed): `; `from` advances past `)` so the target never leaks into the next label; `:` is deliberately not a delimiter, which is exactly what makes the defect detectable. Before-link → caught, inside-link-text → caught, surrounding prose → correctly ignored, after-link → not caught (F3).
- **Vocabulary parity claim is accurate**: `STATUS_WORDS` is exactly `STATUS_CLASSES` (adr-index-parity.test.ts:125-131), same six classes, longest-first.
- **Scoping is right.** One dead link (`convention.md:124` → `./adr/0015-done-gate.md`; real file `0015-done-gate-acceptance-waiver.md`) is verified, and it is the only dead ADR link in any carrier. Blocking on someone else's carrier to widen would have meant shipping no check or a red lane; the blocker is named at the constant and filed with its own boxes. Two notes for `bug-convention-md-links-nonexistent-adr-0015`: its "readable message naming … what does exist at that directory" box is already delivered by test:221-224, and its "all four carriers" box needs the path pattern widened too — `explorations/**` links use `../adr/…`, not `./adr/…`, so `exploration-cheap-path-to-prod-001.md:16` would still slip through a carrier-list-only widening.
- **The sweep: all four confirmed stale and all four filed.** `:100` — `ci.yml:76` runs `smoke:native-start-cold`, then `:82-83` adds the link-farm Playwright lane, so "last step" is false. `:44` — five workflows exist, two are listed. `:97` — `@playwright/cli` is not a dependency (`@playwright/test ^1.63.0` is). `explorations/exploration-cheap-path-to-prod-001.md:16` — ADR 0005 is `Accepted`; the exploration's own frontmatter is `created: 2026-09-14`, the ADR's date too, so it was correct when written and went stale — the in-scope case, in a file no gate reads. **Addition for that item:** `README.md:177` also states a status ("ADR 0001 Accepted with this scaffold") — correct today, same hand-edited-on-every-acceptance surface; my repo-wide sweep found nothing else beyond the worker's list. (`runbooks/release.md:3`'s "Superseded by automation (ADR 0018…)" is about the runbook, not ADR 0018 — not a finding.)
- **Spec/plan 009: read correctly.** `spec-opencode2-009.md:87` ("W0 foundation: ADR 0010 Proposed", inside an unchecked acceptance box) and `plan-opencode2-009.md:24` were true when written — ADR 0010 went Proposed → Partially superseded by 0011 and never flipped to Accepted — so the worker classifying them as STALE rather than "correct as history" is the right bucket, and `mcp-doc-contract.test.ts`'s scope note is real and verbatim on point. Two refinements for the coordinator's box-2 call: the precedent establishes exemption from *machine pinning*, not that a stale statement must stay; and box 2's own "record that decision where a reader sees it" was not done, so the decision currently lives only in a tracker comment the spec's reader never sees. Also nothing flags it — `STALE-PROPOSED-ADR` (`spec.ts:752`) detects the opposite direction (an ADR file still Proposed), so it would not fire on a superseded one.
- **ADR 0021 will not break this gate.** `git ls-tree origin/main ArggonManager/docs/adr/` ends at 0020 + README; `adrFiles()` is `readdirSync` + filter, so the corpus is dynamic and 0021 needs no edit here. The in-flight 0021 PR lands `Proposed` with a `- Status:` line (premise 2 stays green), and its own note records that flipping 0021 to Accepted without its README row turns main red via `adr-index-parity.test.ts` — a pre-existing gate this PR does not touch (no ADR status changed). Both PRs edit `engineering.md` at disjoint lines (3 vs 193/232).
- **Impact class: the Advisory call is weakly argued but harmless.** The cited duties (`engineering.md:71`, `:212`) are about *keeping* docs accurate; `:193` is a new *authoring* rule (remove the field, don't update it), which reads Behavioral under `agents.md:476`'s own wording. What makes it a nit: `skills/arggon-cli/references/methodology.md:61` points at §ADR process rather than copying it, so the Behavioral obligations (ADR 0016 reference, byte-equal skill copies) are already met — consistent with the `skills:sync` no-diff claim (`.agents/skills/` is gitignored, a marker-prefixed generated copy, pinned by `cli/src/skill-copy.test.ts` inside `npm test`). `agents.md` is not touched, as claimed.
- **Smoke exempt is correct** (`engineering.md:94` docs-only exemption; `:146` not triggered — no CLI behavior change). The new suite runs inside the existing `npm test` (`ci.yml:49`); no pipeline step added, which is the load-bearing half of the Advisory claim. `"!**/*.test.*"` in `files` keeps the new test out of the tarball. The new test is typechecked in CI (`tsconfig.typecheck.json` includes `cli/src/**/*.ts` with `exclude: []`). Prettier is **not** a CI gate — `prose-format.test.ts` pins token-glue/code-span invariants, not `--check` — so the "prettier converged" claim is hygiene, not merge evidence.
- **Item bookkeeping:** branch/worktree/claim recorded, status `in_progress` with 3 of 4 boxes ticked and box 2 explicitly reserved — correct per `docs/agents.md` §5.

## Probes needed
cwd `/home/arggon/Projects/ArggonManager-bug-engineering-doc-stale-adr-statuses` (branch head `fceb27f7`), each edit reverted afterwards with `git status --porcelain` clean.

1. **F3 observation.** Append to `ArggonManager/docs/engineering.md:232`: change `milestone field: [ADR 0003](…)` → `milestone field: [ADR 0003](./adr/0003-milestone-field.md) (Proposed)`. Run `npx vitest run cli/src/adr-status-doc-contract.test.ts`. Expected (rule 1's stated intent): the "states no status" test FAILS. Observed (my trace of :119-133): 4/4 pass → a trailing restatement is invisible to the gate. Result changes: if it fails, F3 closes as a defect to fix now; if it passes, it stands as a documented coverage limit.
2. **F1's recommended fix is free.** Temporarily set `CARRIERS` to `["ArggonManager/docs/engineering.md","ArggonManager/docs/agents.md","ArggonManager/docs/convention.md"]` and run the same file. Expected: "states no status" passes for all three (my read says all three are clean on the field), and "links only to ADRs that exist" fails exactly once, naming `./adr/0015-done-gate.md` and `docs/adr/0015-done-gate-acceptance-waiver.md does`. Result changes: if rule 1 passes on all three, fix F1 by widening rule 1 to the carriers `:193` names; if rule 1 fails on `agents.md`/`convention.md`, my "zero cost today" claim is wrong and F1 must be fixed as option (a), the doc-scope note.
3. **F2 fix discriminates.** Add the inside-link-text assertion from F2, confirm it passes; then narrow the label to pre-link prose only (`line.slice(from, at).split(…).pop()` → the slice minus the bracketed link text) and confirm the new assertion FAILS while every other test still passes. Result changes: if the narrowed scanner keeps all tests green today, F2 is confirmed as an unpinned claim and the assertion is required; if it already fails elsewhere, F2 drops to optional.
4. **Gates on the final head after F1/F2 land:** `npm run build && npm test` (expected: the new file green, count +1 assertion over the recorded 2588) and `npm run lint` (expected 0). CI already shows cli / tasks-validate / ui-smoke SUCCESS at `fceb27f7`; re-confirm on the amended head.

Unverified by me: every execution claim above; the worker's five reverted simulations (their expected-vs-observed messages and sha256 reverts are recorded on the item but I did not reproduce them); the prettier-convergence claim; and CI for any head after the F1/F2 edits.
