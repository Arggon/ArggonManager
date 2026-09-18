---
type: task
status: in_progress
id: task-opencode2-plugin-parser-residuals
title: "Plugin parser residuals: SHELL_SYNTAX_IN_PATH false negatives, odd-backslash heads, residual pins"
assignee: Arggon
branch: feat/task-opencode2-plugin-parser-residuals
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T22:27:03.248Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-plugin-parser-residuals
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-opencode2-plugin-parser-residuals.md
  Leaves live only under a story. id is the filename stem: task-opencode2-plugin-parser-residuals.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin parser residuals: SHELL_SYNTAX_IN_PATH false negatives, odd-backslash heads, residual pins

## Context

Findings 1–3 from the independent review of PR #358
(`task-opencode2-plugin-escape-nits`).

- **New conservative false negatives.** `SHELL_SYNTAX_IN_PATH` rejects `#`,
  `!`, glob chars and empty components, but those are literal in unquoted (or
  quoted) words and `//` collapses: `dir#x/arggon`, `'dir*x/arggon'`,
  `dir!x/arggon`, `a//b/arggon` all execute in bash yet are `undefined` now
  (were `task-x`). Narrow the class to characters that actually break path
  semantics (quotes/backslash/whitespace/`$`/backtick/grouping) or document.
- **Odd-backslash heads (pre-existing).** `\\\(arggon …` (3) and `\\\\\(arggon
  …` (5) still correlate though bash exits 2 (nothing runs); extend the
  word-marking or document the residual.
- **Residual wording/pins.** The item's "unchanged" note is wrong: `\\( (arggon
  …)` changed `undefined`→`task-x` and bash syntax-errors. Pin the residual
  class (`\\( (…)`, `echo (…)`, `\\((…))`) with tests and fix the wording.

## Acceptance

- [x] The four false-negative forms correlate again (or the narrower class is
      documented) with tests; no regression of the true positives or the
      #337/#345/#352/#356/#358 eliminations.
- [x] Odd-backslash heads fixed or documented; residual pins added.
- [x] Full suite + `smoke:opencode` green; small PR to `opencode2`.

## Notes

- Miss-only or contrived; the plugin's declared bias (misses harmless, FPs not)
  makes this low priority.

### 2026-09-18 @Arggon
### Evidence — parser residuals (review findings 1–3 of PR #358)

Files: `opencode/plugins/arggon/index.ts`, `opencode/plugins/arggon/index.test.ts`.
Branch head before commit: `34a482b`; probes run against a copy of the pre-fix source vs. the patched source (`tsx`), bash ground truth via `bash -c` in a temp dir with an executable stub (prints `RAN arggon`, exit 0).

**Finding 1 — narrow `SHELL_SYNTAX_IN_PATH`.** Dropped `#`, `!`, glob chars (`*?[]`) and the empty-component rejection; the class now keeps only word-breaking syntax (whitespace, backslash, quotes, `$`, backtick, `(){}`, `<`/`>` and escaped/quoted `;|&`). `isPlainPath` allows collapsed `//` components; the docstring states the narrowed class and why.

| probe input                           | before    | after     | bash ground truth             |
| ------------------------------------- | --------- | --------- | ----------------------------- |
| `dir#x/arggon show task-x`            | undefined | task-x    | exit 0, stub ran              |
| `'dir*x/arggon' show task-x`          | undefined | task-x    | exit 0, stub ran              |
| `dir!x/arggon show task-x`            | undefined | task-x    | exit 0, stub ran              |
| `a//b/arggon show task-x`             | undefined | task-x    | exit 0, stub ran              |
| `dir\*x/arggon show task-x`           | undefined | task-x    | exit 0 (literal path)         |
| `dir\#x/arggon show task-x`           | undefined | task-x    | exit 0 (literal path)         |
| `x>arggon`, `x<arggon`                | undefined | undefined | exit 127, redirect, no arggon |
| `x\;arggon`, `x\|arggon`, `x\&arggon` | undefined | undefined | exit 127, literal word        |
| `dir\ x/arggon`, `a/arggon/`          | undefined | undefined | 127 / 126, no arggon          |

**Finding 2 — odd-backslash heads.** `splitTokens` now marks an escaped backslash as a word when it starts the token (previously only before `(`), so `\\arggon` (127) and the 3/5/7-backslash `\(` runs (exit 2) never reduce to `arggon`; mid-token escapes still stay assignment text.

| probe input                       | before | after     | bash ground truth    |
| --------------------------------- | ------ | --------- | -------------------- |
| `\\\(arggon show task-x)` (3)     | task-x | undefined | exit 2, nothing runs |
| `\\\\\(arggon show task-x)` (5)   | task-x | undefined | exit 2, nothing runs |
| `\\\\\\\(arggon show task-x)` (7) | task-x | undefined | exit 2, nothing runs |
| `\\arggon show task-x` (2)        | task-x | undefined | exit 127             |
| `sudo \\arggon` / `X=1 \\arggon`  | task-x | undefined | nothing runs         |
| `X=a\\b arggon show task-x`       | task-x | task-x    | exit 0, arggon ran   |

**Finding 3 — residual pins + wording.** New test block pins `\\( (arggon …)`, `echo (arggon …)`, `\\((arggon …))` as the documented miss-side residual (bash exit 2; the lexer still follows the group). The stale "unchanged" wording is corrected: the `parseArggonItemFromCommand` docstring names the class and notes it is pinned by tests — the escape-nits change did flip `\\( (…)` from undefined to task-x, and the item/PR wording said otherwise.

**Regression set.** 71-case before→after probe: only the 16 intended lines changed. 20 true positives unchanged (`arggon`, absolute/relative/`//` paths, quoted spaces, `VAR=1`, wrappers, runners, `$(…)`, `echo \\$(…)`, `(arggon …)`, `X=a\(b arggon …`, `X=a\\b arggon …`, `git status && arggon`); all #337/#345/#352/#356/#358 eliminations unchanged (`\\(arggon`, escaped `\$(`, quoted mentions/spans, `"(" arggon`, `"$(" arggon`, `"echo /usr/bin/arggon"`, `'(/usr/local/bin/arggon'`, `command -v`, `#` comments).

**Gates.** focused `opencode/plugins/arggon/index.test.ts` 42/42; full suite 75 files / 1265 tests green (private TMPDIR); `npm run lint` green; `npm run build` green; `arggon validate` ok 0 warnings; `arggon spec validate` ok (16 docs, 0 warnings); `npm run smoke:opencode` 11 scenarios, 0 failures.
