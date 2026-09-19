---
type: bug
status: todo
id: bug-measure-tmp-hygiene-flake
title: "measure.test.ts /tmp hygiene races sibling suites"
parent: tooling-and-environment
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-19"
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

- [ ] The measurement temp tree is unique per test process/run (e.g.
      `fs.mkdtemp` under the repo or `$TMPDIR`) and the test never globs or
      deletes shared paths.
- [ ] A regression test proves two concurrent runs (or two vitest workers)
      cannot interfere.
- [ ] `npm test` green with a sibling suite running; the repro is documented on
      the item.
- [ ] `arggon validate` green.

## Notes

- Pre-existing flake; not caused by PR #366 (`task-npm-packaging`).
- May be superseded by the `opencode2-native` redesign if the
  measure/doctor surface is rewritten; cancel with a comment then.
