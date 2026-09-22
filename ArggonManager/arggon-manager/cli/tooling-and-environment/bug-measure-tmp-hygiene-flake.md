---
type: bug
status: in_progress
id: bug-measure-tmp-hygiene-flake
title: measure.test.ts /tmp hygiene races sibling suites
assignee: Arggon
branch: fix/bug-measure-tmp-hygiene-flake
parent: tooling-and-environment
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-22"
claimed_at: "2026-09-22T00:31:49.332Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-measure-tmp-hygiene-flake
---
<!--
  Placement (v0): tasks/arggon-manager/cli/tooling-and-environment/bug-measure-tmp-hygiene-flake.md
  Leaves live only under a story. id is the filename stem: bug-measure-tmp-hygiene-flake.
  CLI `arggon create bug measure-tmp-hygiene-flake` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# measure.test.ts /tmp hygiene races sibling suites

## Context

Found while validating PR #366 (`task-npm-packaging`) on 2026-09-19; the
reviewer confirmed it is pre-existing and unrelated to that PR:

- `cli/src/measure.test.ts` → "always deletes the measurement temp tree
  (/tmp hygiene)" fails when a sibling vitest suite runs concurrently on the
  same machine (shared `/tmp`). It passes isolated.
- Reproduced at base `6a03d8c` without the new test files, so it is not a
  regression.
- Symptoms: the hygiene assertion races `doctor --budget` / `measureBudget`
  temp trees and fixture subprocesses exit 1 under load; the failure depends
  on machine load and suite interleaving (observed with load average ~26 from
  parallel agents).

## Acceptance

- [x] The measurement temp tree is unique per test process/run (e.g.
      `fs.mkdtemp` under the repo or `$TMPDIR`) and the test never globs or
      deletes shared paths.
- [x] A regression test proves two concurrent runs (or two vitest workers)
      cannot interfere.
- [x] `npm test` green with a sibling suite running; the repro is documented on
      the item.
- [x] `arggon validate` green.

## Notes

- Pre-existing flake; not caused by PR #366 (`task-npm-packaging`).
- May be superseded by the `opencode2-native` redesign if the
  measure/doctor surface is rewritten; cancel with a comment then.

### 2026-09-22 @Arggon
Resolution (worker `Arggon`, branch `fix/bug-measure-tmp-hygiene-flake`, commit `05a825b`).

**Root cause.** `cli/src/measure.test.ts` "always deletes the measurement temp tree (/tmp hygiene)" globbed `${TMPDIR:-/tmp}/arggon-budget-*` with `ls -d` and asserted the result was empty. `measureBudget()` was already per-run (`mkdtemp` + `finally rmSync`), but the glob also matched every _sibling_ suite's in-flight tree on the same machine, so the assertion failed whenever another session's measurement tree existed at that instant (load-dependent; the PR #366 flake).

**Fix (2 files).**

- `cli/src/measure.ts`: new `createMeasurementTree(tmpRoot = os.tmpdir())` → `mkdtempSync(join(tmpRoot, "arggon-budget-<pid>-"))`; `measureBudget(options?)` uses it and accepts an optional `tmpRoot`. Every run owns exactly one path (unique per run, pid-visible) and removes exactly that path — no glob.
- `cli/src/measure.test.ts`: the hygiene test now asserts on a private root it owns (`readdirSync(root)` empty), never globbing/deleting shared paths. New tests: (1) `createMeasurementTree` returns distinct per-run paths under the root; (2) race regression — two concurrent `measureBudget()` runs share one root while a foreign in-flight tree exists: both complete, the foreign tree survives untouched, only own trees are removed.

**Repro (before).** Two concurrent `npx vitest run cli/src/measure.test.ts` (staggered 2.6 s) at base commit `9d77619`: both failed with `AssertionError: expected '/tmp/arggon-budget-AFsh0G' to be ''` — the sibling run's in-flight tree.

**After.** Same two concurrent runs, fixed code: both exit 0, hygiene test green ("private root; no shared-path globbing"). Full suite while a sibling `measure.test.ts` loop ran concurrently: `npm test` → 92 files / 1492 tests passed (61.87 s).

**Falsification.** With `createMeasurementTree` temporarily forced to a shared path, the two new tests fail (unit: `first === second`; race: the sibling run's `arggon create initiative` exits 1) — the regression tests bite.

**Gates.** `npm test` 92/1492 green (sibling suite running); `npm run lint` clean; `npm run build` clean (plugin bundle unchanged); `npx prettier --check` clean; `arggon validate` ok (0 warnings, convention v5). Smoke probe: `doctor --json --budget` from an adopter tree → `ok:true`, budget present, tree `arggon-budget-<pid>-XXXXXX` created and removed.

**Files.** `cli/src/measure.ts`, `cli/src/measure.test.ts` — no public CLI flag or JSON-payload change (`BudgetResult` untouched).
