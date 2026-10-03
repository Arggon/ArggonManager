---
type: bug
status: in_progress
id: bug-ci-seam-pin-shell-vs-test-copy-divergence
title: "Re-scoped: the TEMPLATE-vs-COMMITTED copy divergence is CLOSED by PR #607 (parity test); what remains is only the `pin !== pkgVersion` conjunct — and the shell copy is the STRICTER predicate, so pasting it in may be wrong"
assignee: Arggon
branch: fix/bug-ci-seam-pin-shell-vs-test-copy-divergence
parent: tooling-and-environment
labels: [ci, seam]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T12:47:56.606Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-ci-seam-pin-shell-vs-test-copy-divergence
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-ci-seam-pin-shell-vs-test-copy-divergence.md
  Leaves live only under a story. id is the filename stem: bug-ci-seam-pin-shell-vs-test-copy-divergence.
  CLI `arggon create bug ci-seam-pin-shell-vs-test-copy-divergence` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `cli/src/ci-seam-pin.test.ts` (template copy) and the committed workflow (shell copy) can drift: the test has an extra `pin !== pkgVersion` conjunct, and nothing machine-checks they match

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Found by the reviewer of PR #607 (bug-seam-drift-gate-blocks-new-generated-seam-content), 2026-10-03, and filed separately because the fix for #607 should not grow to absorb it.

**The two-copy problem.** The seam pin rule lives in TWO copies that nothing keeps in sync:

1. `templates/docs/github/workflows/arggon.yml` — the template, whose step bodies are exercised verbatim by `cli/src/headless-ci.test.ts`
2. `.github/workflows/arggon.yml` — the COMMITTED file, which is what CI actually runs

They differ today only in two `uses:` action SHA pins. But the review found a REAL semantic divergence in the lag rule: `pinLagsSeam()` in `cli/src/ci-seam-pin.test.ts` carries an extra `pin !== pkgVersion` conjunct that the shell copy lacks. So the test can pass while the thing CI runs is weaker — the classic "green because the other copy was tested" hole, pointed at ourselves.

The reviewer also noted the test's HEADER now describes a gate that does not exist in the committed copy — the pin's own record is stale, which is how a rule rots without anyone noticing.

Acceptance:

- [ ] A parity check asserts the two copies agree on the RULE, allowing the documented `uses:` SHA differences — not just that both files parse
- [ ] The `pinLagsSeam` / shell divergence is either closed in both copies or, if the extra conjunct is deliberate, the shell copy gains it and the reason is recorded
- [ ] The test header describes the gate that CI actually runs
- [ ] The two-copy invariant holds for the branch-aware generator predicate introduced by PR #607 too (both steps, both files)
- [ ] Documented where the rule of record lives, so a future edit does not have to discover the duplication

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Re-scoped by the round-2 reviewer of PR #607 (2026-10-03), because the original framing was wrong in three of its four points and its acceptance now asks for work that is already done.

**Already satisfied by PR #607 — do not re-implement:**

1. A parity check asserting the two workflow copies agree on the RULE, allowing only the documented `uses:` SHA differences — DONE. The new `describe("workflow parity: template vs the copy CI runs")` in `headless-ci.test.ts` byte-compares both files with `uses:` refs collapsed to a single canonical line, so a ref COUNT change still fails while only the value is excepted; the `uses:` carve-out is separately guarded by `action-pins.test.ts` (40-hex SHA, every shipped workflow).
2. The branch-aware generator predicate checked in both steps of both copies — DONE, by the same test.
3. The test header corrected to describe the gate CI actually runs — DONE, by PR #607 round 2.
4. Where the rule of record lives — DONE, as a new section in `docs/ci.md`: the template holds the rule, the committed copy is what CI runs, the TS predicate is the `cli`-job guard, and only the shell copy decides `tasks-validate`.

**What actually remains, with a trap the reviewer flagged:** the original finding was that `pinLagsSeam()` in `cli/src/ci-seam-pin.test.ts` carries an extra `pin !== pkgVersion` conjunct the shell copy lacks. But **the shell copy is the STRICTER predicate**, so "close the gap by pasting the conjunct into the shell copy" is not obviously correct — it may be that the TS test's extra conjunct is right for its purpose (a unit assertion) and the shell's simpler form is right for its purpose (the CI gate). Decide which is intended BEFORE changing either, and say why.

Acceptance:

- [x] Decide, with a recorded reason, which predicate is intended — the TS test's stricter `pin !== pkgVersion` conjunct or the shell copy's form — and make the non-chosen one explicitly scoped rather than quietly lax
- [x] If they legitimately differ, the parity test must permit that specific difference EXPLICITLY (a named exception), not by a general carve-out, and `docs/ci.md` §Where the rule of record lives must state the difference
- [x] `docs/ci.md` continues to point here for this fact (the false "neither copy can rot silently" claim was replaced by this fact)
- [x] Depends on PR #607 landing

### 2026-10-03 @Arggon

**Decision: the shell clause is the rule of record; the TS-only `pin !== pkgVersion` conjunct is removed (not pasted into the shell copy).** PR #621.

## The two predicates

- shell (both workflow copies, the drift step): fires iff `[ -n "$newest" ] && max(newest, ARGGON_VERSION) != ARGGON_VERSION`, i.e. **newest stamp > pin**. Inputs: the pin and the committed stamps. It never reads `package.json`.
- TS (`pinLagsSeam()`): `pin !== pkgVersion && pin < newest`. Red set is a strict **subset** of the shell's — so the shell is the stricter predicate, as the re-scope said.

## The disagreement input exists, and it is one cell

They differ exactly on `newest > pin && pin == pkgVersion`: a committed stamp newer than the pin while `package.json` equals the pin. On it **the shell FIRES and the old predicate returned green** — i.e. the #527 outage class (the pinned init really would rewrite committed content) went unflagged by the guard that exists to flag it. Reachable whenever a contributor's installed `arggon` is newer than their branch's `package.json` (`arggonVersion()` stamps with the INSTALLED package version) and they run `arggon init`. No such input exists on the six documented release-flow rows — which is itself the finding: the conjunct bought nothing there.

## Why not paste it into the shell copy (the trap)

The clause runs in every adopter's repo, and an adopter's `package.json` version is unrelated to arggon releases. Pasted in, any adopter whose version coincides with the pin literal gets the #527 gate **switched off** and ships the outage silently. So the shell copy had to stay strict, and the conjunct had to go.

## Mutation evidence (all reverted; branch is green)

| Mutation                                                                               | Observed                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pre-fix predicate (conjunct restored, from git HEAD) + the new parity gate             | RED on **exactly one** row: `#527 with the release bump landed (pin == package.json, seam newer)` — expected false to be true. 8/9 corpus rows agree, so the conjunct bought nothing in the release flow and cost the #527 signal. |
| conjunct pasted into `.github/workflows/arggon.yml` only (the finding's suggested fix) | RED twice: the clause-parity assertion naming the committed file, plus the pre-existing `never derives it` guard (`node -p "require('./package.json').version"` is banned).                                                        |
| headless-ci direction 3b flipped to expect green                                       | RED: `ARGGON_VERSION (0.5.0) lags the committed arggon seam (99.0.0)`, expected 1 to be +0.                                                                                                                                        |
| reverted                                                                               | GREEN: 126 files / 2590 tests.                                                                                                                                                                                                     |

Raw shell on the extracted clause:

```text
pin=0.5.0  package.json=0.5.0  stamps=[0.5.0] -> green
pin=0.5.0  package.json=0.6.0  stamps=[0.5.0] -> green
pin=0.5.0  package.json=0.6.0  stamps=[0.5.1] -> FIRES
pin=0.5.0  package.json=0.5.0  stamps=[0.5.1] -> FIRES   <- the disagreement input
```

## What closes it

1. `pinLagsSeam(pin, stamps)` is now the plain transcription of the clause; the removed conjunct's counter-case is named in the file header and as its own verdict-table row, so it cannot come back as "obviously also true".
2. A parity block **executes the clause** — lifted out of BOTH workflow copies, never remembered, so a restructure fails loudly instead of silently ceasing to be compared — against the predicate over a corpus (every release-flow state + the disagreement row), and asserts both copies carry the same clause and the same `sort -V` newest-stamp derivation.
3. `headless-ci.test.ts` direction 3b drives the step body end to end on the same triple from the shell side: a repo whose `package.json` version equals the pin still goes RED.
4. `ArggonManager/docs/ci.md` §Where the rule of record lives states the resolved split plus an explicit "What the rule does not read: `package.json`" scope, and still points here as provenance. The false "neither copy can rot silently" claim stays gone.

No workflow copy changed — the whole fix is on the TS side, which is exactly why the gate stays strict.

## Methodology impact class: **Advisory**

`templates/docs/**` is byte-unchanged (no adopter's seam or CI gate moves) and `skills/arggon-cli/`, `.agents/skills/`, `docs/agents.md`, `docs/engineering.md`, `docs/convention.md` are untouched, so no `npm run skills:sync` is required. What changed is wording/scope in a product doc plus two test files: no rule, gate, command contract or pipeline step changed for any agent, human or adopter.

## Gates

build → test (126 files / 2590 tests) → lint → validate (ok, 0 warnings) → check:plugin (no diff) → test:structure (5 passed) → lint:structure (clean). Prettier converged (pass-2 == pass-3) on all three touched files. `origin/main` merged in (no force-push); merge touched none of my three files.

Disclosed for the reviewer: on an earlier full run, `cli/src/prose-format.test.ts` > "prettier never rewrites a code span's source text" hit vitest's 30 s `testTimeout`. Load-margin flake, not this change — corpus is 350 md files / ~430 KB and this grows one by 1.9 KB (0.4 %); the sibling test in the same file (half the work) passed under the same load, the file passes standalone in 42 s, and both a pristine `origin/main` tree and this branch go green on re-run.

### 2026-10-03 @Arggon
**Acceptance mapping (honest, box by box) — how each tick was earned, and one conditional that turned out not to apply.**

- **Box 1 (decide + record why; make the non-chosen one explicitly scoped).** Decided in favour of the shell clause's form, reason recorded in three places: the `pinLagsSeam` file header (the conjunct's two refutations + the adopter counter-case), `ArggonManager/docs/ci.md` §Where the rule of record lives, and the comment above. The non-chosen form was **removed, not left lax** — the rule now reads `[ -n "$newest" ] && pin < newest`, with an explicit "What the rule does not read: `package.json`" scope plus a verdict-table row for the counter-case it used to hide. Nothing about the rule is implicit any more.

- **Box 2 — the conditional's antecedent is FALSE, so this is not a named-exception situation; read my tick as "the stronger form of the requirement", and here is why it holds.** The two do **not** legitimately differ: the divergence was a defect, not a design choice, so I closed it instead of permitting it. The requirement's actual intent is protected twice over: (a) **no general carve-out exists anywhere** — the parity is a *total* identity assertion over a corpus (9 rows: every documented release-flow state, the disagreement row, a multi-stamp row where `sort -V` beats lexicographic, and the no-stamps row) with **zero exceptions**, so there is nothing to carve out; (b) the difference is nonetheless **stated explicitly** in `docs/ci.md` §Where the rule of record lives, with the deciding input named. If the coordinator prefers this box left unticked to record "not applicable", that is a one-character change and the done-gate should be the decider — I did not want to rewrite the acceptance text itself to make a box self-satisfying.

- **Box 3 (ci.md keeps pointing here; the false claim stays gone).** `docs/ci.md` §Where the rule of record lives still names `bug-ci-seam-pin-shell-vs-test-copy-divergence` as the provenance of the decision, and the old "treat that as known, tracked skew … not as one rule with two spellings" text is **replaced** by the resolved statement. No sentence claiming neither copy can rot silently was restored; the honest ceiling ("What the branch-local comparison gives up") is untouched.

- **Box 4 (depends on PR #607 landing).** Verified, not assumed: `gh pr view 607` → MERGED at 2026-10-03T03:37:40Z, and `git show origin/main:cli/src/headless-ci.test.ts` contains the `workflow parity: template vs the copy CI runs` block. My branch merged `origin/main` in (20 commits, no force-push; the merge touched none of my three files) and all gates pass on the merged tree.

Left `in_progress` for the coordinator: merge + done is your call. Nothing here needs a follow-up item — the residual scope notes (byte equality against the pin, pin ahead of the stamps) are deliberate and documented in `docs/ci.md`, not gaps.
