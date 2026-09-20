---
type: task
status: done
id: task-tracker-commit-ignored-nits
title: "Tracker-commit ignored[] nits: dedupe after normalization, fallback/exotic-path tests"
assignee: Arggon
branch: feat/task-tracker-commit-ignored-nits
parent: story-tracker-hygiene
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-19"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/task-tracker-commit-ignored-nits.md
  Leaves live only under a story. id is the filename stem: task-tracker-commit-ignored-nits.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Tracker-commit ignored[] nits: dedupe after normalization, fallback/exotic-path tests

## Context

Findings F1/F2/F4 from the independent review of PR #359
(`bug-init-ignored-artifacts-dirty-commit`).

- **F1**: `commit.ignored` can carry duplicates when one file reaches the
  primitive in two string forms (abs + root-relative): the dedupe at
  `cli/src/tracker-commit.ts:291` is exact-string while `rootRelativePaths`
  normalizes after. Partition stays correct; the array/human count overcount.
  No production caller mixes forms today — fix is one line
  (`[...new Set(rootRelativePaths(...))]`).
- **F2**: the probe-failure fallback (broken `check-ignore`) deliberately keeps
  the pre-fix behavior but has no automated test (mockable like the existing
  `vi.doMock` tests); a path starting with `:(` makes `check-ignore` die with
  pathspec magic → same fallback (wording nit: "paths may carry any character").
- **F4**: exotic path shapes (spaces/unicode/newline/backslash) are verified by
  probe only; pin them in a fixture.

## Acceptance

- [x] `ignored[]` deduped after normalization; test with abs+relative forms.
- [x] Fallback path covered by a mocked test; `:(` edge documented.
- [x] One fixture covering spaces/unicode/newline/backslash path shapes.
- [x] Full suite green; small PR to `opencode2`.

## Notes

- Robustness only; every production path is correct today.

### 2026-09-18 @Arggon
## Worker evidence (F1/F2/F4)

**F1 — dedupe AFTER normalization** (`[...new Set(rootRelativePaths(root, ...))]` in `commitTrackerMutation`):
- before (fix reverted, same fixture): `ignored: ["tasks/generated.bundle","tasks/generated.bundle"]`, human line `(2 ignored path(s) skipped)`
- after: `ignored: ["tasks/generated.bundle"]`, human line `(1 ignored path(s) skipped)`
- tests: "dedupes an ignored file passed in both absolute and root-relative forms" and "dedupes the all-ignored skip payload across string forms too" — both FAIL against the reverted implementation (mutation-verified).

**F2 — probe-failure fallback** (mocked `check-ignore` exit 128): result `{ committed: false, skipReason: "git add failed: The following paths are ignored by one of your .gitignore files:" }` + stderr warning; the non-ignored path is left staged and HEAD unmoved — the pre-fix degradation preserved, never silent. Real edge probe: a `:(badmagic)` input makes `git check-ignore --stdin -z` exit 128 → fallback (`git add failed: fatal: Invalid pathspec magic ...`). The `:(`-prefixed pathspec-magic exception is documented on `findIgnoredPaths` ("paths may carry any character except ...").

**F4 — exotic path fixture** (spaces/unicode/newline/backslash): `ignored: ["tasks/back\\slash.md","tasks/line\nbreak.md"]` byte-for-byte, `(2 ignored path(s) skipped)`, status clean, tracked exotic names in HEAD. Removing `-z` from the probe makes the test fail (line-split probe misses the newline file).

**Gates**: full suite 1281 tests / 76 files green (private TMPDIR), lint, build, `validate`, `spec validate` green.

### handoff 2026-09-18 @Arggon — next: Coordinator review of draft PR #363 (feat/task-tracker-commit-ignored-nits -> opencode2); on approval merge (do not squash: branch carries chore(tasks) auto-commits) and flip the item done.
- branch: feat/task-tracker-commit-ignored-nits
- open questions: None. Branch created by start is feat/... (prompt said fix/...); PR is draft by design.

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; F1 dedupe-after-normalization mutation-checked (revert → 2 failing tests, single-form parity intact), F2 mocked fallback pins the exact pre-fix degradation and the :( edge documented, F4 NUL fixture fails without -z with byte-for-byte exotic names; 1281 tests + CI pass; merged. Evidence count noted (1281). Closing.
