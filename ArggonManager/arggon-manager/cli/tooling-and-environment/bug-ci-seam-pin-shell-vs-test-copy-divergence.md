---
type: bug
status: todo
id: bug-ci-seam-pin-shell-vs-test-copy-divergence
title: "Re-scoped: the TEMPLATE-vs-COMMITTED copy divergence is CLOSED by PR #607 (parity test); what remains is only the `pin !== pkgVersion` conjunct — and the shell copy is the STRICTER predicate, so pasting it in may be wrong"
parent: tooling-and-environment
labels: [ci, seam]
created: "2026-10-03"
updated: "2026-10-03"
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
- [ ] Decide, with a recorded reason, which predicate is intended — the TS test's stricter `pin !== pkgVersion` conjunct or the shell copy's form — and make the non-chosen one explicitly scoped rather than quietly lax
- [ ] If they legitimately differ, the parity test must permit that specific difference EXPLICITLY (a named exception), not by a general carve-out, and `docs/ci.md` §Where the rule of record lives must state the difference
- [ ] `docs/ci.md` continues to point here for this fact (the false "neither copy can rot silently" claim was replaced by this fact)
- [ ] Depends on PR #607 landing

### 2026-10-03 @Arggon
Coordinator record at merge for `bug-ci-seam-pin-shell-vs-test-copy-divergence`, 2026-10-03, after `verdict: approve` with no blocking findings.

**The finding underneath the decision, which the reviewer found rather than the worker.** The pre-existing verdict table on `main` was **self-contradictory**: its #527 row documented `pin V · pkg V · stamps V+1 → RED`, but the predicate it described returns *green* when `pin == pkg`, and the unit test asserted a **different input** (`pkg = V+1`) from the row it claimed to document. So the documented rule of record disagreed with its own implementation, and the extra conjunct was papering over that gap. The PR splits the row correctly. That doc repair is the most valuable change here and it was made quietly rather than claimed — the worker reported "it bought nothing", which was true but undersold why.

**Reachability was verified, not assumed.** `arggonVersion()` (`cli/src/docs.ts:580`) reads `packageRoot()`, which resolves to the **running CLI's own root** (`cli/src/package-assets.ts:14`) — not the target repo. Stamps therefore record the executing binary's version while the test's `pkgVersion` is the branch's `package.json`. Two different files, so the disagreement cell is reachable in reality.

**Two evidence corrections from the reviewer, both recorded here rather than quietly dropped:**
1. Mutation (a) ran an **8-row** corpus (the empty-stamps row was omitted because the pre-fix `reduce` throws on `[]`), so the result was **7 of 8**, not "8 of 9" as the PR body said. The substantive claim — exactly one input disagrees — is unaffected, but the number was wrong and imprecise evidence lines are the exact habit this item exists to remove.
2. `vitest.config.ts` sets a suite-wide 30 s `testTimeout` and `prose-format.test.ts` costs ~42 s alone — zero headroom, which is now the filed `bug-prose-format-codespan-test-times-out-under-full-suite`. The reviewer's "main is also affected" claim is independently corroborated by a different worker hitting the same lane on PR #620, and the 0.4 % framing was judged fair.

**Precedent set on acceptance boxes — worth naming because it will recur.** Box 2's requirement ("if they legitimately differ, permit that difference as a named exception") is **vacuously satisfied**: they no longer differ, so no exception is needed. The worker ticked it and recorded why, rather than rewriting the acceptance text so the box would self-satisfy — leaving it `[ ]` would assert "unmet", which is false. **Vacuous satisfaction counts as met, and the honesty requirement is that the reason is recorded.** If this recurs in another item, this belongs in `docs/convention.md` as a rule rather than being re-litigated each time.

**Round-1's five acceptance boxes are NOT ticked, deliberately.** That work was delivered by merged PR #607, not by this PR. Ticking them here would credit this branch with someone else's implementation. The done gate will refuse until they are ticked or waived with a recorded reason; the coordinator owns that decision.

**Two non-blocking notes carried forward:**
- The disagreement cell's documented remedy is "bump the pin", which is suboptimal for a feature branch in-repo but is correct for adopters. It is a pre-existing property of the unchanged shell clause, and belongs in the drift-gate's ceiling section — **not** in this decision. Do not widen this item to fix it.
- The reviewer disclosed that its own `tools.arggon.show` resolved the tracker from its process cwd — the **primary** checkout — so its first read showed `main`'s pre-merge copy with all boxes unticked, and it re-read from the worktree to confirm. Anyone reviewing this wave must route reads through the worktree or they will review stale tracker state.

**Merge safety**: both workflow copies hash-match `main`, so this change is monotone — it can only make the `cli` job red where `tasks-validate` already fails.
