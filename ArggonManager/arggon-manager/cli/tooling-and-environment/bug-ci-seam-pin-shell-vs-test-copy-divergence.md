---
type: bug
status: todo
id: bug-ci-seam-pin-shell-vs-test-copy-divergence
title: "`cli/src/ci-seam-pin.test.ts` (template copy) and the committed workflow (shell copy) can drift: the test has an extra `pin !== pkgVersion` conjunct, and nothing machine-checks they match"
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
