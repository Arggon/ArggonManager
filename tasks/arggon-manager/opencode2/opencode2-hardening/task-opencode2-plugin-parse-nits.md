---
type: task
status: in_progress
id: task-opencode2-plugin-parse-nits
title: "Plugin parser edge cases: escaped $( opener, contrived openers, stateful quote tokens, depth/comment tests"
assignee: Arggon
branch: feat/task-opencode2-plugin-parse-nits
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T17:28:20.446Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-plugin-parse-nits
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-opencode2-plugin-parse-nits.md
  Leaves live only under a story. id is the filename stem: task-opencode2-plugin-parse-nits.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin parser edge cases: escaped `$(` opener, contrived openers, stateful quote tokens, depth/comment tests

## Context

Non-blocking findings from the independent review of PR #345
(`task-opencode2-plugin-nits`), filed per the repo rule.

- **F-A (new FP, contradicts the docstring).** `findCommandGroups` consumes an
  escaped `$` but still treats the following `(` as an unescaped opener:
  `echo \$(arggon show task-x)` correlates although bash syntax-errors on that
  input (nothing executes). Docstring claims "escaped openers are skipped".
  One-line fix: when the escaped char was `$`, consume a following `(` (or mark
  it escaped); test.
- **F-B (contrived FPs).** `command -v arggon show task-x` and
  `"(" arggon show task-x` correlate non-executing forms. Decide: fix or
  document as best-effort.
- **F-C (miss-only, claim mismatch).** `splitTokens` handles `'` regardless of
  an open double quote, unlike `splitSegments`/`findCommandGroups`:
  `echo "it's" arggon show task-x` → `undefined` while bash executes `arggon`.
  Make token quote handling stateful like the segment splitter; tests.
- **F-D (test gaps).** No tests for `MAX_SUBSTITUTION_DEPTH`, `#` comment
  dropping, newline-inside-quotes, or wrapper value options beyond `sudo -u`
  (`env -u`, `time -o`).

## Acceptance

- [x] F-A fixed with a test (`echo \$(arggon …)` → `undefined`), docstring
      accurate.
- [x] F-B decided (fixed: `command -v/-V` queries and quoted opener/assignment
      words; nothing documented as a live false positive).
- [x] F-C fixed with stateful token quotes + tests for both quote styles.
- [x] F-D tests added.
- [x] Full suite + `smoke:opencode` green; small PR to `opencode2`.

## Notes

- All one-sided or contrived: the parser never yields a wrong id for executed
  commands, and the dominant forms are covered.
