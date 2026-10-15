---
type: task
status: in_progress
id: task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters
title: "init/adopt: report-only .arggon.env gitignore hint for adopters"
assignee: arggon-delivery-lead
branch: feat/task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: []
created: "2026-10-02"
updated: "2026-10-15"
claimed_at: "2026-10-15T01:53:35.919Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters.md
  Leaves live only under a story. id is the filename stem: task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters.
  CLI `arggon create task initadopt-report-only-arggonenv-gitignore-hint-for-adopters` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init/adopt: report-only .arggon.env gitignore hint for adopters

## Context

Decision recorded on bug-gitignore-missing-arggon-env (2026-10-02): `init`/`adopt`
must never silently rewrite an adopter's existing `.gitignore`, but a bare
documented hand-step proved insufficient -- this repo adopted before the
worktree-env-contract-016 template shipped and never gained the entry
(bug-gitignore-missing-arggon-env). The contract should tell adopters the
expected one-line append without touching their file.


## Acceptance

- [ ] `arggon init`, `arggon adopt`, and/or `arggon doctor` report (stdout +
      `--json` note) when the repo's tracked `.gitignore` lacks a `.arggon.env`
      ignore entry, naming the contract (spec worktree-env-contract-016) to explain.
- [ ] The report is strictly report-only: no file is written, modified, or staged.
- [ ] spec-worktree-env-contract-016 documents the adopter hand-step (the exact
      line to append) so existing repos know what to add.
- [ ] Test/fixture coverage for the report path (init/adopt test with an
      existing adopter `.gitignore` missing the entry).


## Notes

### 2026-10-15 @arggon-maker
Maker evidence — PR [#831](https://github.com/Arggon/ArggonManager/pull/831), branch `feat/task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters`.

**Surface decision.** All three surfaces report the missing entry, from one shared probe (`cli/src/env-gitignore.ts`, `readEnvGitignore`):

- `doctor` — the standing report (any tree, any time): catches repos that adopted before the template shipped.
- `adopt` — the adoption moment; `runAdopt` already runs doctor as pre-flight and reuses `doctor.envGitignore`, so there is one read and no second source that could disagree.
- `init` — the scaffold/re-run moment; an adopter `.gitignore` is modified-skip (never rewritten), so init must report rather than silently leave the hole. The probe runs AFTER the run's writes, so a generated `.gitignore` (entry present) is clean and an adopter's kept one reports.

**Probe semantics.** The repo's own `.gitignore` bytes are the source of truth (bare, root-anchored and `**`-prefixed patterns; file order, so a later `!.arggon.env` un-ignores). Deliberately NOT `git check-ignore`: a machine-local or global exclude would hide the missing entry from every other clone — the exact adopter failure this hint exists for. No `.gitignore` → no hint (a fresh `init` generates one that carries the entry).

**Hint text (constant, shared).** `the tracked .gitignore does not ignore .arggon.env — append the line `.arggon.env` (spec worktree-env-contract-016: per-worktree machine state written by `arggon start --worktree`; never commit it). Report-only: arggon does not edit your .gitignore`

**JSON (additive, `schemaVersion: 1`).** `envGitignore: { path, present, ignores, hint }` on the success envelopes of `init` (also `--dry-run` / `--propose`), `doctor` (initialized and uninitialized shapes) and `adopt`. stdout: `arggon init: hint: …` on init, `  hint: …` on doctor/adopt.

**Strictly report-only — expected vs observed.** Fixture `/tmp/opencode/envhint-demo` with tracked `.gitignore` = `node_modules/\n`:

- `arggon init` → stdout hint line; `.gitignore` bytes after the run: `node_modules/` (unchanged); `init --json` carries `ignores:false` + hint.
- `arggon doctor` / `adopt --json` → same hint; bytes unchanged.
- Append `.arggon.env` → `doctor --json` reports `{"path":".gitignore","present":true,"ignores":true,"hint":null}` (negative).
- Fresh tree (no `.gitignore`): `init --dry-run --json` → `present:false, hint:null`; this repo's own tree → `ignores:true, hint:null`.
- Test assertions: `init.test.ts` asserts bytes unchanged + `git status --porcelain` empty after the auto-commit + `git diff HEAD -- .gitignore` empty.

**Files.** `cli/src/env-gitignore.ts` (new) + `cli/src/env-gitignore.test.ts` (new); `cli/src/init.ts` / `init.test.ts`; `cli/src/adopt.ts` / `adopt.test.ts`; `cli/src/doctor.ts` / `doctor.test.ts`; `cli/src/cli.ts` (output wiring only); `ArggonManager/docs/specs/spec-worktree-env-contract-016.md` (adopter hand-step, exact line); `ArggonManager/docs/json-output.md` (field documented on all three commands).

**Gates (worktree, all green).**

- `npm run arggon -- validate` → ok (0 warnings, convention v5)
- focused `npx vitest run cli/src/env-gitignore.test.ts cli/src/init.test.ts cli/src/adopt.test.ts cli/src/doctor.test.ts` → 4 files, 160 tests passed
- `npm run build` + `npm test` → 159 files, 3494 tests passed
- `npm run lint` → clean; `npm run test:structure` → 5 ast-grep rules passed (exit 0)
- `npx prettier --check` on every touched file → clean; `json-output.md` byte-stable under a second `--write` (prose-format convergence rules)

### handoff 2026-10-15 @arggon-maker — next: Standards review + merge PR #831 (all gates green); then verify the 4 acceptance boxes and flip done — completion is the delivery lead's call.
- branch: feat/task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters
- open questions: none — surface decision (all three, one shared probe) and report-only evidence are in the PR body and the evidence comment

### 2026-10-15 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead review + merge verification — 2026-10-14 (delivery lead)
Merged as 08e1447d (PR #831). The hint ships report-only on all three surfaces from ONE shared probe (`cli/src/env-gitignore.ts`): doctor (standing), adopt (the adoption moment, reusing the pre-flight doctor read), init (after its writes, so a generated `.gitignore` is clean). The probe reads the repo's OWN `.gitignore` bytes — deliberately not `git check-ignore`, so a machine-local exclude cannot hide the missing entry from other clones; file order handles a later `!.arggon.env` un-ignore; no `.gitignore` at all → no hint (fresh init generates one that carries the entry).

Report-only verified: unchanged bytes and clean `git status`/`git diff` after init/doctor/adopt; the additive `envGitignore:{path,present,ignores,hint}` rides all three `--json` envelopes; spec-016 documents the exact hand-step line; `json-output.md` documents the field on the three commands. Evidence: `env-gitignore.test.ts` + init/adopt/doctor test additions (maker's focused 160, full 3494); CI green on all lanes on the refreshed head. Recorded limitation: patterns that cover the file indirectly (e.g. `*.env`) are not detected — the probe is scoped to the canonical anchored forms (module docstring); the hint only ever asks for the canonical line.
