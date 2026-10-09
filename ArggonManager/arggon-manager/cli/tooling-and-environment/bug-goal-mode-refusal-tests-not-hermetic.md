---
type: bug
status: todo
id: bug-goal-mode-refusal-tests-not-hermetic
title: "Three goal-mode refusal assertions are not hermetic: they omit the caller identity, so CI's ambient identity fires GOAL_FOREIGN_CLAIM and masks GOAL_WORKTREE_MISMATCH / GOAL_WORKTREE_MISSING / GOAL_TEMPLATE_UNAVAILABLE"
parent: tooling-and-environment
labels: [tests, ci, hermeticity]
created: "2026-10-09"
updated: "2026-10-09"
---

# Three goal-mode refusal assertions are not hermetic

## Context

Surfaced by CI on release PR #664
(`actions/runs/37934546153/job/113835015000`), which failed the `cli` job:
**3 failed / 2834 passed** — all in `cli/src/goal-mode.test.ts`, all at line 668.

```
AssertionError: expected 'GOAL_FOREIGN_CLAIM' to be 'GOAL_WORKTREE_MISMATCH'
AssertionError: expected 'GOAL_FOREIGN_CLAIM' to be 'GOAL_WORKTREE_MISSING'
AssertionError: expected 'GOAL_FOREIGN_CLAIM' to be 'GOAL_TEMPLATE_UNAVAILABLE'
```

**Not a product regression.** The assertion order in `goalOperation` is correct
(`GOAL_ITEM_CLOSED` → identity → claim → worktree → template); the defect is that
the tests were not hermetic.

## Cause

The refusal cases build trees with `{ assignee: "Arggon" }` but do **not** pass a
`login`, so `goalOperation` resolves the caller identity from the ambient
environment (`lib/src/list.ts:110` — `GITHUB_USER` → `GITHUB_ACTOR` → `gh` →
git-config). On a developer machine that resolves to `Arggon` and the intended
refusal fires. In CI it resolves to the runner's identity, which differs from the
item's assignee, so `assertClaimed` throws `GOAL_FOREIGN_CLAIM` first and masks the
refusal under test.

Because the worktree and template cases **also depend on ambient state** (a
recorded `worktree_path` that may or may not exist, and a packaged template), the
three assertions passed locally for a different reason than they were written —
the mask, not the logic, was doing the work.

## Reproduced and fixed

- Pre-fix under `GITHUB_USER=github-actions`: **3 failed / 45 passed** — exactly
  CI's three failures.
- Post-fix under the same env: **48/48**; with an unresolved identity: **48/48**;
  full suite **133 files / 2837 tests**.
- Fix pins `login: "Arggon"` in the three `arrange` blocks
  (`fix/goal-mode-test-ci-identity`).

## Acceptance

- [x] The three assertions exercise the refusal they name, **independent of the
      ambient identity** — proven by running under `GITHUB_USER=<a non-Arggon>`
      and under an unresolved identity
- [x] `cli/src/goal-mode.test.ts` green in CI (the run that found it, re-run)
- [x] Full suite, `test:structure`, `lint:structure`, `prettier --check` green
- [ ] Every other refusal case in this table audited for the same latent
      non-hermeticity — `GOAL_IDENTITY_UNKNOWN` and the `login: ""` cases are
      intentionally identity-dependent; the rest should pin it too
- [ ] Hermeticity of this table asserted structurally, so a future case cannot
      omit `login` silently: a test that fails when any case leaves the identity
      to the environment

## Notes

Unblocks release PR #664. Filed separately from the release because the same
class of defect — a check that passes locally and fails in CI for reasons the
check does not name — has cost this chain two red runs now.

### 2026-10-09 @arggon-delivery-lead

**Scope note:** the fix lands on its own branch and its own PR, not inside the
release PR. A release PR touches exactly five files by contract
(`spec-release-pipeline-015`), and a test-only change folded into a release bump
would both violate that and hide a real CI signal behind a version number.
