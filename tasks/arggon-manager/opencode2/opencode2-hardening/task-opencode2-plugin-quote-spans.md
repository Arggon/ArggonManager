---
type: task
status: done
id: task-opencode2-plugin-quote-spans
title: "Plugin quote-span integrity: multi-word quoted mentions correlate (splitTokens splits inside quotes)"
assignee: Arggon
branch: feat/task-opencode2-plugin-quote-spans
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-19"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-opencode2-plugin-quote-spans.md
  Leaves live only under a story. id is the filename stem: task-opencode2-plugin-quote-spans.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin quote-span integrity: multi-word quoted mentions correlate (splitTokens splits inside quotes)

## Context

Pre-existing (base == head) findings from the independent review of PR #352
(`task-opencode2-plugin-parse-nits`), which are actionable and contrived but
make the item's "nothing left as a live false positive" wording too broad.

- **F1 — quoted spans are not one token.** `splitTokens` splits on whitespace
  inside quotes, so only the first fragment carries the `word` flag:
  `"arggon show task-x"` → `task-x` (bash: `command not found`, 127);
  `command "arggon show task-x"`, `npm run "arggon show task-x"`,
  `x="line1\narggon show task-x"` all correlate non-executing mentions. Same
  root cause causes misses: `x="a b" arggon show task-x` → `undefined`
  (bash runs arggon). The docstring claims quoted spans stay one token.
  Fix: keep quoted spans intact in `splitTokens`; the `word` flag then
  delivers exactly what the docstring promises; tests for both directions.
- **F2 — escaped `\(` in command position.** `\(arggon show task-x)` and
  `X=1 \(arggon show task-x)` correlate a bash syntax error; mark any escaped
  `(` token as a word.
- **F3 — test/claim precision.** Rename (or make meaningful once F1 is fixed)
  the newline-in-quotes test; correct the overbroad "no live FP" claim.

## Acceptance

- [x] Quoted spans stay one token; the F1 true/miss matrix and F2 forms render
      `undefined`/correlate per bash ground truth, with tests.
- [x] Docstrings/claims accurate; no regression of the #337/#345/#352
      eliminations or true positives.
- [x] Full suite + `smoke:opencode` green; small PR to `opencode2`.

## Notes

- All contrived forms; the dominant invocations are covered.

### 2026-09-18 @Arggon
Worker evidence (F1/F2/F3). Files: `opencode/plugins/arggon/index.ts`, `opencode/plugins/arggon/index.test.ts` (36 tests = 34 + 2 new, 1 renamed); branch `feat/task-opencode2-plugin-quote-spans`.

Root cause: `splitTokens` pushed on whitespace even inside quotes, so a quoted span split into fragments and only the first carried `word`. Fix: whitespace splits only when `quote === null`; quoted spans (inner whitespace/newlines included) are one token. F2: a token that *starts* with an escaped `\(` is marked `word` (a mid-token `\(` stays assignment-safe, e.g. `X=a\(b arggon …` still correlates). Docstrings updated; the F3 newline test now proves the span stays intact.

Before→after probe (`parseArggonItemFromCommand`, 29 cases via `tsx`; before = 19f052c):

| input | before | after | bash ground truth |
| --- | --- | --- | --- |
| `"arggon show task-x"` | task-x | undefined | 127 command not found |
| `command "arggon show task-x"` | task-x | undefined | 127 command not found |
| `npm run "arggon show task-x"` | task-x | undefined | npm missing script |
| `x="line1\narggon show task-x"` | task-x | undefined | assignment executes nothing |
| `x="a b" arggon show task-x` | undefined | task-x | arggon runs (miss fixed) |
| `\(arggon show task-x)` | task-x | undefined | bash syntax error (exit 2) |
| `X=1 \(arggon show task-x)` | task-x | undefined | bash syntax error (exit 2) |

Preserved (probe green): direct/`VAR=1`/runners/wrappers (`npx`, `sudo -u`, `env -i`, `pnpm exec`)/`$(…)` including quoted substitution/quoted absolute path/`x="it's" arggon …`; eliminations `grep -rn "…"`, `echo "…"`, `git commit -m "…"`, `command -v`, `"(" arggon`, `"$(" arggon`, `echo '$(…)'`, `echo "&& arggon …"`, `echo \$(…)`. An extra 17-case probe is also green (quoted substitution inside a multi-word span, quoted span + `;`/`&&` with a real command, `x='…'`, wrapper + quoted span, `time -o … "arggon show task-x"`).

Bash cross-checks: stub `arggon` on PATH for true positives; `bash -c` rc 127 / 1 / 0 / 2 as tabulated.

Gates on 19f052c+fix: `npm test` → 73 files / 1220 tests pass (private TMPDIR); `npm run smoke:opencode` → 11 scenarios / 0 failures; lint, build, `arggon validate` (0/0), `arggon spec validate` (0/0) clean. No merge, no status flip.

F3 correction: the "nothing left as a live FP" wording in task-opencode2-plugin-parse-nits was too broad — quoted multi-word spans and escaped `\(` remained live false positives; a correction comment is filed on that item.

### handoff 2026-09-18 @Arggon (session: ses_f4987ad2effeUkIV0hlq0tL7K7) — next: Review draft PR #356 (base opencode2): F1 quoted spans one token (multi-word mention matrix + miss case), F2 escaped \( word, F3 newline test renamed + parse-nits claim correction. Gates green on 7a8…
- branch: feat/task-opencode2-plugin-quote-spans
- open questions: Extra probe found one pre-existing contrived FP outside this item: quoted-char prefix concatenated with an absolute path, e.g. '('/usr/local/bin/arggon show task-x, still correlates (commandHead spli…

### 2026-09-18 @Arggon
Review fix for PR #356 (NO-MERGE verdict; F1 + F2 test). Files: `opencode/plugins/arggon/index.ts`, `opencode/plugins/arggon/index.test.ts` (37 tests = 36 + 1 new F1 block; F2 mid-token assertion added).

F1 root cause: `commandHead` reduced every `word` token to its last `/`-segment, so a whitespace-bearing fused span matched (`"echo /usr/bin/arggon" show task-x` → task-x; bash 127). Fix: `commandName` keeps a whitespace-bearing token's whole text unless it is path-like (`/`, `./`, `../`, `~`), where the last-segment rule still applies. The same guard covers non-word fused prefixes (`my" tools/arggon"`, `x" /usr/bin/arggon"`), same FP class.

FP matrix (`parseArggonItemFromCommand`; bash truth via stub `arggon` on PATH; rc 127 = never runs):

| input | bash | base 19f052c | head a4e26d5 | fix 09b1291 |
| --- | --- | --- | --- | --- |
| `"echo /usr/bin/arggon" show task-x` | 127 | undefined | task-x | undefined |
| `"cat /usr/bin/arggon" show task-x` | 127 | undefined | task-x | undefined |
| `"vscode /home/u/bin/arggon" show task-x` | 127 | undefined | task-x | undefined |
| `my" tools/arggon" show task-x` | 127 | undefined | task-x | undefined |
| `x" /usr/bin/arggon" show task-x` | 127 | undefined | task-x | undefined |
| `"/opt/my tools/arggon" show task-x` | runs (execs the path) | undefined | task-x | task-x |
| `X=a\(b arggon show task-x` | runs | task-x | task-x | task-x |

No true-positive regressions (25-case probe green: direct/`VAR=`/runners/wrappers/`$(…)`/quoted absolute path/`x="it's"`/`"(" arggon`/`echo "…"` eliminations unchanged).

Gates on 09b1291: `npm test` → 73 files / 1221 tests pass (private TMPDIR); `npm run smoke:opencode` → 11 scenarios / 0 failures; lint, build, `arggon validate` (0/0), `arggon spec validate` (16 docs, 0 warnings) clean. No merge, no status flip.

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict NO-MERGE→fixed (09b1291: whitespace-bearing word tokens keep their whole text unless path-like, killing the "echo /usr/bin/arggon" FP class while keeping /opt/my tools/arggon; mid-token \( assertion added). Reviewer's FP matrix re-verified in the fix evidence (5 FP forms → undefined, legitimate path still correlates, 25-case regression green); plugin tests 37 + CI pass; merged. Pre-existing escape-edge forms filed as task-opencode2-plugin-escape-nits. Closing.
