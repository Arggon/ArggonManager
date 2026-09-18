---
type: task
status: done
id: task-opencode2-plugin-escape-nits
title: "Plugin escape-edge nits: escaped \\\\( in command position + unbalanced quoted paths correlate"
assignee: Arggon
branch: feat/task-opencode2-plugin-escape-nits
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-plugin-escape-nits
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-opencode2-plugin-escape-nits.md
  Leaves live only under a story. id is the filename stem: task-opencode2-plugin-escape-nits.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin escape-edge nits: escaped `\\(` in command position + unbalanced quoted paths correlate

## Context

F3 (pre-existing, base == current) from the independent review of PR #356
(`task-opencode2-plugin-quote-spans`), filed per the repo rule.

- `\\(arggon show task-x)` correlates but bash exits 2 on the syntax error
  (nothing runs) — the escaped-`$(` fix did not cover a double-escaped paren.
- `'(/usr/local/bin/arggon' show task-x` correlates but bash 127 (the unmatched
  quote makes a command name that does not exist).
- (Both are contrived shell-syntax-error inputs; the parser never yields a
  wrong id for executed commands.)

## Acceptance

- [x] Both forms render `undefined` (or the residual is explicitly documented
      as best-effort with rationale); tests added.
- [x] No regression of the quote-span/word semantics or the true positives.
- [x] Full suite + `smoke:opencode` green; small PR to `opencode2`.

## Notes

- Last known pre-existing parser edge class; everything else is covered by the
  #337/#345/#352/#356 fixes.

### 2026-09-18 @Arggon
Worker evidence (F3). Files: `opencode/plugins/arggon/index.ts`, `opencode/plugins/arggon/index.test.ts` (39 tests = 37 + 2 new); branch `feat/task-opencode2-plugin-escape-nits`.

Root causes: (1) `splitTokens` only treated an escaped `\(` at token start as a word, so `\\(arggon` let `commandHead` strip `\`+`(` back to `arggon`, and `findCommandGroups` opened a group at the `(` after an escaped backslash; bash ends a word on the escaped backslash and syntax-errors at the adjacent `(` (exit 2, nothing runs). (2) `commandName` reduced any slash-bearing word to its last path segment, so the quoted command word `(/usr/local/bin/arggon` (bash execs that pathname, exit 127) collapsed to `arggon`. Fixes: escaped-backslash state in `splitTokens`/`findCommandGroups` (the adjacent `(` is a word, never a group), and `commandName` now reduces only path-like (`/`, `./`, `../`, `~`) or plain-component paths; `SHELL_SYNTAX_IN_PATH` keeps quotes/expansions/grouping/globs/whitespace out of the reduction.

Before→after probe (`parseArggonItemFromCommand`, 35 cases via `tsx`; before = pre-fix worktree 38ff72a, after = worktree HEAD + fix):

| input                                  | before | after     | bash ground truth    |
| -------------------------------------- | ------ | --------- | -------------------- |
| `\\(arggon show task-x)`               | task-x | undefined | exit 2, nothing runs |
| `sudo \\(arggon show task-x)`          | task-x | undefined | exit 2               |
| `X=1 \\(arggon show task-x)`           | task-x | undefined | exit 2               |
| `echo \\(arggon show task-x)`          | task-x | undefined | exit 2               |
| 4-backslash variant                    | task-x | undefined | exit 2               |
| `'(/usr/local/bin/arggon' show task-x` | task-x | undefined | exit 127             |
| `"(/usr/local/bin/arggon" show task-x` | task-x | undefined | exit 127             |
| `my'(/usr/bin/arggon' show task-x`     | task-x | undefined | exit 127             |

Preserved (probe green): direct/`VAR=1`/bare + quoted absolute path/relative path (`node_modules/.bin/arggon`)/runners/wrappers/`$(…)` incl. quoted and the executed `\\$(…)` substitution/`"/opt/my tools/arggon"`/`X=a\(b arggon …`; eliminations `\(arggon`, `echo \$(…)`, quoted mentions/spans, `"(" arggon`, `"$(" arggon`, `"echo /usr/bin/arggon"`.

Documented residual (best effort, unchanged): a bare `(` in argument position (`echo (arggon …)`, `\\ (arggon …)`) syntax-errors in bash but is still followed as a group, like any unquoted `(` outside command position; the `parseArggonItemFromCommand` docstring now names it.

Bash cross-checks: stub `arggon` on PATH; byte-exact commands written from Python and run via `bash`; exit 2/127/0 and executed/no-hit as tabulated.

Gates on HEAD+fix: `npm test` → 74 files / 1240 tests pass (private TMPDIR); `npm run smoke:opencode` → 11 scenarios / 0 failures; lint, build, `arggon validate` (0/0), `arggon spec validate` (0/0) clean. Draft PR to `opencode2`; no merge, no status flip.

### handoff 2026-09-18 @Arggon (session: ses_f49700672ffeZXvF0u0iEzbWri) — next: Review draft PR #358 against base opencode2; on approval merge it, then complete the acceptance checklist and set task-opencode2-plugin-escape-nits to done. Worker did not merge and did not flip stat…
- branch: feat/task-opencode2-plugin-escape-nits

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; both target forms and variants fixed vs bash ground truth, path-like reductions preserved, true-positive matrix intact, tests additive (39), gates 1262 + smoke 11/11 + CI pass (after one unrelated ENOTEMPTY rerun); merged. Follow-ups filed: tracker-title-rescape (p2, the title doubling this PR surfaced), ci-enotempty-rmretry (p2, ENOTEMPTY under RM_RETRY), opencode2-plugin-parser-residuals (p3). The item's 'unchanged' residual wording is superseded by the residuals item. Closing.
