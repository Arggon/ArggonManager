---
type: task
status: in_progress
id: task-opencode2-plugin-nits
title: "Plugin parsing nits: wrapper-prefixed invocations + playbook W3 bullet"
assignee: Arggon
branch: feat/task-opencode2-plugin-nits
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T16:15:21.510Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-plugin-nits
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-opencode2-plugin-nits.md
  Leaves live only under a story. id is the filename stem: task-opencode2-plugin-nits.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin parsing nits: wrapper-prefixed invocations + playbook W3 bullet

## Context

Non-blocking findings from the independent review of PR #337
(`task-opencode-v2-plugin-hardening`), filed per the repo rule.

- **F1 — over-anchoring drops realistic invocations.** The command-position
  parser misses `npx/bunx/sudo/env/command/time arggon …`, `x=$(arggon …)`,
  subshells, and newline-separated commands (the old parser caught most).
  Impact is one-sided (a missed observation, never a wrong id) and the dominant
  forms remain covered; extend `argCommandIndex` (skip wrapper prefixes, add
  runners, split on `\n`) **or** widen the best-effort docstring, with tests.
- **F2 — quoted separators still correlate.** Splitting on `;&|` happens before
  quote stripping, so `echo "&& arggon show task-x"` yields an id (contrived,
  pre-existing). Eliminate or document.
- **F4 — playbook W3 bullet incomplete (not false).** Add the anchoring,
  best-effort `arggon_*` regex, bounded/project-scoped caches, and the smoke
  `block=` independent measurement to `docs/playbooks/opencode.md`.

## Acceptance

- [ ] Wrapper-prefixed / `$()` / newline-separated invocations correlate again
      (tests), or the docstring documents exactly which forms are best-effort.
- [ ] Quoted-separator case eliminated or documented; the "quoted-string false
      positives eliminated" claim is precise.
- [ ] Playbook W3 bullet updated with anchoring, cache bounds, and smoke
      measurement.
- [ ] Full suite + `smoke:opencode` green; small PR to `opencode2`.

## Notes

- None of these block; the merged parser is conservative by design.

### 2026-09-18 @Arggon
**Worker evidence — F1/F2/F4** (draft PR https://github.com/Arggon/ArggonManager/pull/345)

- **F1** — `argCommandIndex` now sees through `npx`/`bunx`/`sudo`/`env`/`command`/`time` (value options consumed) and `$(`/`(` openers, and recognizes `run|exec|dlx` for `npm|pnpm|yarn|bun`; `parseArggonItemFromCommand` splits quote-aware segments (newlines split; `;`/`&`/`|` inside quotes do not; `#` comments dropped) and follows `$(…)`/subshell groups (quote-aware, depth ≤ 3); `splitTokens` keeps quoted spans as one token.
- **F2** — quoted separators and single-quoted `$(…)` are inert; `echo "&& arggon show task-x"` no longer yields an id.
- **F4** — `docs/playbooks/opencode.md` W3 bullet + Conventions "session context": command-position anchoring and wrapper coverage, best-effort raw-source `arggon_*` regex, bounded caches (256, oldest-first) with project-directory-scoped item cache, and the smoke `block=` independent byte measurement.

Parse probe before→after (`before` = `f8bd266`, `after` = `d4969f1`): 38 cases, 20 changed. Full matrix (`before` column then `after` column):

```text
W npx                        | "npx arggon show task-x"                                       | undefined    | task-x
W bunx                       | "bunx arggon show task-x"                                      | undefined    | task-x
W sudo                       | "sudo arggon show task-x"                                      | undefined    | task-x
W sudo -u root               | "sudo -u root arggon update task-x --status in_progress"       | undefined    | task-x
W env VAR=1                  | "env ARGON_QUIET=1 arggon show task-x"                         | undefined    | task-x
W env -i                     | "env -i arggon show task-x"                                    | undefined    | task-x
W command                    | "command arggon show task-x"                                   | undefined    | task-x
W time                       | "time arggon show task-x"                                      | undefined    | task-x
W time -p                    | "time -p arggon show task-x"                                   | undefined    | task-x
W npx --yes npm run          | "npx --yes npm run arggon -- show task-x"                      | undefined    | task-x
W pnpm exec                  | "pnpm exec arggon show task-x"                                 | undefined    | task-x
S x=$(...)                   | "x=$(arggon show task-x)"                                      | undefined    | task-x
S echo "$(...)"              | "echo \"$(arggon show task-x)\""                               | undefined    | task-x
S (arggon ...)               | "(arggon show task-x)"                                         | undefined    | task-x
S (cd repo; arggon ...)      | "(cd repo; arggon show task-x)"                                | undefined    | task-x
S nested                     | "echo $(echo $(arggon show task-x))"                           | undefined    | task-x
N newline before             | "cd repo\narggon show task-x"                                  | undefined    | task-x
N newline after              | "arggon show task-x\narggon update task-y"                     | task-x       | task-x
Q echo "&& ..."              | "echo \"&& arggon show task-x\""                               | task-x       | undefined
Q echo '; ...'               | "echo '; arggon show task-x'"                                  | task-x       | undefined
Q echo "(arggon ...)"        | "echo \"(arggon show task-x)\""                                | undefined    | undefined
Q echo '$(arggon ...)'       | "echo '$(arggon show task-x)'"                                 | undefined    | undefined
Q true positive + quoted     | "echo \"&& arggon show task-fake\" && arggon show task-x"      | task-fake    | task-x
P grep -rn                   | "grep -rn \"arggon show task-x\" ."                            | undefined    | undefined
P echo quoted                | "echo \"arggon update task-fake\""                             | undefined    | undefined
P git commit -m              | "git commit -m \"arggon handoff task-x\""                      | undefined    | undefined
P echo bare                  | "echo arggon show task-x"                                      | undefined    | undefined
P cd && grep                 | "cd repo && grep arggon show task-x"                           | undefined    | undefined
P sudo echo quoted           | "sudo echo \"arggon show task-x\""                             | undefined    | undefined
P time grep                  | "time grep arggon show task-x"                                 | undefined    | undefined
P npx grep -rn               | "npx grep -rn \"arggon show task-x\" ."                        | undefined    | undefined
T bare                       | "arggon show task-x --json"                                    | task-x       | task-x
T npm run                    | "npm run arggon -- update task-x --status in_progress"         | task-x       | task-x
T cd && abs path             | "cd repo && /usr/local/bin/arggon comment bug-login-500 'note'" | bug-login-500 | bug-login-500
T VAR=1                      | "ARGON_QUIET=1 arggon show task-x"                             | task-x       | task-x
T pnpm run                   | "pnpm run arggon -- show task-x"                               | task-x       | task-x
T -q flag                    | "arggon -q start task-x --worktree"                            | task-x       | task-x
T handoff quoted id          | "arggon handoff \"task-x\" --next \"go\""                      | task-x       | task-x

38 cases, 20 changed
```

Gates on `d4969f1`: `npm test` → 70 files / 1166 tests pass; `npm run smoke:opencode` → 11 scenarios / 0 failures (incl. independent `block=` measurement); `npm run lint` clean; `npm run build` clean; `arggon validate` ok (0 errors/0 warnings); `arggon spec validate` ok. Environmental note: one earlier full-suite run failed `cli/src/measure.test.ts`'s global `/tmp` hygiene check (`/tmp/arggon-budget-*`) while two sibling worktrees ran the same suite concurrently — green in isolation and on a quiet full run. No smoke/**, cli/src/** or other docs touched; no merge, no status flip.

### handoff 2026-09-18 @Arggon (session: ses_f4ab32847ffe5hahI8SSkOw3Rh) — next: Review draft PR #345 (base opencode2): F1 wrapper/$()/newline correlation, F2 quoted separators, F4 playbook W3 bullet. Gates already green on d4969f1 (suite 1166, smoke 11/11, lint/build/validate). …
- branch: feat/task-opencode2-plugin-nits
