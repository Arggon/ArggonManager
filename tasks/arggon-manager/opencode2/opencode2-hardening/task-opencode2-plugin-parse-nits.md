---
type: task
status: done
id: task-opencode2-plugin-parse-nits
title: "Plugin parser edge cases: escaped $( opener, contrived openers, stateful quote tokens, depth/comment tests"
assignee: Arggon
branch: feat/task-opencode2-plugin-parse-nits
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
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

### 2026-09-18 @Arggon
Worker evidence for F-A..F-D (PR #345 review). Draft PR: #352 (base `opencode2`), branch `feat/task-opencode2-plugin-parse-nits`. Files: `opencode/plugins/arggon/index.ts`, `opencode/plugins/arggon/index.test.ts` (34 tests = 27 + 7 new).

Parse probe before→after (`before` = branch point `de667a5`, `after` = `ca65ddf`; 40 cases via `tsx` against the exported `parseArggonItemFromCommand`); delta rows:

```text
input                                            | before    | after
echo \$(arggon show task-x)  (bash syntax error) | task-x    | undefined
\$(arggon show task-x)       (bash syntax error) | task-x    | undefined
command -v arggon show task-x                    | task-x    | undefined
command -V arggon show task-x                    | task-x    | undefined
command -pv arggon show task-x                   | task-x    | undefined
"(" arggon show task-x                           | task-x    | undefined
'(' arggon show task-x                           | task-x    | undefined
"$(" arggon show task-x                          | task-x    | undefined
"x=1" arggon show task-x                         | task-x    | undefined
x="it's" arggon show task-x                      | undefined | task-x
```

Unchanged anchors: `arggon show task-x --json`, `arggon handoff "task-x"`, `npx`/`sudo -u`/`command`/`command -p`/`command --`/`time (`, `( arggon show task-x)`, `echo "$(arggon show task-x)"`, `x="it's"; arggon show task-x`. Negatives stay negative: `echo "&& arggon show task-x"`, `grep -rn "arggon show task-x"`, `echo "arggon update task-fake"`, `git commit -m "arggon handoff task-x"`, `# note && arggon show task-x`.

Bash cross-checks: `bash -n -c 'echo \$(arggon show task-x)'` → exit 2; `'\$(arggon show task-x)'` → exit 2; `x=\$(arggon show task-x)` → exit 2; `"(" arggon show task-x` parses but runs a command named `(`; stub `arggon()` prints `EXECUTED show task-x` for `x="it's" arggon show task-x`.

Decisions: F-A fixed in both paths (group + token word); F-B fixed (name queries and quoted opener/assignment words), nothing left as a live FP; F-C stateful quotes (the item's `echo "it's" …` example runs only `echo`, so it correctly stays `undefined` — the miss was the assignment form); F-D tests plus exported `MAX_SUBSTITUTION_DEPTH`. Docstrings updated, no playbook change needed.

Gates on merged tree `2b6fd43`: `npm test` → 73 files / 1211 tests pass (private TMPDIR); `npm run smoke:opencode` → 11 scenarios / 0 failures; lint, build, `arggon validate` (0/0), `arggon spec validate` (0/0) clean. No merge, no status flip.

### handoff 2026-09-18 @Arggon (session: ses_f4a703652ffe9qo36Nf8Crwoig) — next: Review draft PR #352 (base opencode2): F-A escaped \$( opener, F-B command -v + quoted opener/assignment words, F-C stateful token quotes, F-D depth/comment/newline/wrapper-value tests. Gates green o…
- branch: feat/task-opencode2-plugin-parse-nits

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; all four findings fixed and matched against bash ground truth (escaped $() in both paths, command -v/-V/-pv as queries, quoted openers/assignments as words with quoted paths still correlating, stateful quote tokens incl. the corrected F-C example, depth/comment/value-option tests); 69-case independent probe: 13 intent-changing deltas in the claimed directions + 1 FP elimination, zero new false positives, #337/#345 regressions intact; smoke 11/11 + CI pass; merged. Pre-existing quote-span/escaped-\( forms filed as task-opencode2-plugin-quote-spans. Closing.
