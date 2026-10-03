---
type: bug
status: done
id: bug-spec-analyze-does-not-detect-duplicate-doc-numbers
title: "`arggon spec analyze` / `validate` cannot detect two documents sharing one number (ADR 0020 x2, exploration -018 x2, spec/plan -017 x2) — git merges them silently"
assignee: Arggon
parent: story-spec-pipeline
labels: [spec-pipeline, adr]
created: "2026-10-02"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-spec-analyze-does-not-detect-duplicate-doc-numbers.md
  Leaves live only under a story. id is the filename stem: bug-spec-analyze-does-not-detect-duplicate-doc-numbers.
  CLI `arggon create bug spec-analyze-does-not-detect-duplicate-doc-numbers` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `arggon spec analyze` / `validate` cannot detect two documents sharing one number (ADR 0020 x2, exploration -018 x2, spec/plan -017 x2) — git merges them silently

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [x] A number collision is detected: at minimum for ADR, exploration, spec and plan directories, given the same numeric stem under two different slugs
- [x] Report-only first (consistent with `spec analyze`'s contract): a clear finding naming both files, never an edit; a blocking gate only if it proves low-noise, same rule as C2 in exploration-014
- [x] The finding survives a merge — i.e. it is a whole-directory scan, not a per-file uniqueness check keyed on `kind:docId` (read `spec.ts:280-297` for the current approach and its limit)
- [x] A fixture with a duplicate-number pair asserts the finding (the repo convention is one failing fixture per layout rule)
- [x] `docs/agents.md` / the spec pipeline section documents the collision rule, so an author numbering a doc picks the next FREE number rather than assuming the last one is taken

## Notes

### 2026-10-03 @ses_f00dc70adffefsMeckic5zKzLx
### 2026-10-03 @Reviewer
verdict: approve (scope, shared rule, report-only contract and impact class all check out; three minor findings are owned by follow-ups, none in this PR's change surface)

Reviewed PR #603 (`fix/bug-spec-analyze-does-not-detect-duplicate-doc-numbers`, head `20a76894`) against `ArggonManager/docs/engineering.md` §Review bar. Read-only review: item body + worker notes, `git diff origin/main...HEAD` (18 files, +636/−18), `cli/src/spec.ts`, `cli/src/spec-doc-numbers.test.ts`, the fixture tree, `cli/src/cli.ts`, the CI workflow, the pre-commit hook, the live `ArggonManager/docs/{adr,explorations,specs,plans}` corpora and both committed analyze baselines, plus `gh pr checks 603`. I did not run gates or smokes; independent probe commands are at the end for the prover.

**CI:** `cli` pass (5m44s), `tasks-validate` pass (10s), `ui-smoke` pass (2m5s) — all three green on the merged head. (Still in progress when I first checked; re-read after the run settled.)

#### 1. It is a whole-directory scan, and the per-directory conventions parse correctly

`docNumberCollisions(root)` (`cli/src/spec.ts:372-392`) builds one `Map<number, files[]>` per directory from `listMarkdownDocs(join(docsDir, dir))` over `adr | explorations | specs | plans`. It reads no id, no frontmatter and carries no state between runs, so the merge that defeats `checkUniqueness` (`spec.ts:280-297`) cannot defeat it — the collision is re-derived from the tree on every call. `spec-doc-numbers.test.ts:240-252` pins exactly that (write `0020-alpha.md` → no finding; add `0020-beta.md` → one finding naming both). Bucketing is per directory, so `adr/0020` and `spec-x-020` never collide — which matches the "a spec and a plan may both be `-017`" rule the same PR adds to `docs/agents.md`.

The one table (`DOC_NUMBER_SOURCES`, `spec.ts:329-334`) carries the four layouts. I replayed all four patterns against the live corpora and against 24 adversarial names (python mirrors of the JS regexes, `\Z` for JS `$`; no project code executed):

- `0021-gamma.md` → 21; `0007-mcp-2026-07-28-adoption.md` → 7. The ADR number is a **prefix**, so a digit-bearing slug can never be mistaken for it — the "greedy slug" argument is only load-bearing for the other three, and there it holds: `spec-phase-2-009.md` → 9, `plan-sync-2-003.md` → 3, `exploration-mcp-2026-07-28-004.md` → 4, `spec-abc2-010.md` → 10 (slug ending in digits), `spec-007-007.md` → 7, `exploration-sync-2-008-and-009.md` → 9 (last `-NNN` wins).
- Cross-kind names do not match: `spec-foo-002.md` in `adr` → no match, `0020-alpha.md` in `specs` → no match, `exploration-alpha-007.md` in `specs` → no match. A doc dropped in the wrong directory is a miss, never a cross-directory false positive.
- `0001` and `001` both → 1 (`spec-doc-numbers.test.ts:125-132`).
- Safe misses, never false positives: `20-alpha.md`, `spec-foo-01.md`, `0020alpha.md`, `exploration-alpha-007-extra.md`, `exploration-009.md`, `plan-003.md`, `SPEC-alpha-004.md`, `*.MD`, the committed `*.json` baseline.

**Corpus completeness:** every `.md` in the four live directories parses — the only unmatched name is `adr/README.md`, correctly. So the findings this PR reports are the *complete* set on this repo, with nothing masked by the parser.

Residual, and I judge it acceptable: the patterns require ≥3 digits, lowercase, and the number last, so a **non-conforming** filename is silently invisible to the detector. That is a miss, never a false positive, and nothing in this PR claims to validate the layout — it detects collisions among conventionally named docs. The same is true of the flat, non-recursive `listMarkdownDocs`: a doc in a subdirectory of `docs/specs/` is not seen, consistent with every other rule in this file.

#### 2. One rule, one message builder, both surfaces — and `spec new` reads the same table

`docNumberCollisionMessage` (`spec.ts:395-397`) is the only wording. Its two callers are `runSpecValidate` (`spec.ts:435-444` → code `DOC_NUMBER_COLLISION` into `warnings`) and `consistencyFindings` (`spec.ts:719-728` → kind `duplicate-doc-number` into `findings.consistency`, severity `warn`). Only the code string differs, so the two surfaces cannot drift. `nextDocNumber` (`spec.ts:1355-1366`) now walks `specs`+`plans` through `docNumberFromFileName` → `docNumberMatch` → `DOC_NUMBER_SOURCES`, replacing the old loose `/-(\d{3,})\.md$/` on any filename; `spec-doc-numbers.test.ts:255-272` pins that the scaffolder and detector agree (digit-bearing slugs → `018`; a colliding pair → `005`, never `004`). Putting the finding in `consistency` rather than `decisions` is right — it is a corpus-wide cross-document property, not part of the ADR-0017 decision flow — and `docs/json-output.md`'s Finding-kinds row was updated to say so.

#### 3. Report-only respected; the `arggon validate` refusal is correct

- Corpus-mode gates on both surfaces: `if (opts.file === undefined)` (`spec.ts:435`) and `const consistency = opts.spec ? [] : consistencyFindings(root)` (`spec.ts:1020`). `--file`/`--spec` cannot decide a directory property; pinned at `spec-doc-numbers.test.ts:175-182` and `:232-238`.
- Exit codes, read from `cli/src/cli.ts`: validate sets `exitCode = 1` **only** on `result.errors.length > 0` (`cli.ts:1568-1583`), warnings ride the payload and the `arggon spec: ok (N doc(s), M warning(s))` line; analyze always emits `ok: true` and never assigns an exit code (`cli.ts:1696-1709`) ⇒ exit 0 with findings.
- The error path is not weakened: the new code only ever `push`es into `warnings`/findings, `checkUniqueness` and `checkDoc` are untouched, and the existing real-CLI tests still assert exit 1 on structural errors (`spec.test.ts:369-390`) and exit 0 for analyze findings (`:394-420`).
- **On refusing to put it in `arggon validate` — the call is right, and I can now name the mechanism.** `.git/hooks/pre-commit` is exactly `npm run --silent arggon -- validate`. A docs-collision gate there would have blocked **every commit in this repo** (which carries five live collisions), and `arggon validate` is the `@arggondev/lib` package surface that adopters run — that is a package/adopter-CI change smuggled into a bug fix. `spec validate` (docs-facing) and `spec analyze` (report-only pipeline gate) are the correct surfaces, and `.github/workflows/ci.yml` never runs `arggon spec validate`, so the new warnings cannot break a lane either.
- Report-only rather than a gate is also correct on the merits: with five pre-existing collisions a gate fires on every commit until the renumber lands, and `task-renumber-colliding-doc-numbers` pins that sequencing.

#### 4. The five live findings are genuine — no parser artifact, and no missed extras

Replayed over `ArggonManager/docs`:

| dir | number | files |
| --- | --- | --- |
| explorations | `001` | `exploration-cheap-path-to-prod-001.md` + `exploration-token-context-efficiency-001.md` |
| specs | `001` | `spec-deps-001.md` + `spec-sync-001.md` |
| specs | `015` | `spec-release-pipeline-015.md` + `spec-update-channel-015.md` |
| plans | `001` | `plan-deps-001.md` + `plan-sync-001.md` |
| plans | `015` | `plan-release-pipeline-015.md` + `plan-update-channel-015.md` |

Exactly five, each a literal same-`-NNN` filename pair; ADRs clean (`0001`..`0020`, one file each). The renumber item is chasing real collisions. Note the item title cites the *incident* numbers (ADR 0020×2, exploration `-018`×2, spec/plan `-017`×2), which have since been renumbered on main — consistent, not a discrepancy.

#### 5. Leaving the other story's baseline alone was right — but the report under-reaches

Rewriting `story-release-pipeline`'s committed snapshot inside a bug fix would hide real corpus drift from that story, and `bug-aged-exploration-decisions` already records the same convention for both committed baselines. Correct call.

- I read `ArggonManager/docs/specs/spec-analyze-baseline-release-pipeline-015.json`: `count 6`, kinds `{DECISION-PENDING-EXPLORATION:1, no-error-path:2, vague-quantifier:3}` — no `duplicate-doc-number`, so the five will read NEW and `--baseline` will exit 1. Confirmed by reading the snapshot, not by running.
- **Finding (minor):** there is a **second** committed baseline, `ArggonManager/spec-analyze-baseline.json`, with the same six findings and no `duplicate-doc-number` — it will also read the five as NEW. It is referenced by `ArggonManager/docs/plans/plan-update-channel-015.md:100` and by `story-update-channel`'s item. The PR body, the bug item and `task-release-pipeline-baseline-new-collisions` all name only the `docs/specs/` one. Both baselines were committed once and never refreshed, so the practical exposure is small, but the item under-reports its own blast radius by half.
- **Finding (minor):** `task-release-pipeline-baseline-new-collisions.md` has an **empty body** — `## Context` and `## Acceptance` are still the template placeholders (`<!-- Why this task exists. -->`, `<!-- The real acceptance criteria; tick each box when met. -->`). Its title states the fact, but the *decision* (both baselines left untouched on purpose; remedies are `--no-fail-on-new` for the wave or a re-save after the renumbering) and an acceptance checklist appear nowhere, which `AGENTS.md` requires and `docs/agents.md` §5 needs in order to close it.
- Both items were filed on `main` by the coordinator (`b1020514`, `2975b7fc`, `e3ebdc1d`, `5ac6d23a`, `af9ca0f4`), **not** by this PR — the worker's item explicitly says "a follow-up item needs filing (coordinator's call; I did not file one)". So both are the coordinator's to complete and neither blocks #603. `task-renumber-colliding-doc-numbers`, by contrast, is complete: context with the five pairs, `depends_on: [bug-...]`, and an acceptance box stating the detector must not become blocking in that PR.

#### 6. Scope discipline and impact class

- `git diff --stat origin/main...HEAD` is 18 files, all on-topic: the item file, `docs/agents.md`, `docs/json-output.md`, `README.md`, `cli/src/spec.ts`, one new test file, and the new fixture tree + its `README.md`. No unrelated churn. The merge commit `20a76894` brought in only main's own work (the capability-matrix lane), and the three-dot diff stays 18 files. Merging `origin/main` instead of force-pushing was the right response to a non-fast-forward push.
- Impact class **Behavioral** is honestly classified, not padded: a new rule agents must follow (pick the next **FREE** number), a new report-only check, and a changed command contract (`spec validate` `warnings` is no longer always-empty; a new finding kind). Per `docs/agents.md` §Changing the methodology itself that is Behavioral; ADR 0016 is referenced in the PR body. Advisory would have been the wrong claim.
- Docs that travel with code are all in the same PR: the rule in `docs/agents.md`, the `warnings` row (previously "Currently always empty") and the Finding-kinds row in `docs/json-output.md`, the `spec` section in `README.md`, and the fixture `README.md`. The skill needs no update for falsity: `skills/arggon-cli/references/methodology.md:56` states only the filename pattern (still true) and `json-contract.md` enumerates no spec-level warning/finding kinds, so `skills/arggon-cli/` ↔ `.agents/skills/arggon-cli/` stay byte-equal as claimed.
- **Advisory, coordinator's call:** the new per-directory numbering rule lives in `docs/agents.md` but not in the bundled skill's `references/methodology.md`, so an adopter whose agent loads the skill first never reads it. Not a bar violation (`docs/agents.md` is also shipped to adopters) — worth a follow-up only if you want behavioral coverage in the skill.

#### Findings, in severity order

1. **[minor · coordinator, not this PR]** `task-release-pipeline-baseline-new-collisions` has an empty Context/Acceptance body; the "leave both baselines untouched + re-save after the renumber" decision is unrecorded and the item cannot be ticked off.
2. **[minor · same item]** Under-reported blast radius: `ArggonManager/spec-analyze-baseline.json` is a second committed baseline that also reads the five as NEW; the item and the PR name only the `docs/specs/` one.
3. **[nit]** The gate counts recorded in the PR body and item ("119 files / 2203 tests") were captured *before* the final merge commit; the coordinator's numbers for the merged tree are 120/2226. Not a real gap — `cli` CI re-ran `npm run test` on the merged head and passed, which supersedes them — but the PR body's evidence line is stale.
4. **[nit]** No test pins "a collision and a real structural error in the same run ⇒ exit 1". The error path is structurally untouched and covered in isolation by `spec.test.ts`, so this is a discrimination gap in coverage, not a behavior risk; one assertion in the new file would close it.
5. **[advisory]** The detector is silent on non-conforming filenames (2-digit number, uppercase, number not last, subdirectory). Correct as designed — a miss, never a false positive.
6. **[advisory]** The new numbering rule is not mirrored into `skills/arggon-cli/references/methodology.md`.

#### Probes needed

I do not execute gates, smokes or test suites, so the blocking §Smoke-test bar is unverified by me. The worker recorded before/after transcripts in the PR body and the item that I could corroborate internally (the fixture's "5 doc(s)" = 3 specs + 2 plans, "3 spec(s) scanned", 4 pairs → 4 warnings are all consistent with the code paths I read), but they are worker-supplied, not reviewer-executed. Route to the prover, all from `/home/arggon/Projects/ArggonManager-bug-spec-analyze-does-not-detect-duplicate-doc-numbers` (the worktree recorded on this item) unless noted:

1. `npm run build && npm run arggon -- spec validate --json` with cwd `fixtures/spec-docs-invalid/duplicate-doc-number` — **expected** `ok: true`, `errors: []`, exactly 4 `warnings`, all `DOC_NUMBER_COLLISION`, `exit 0`. Demonstrates corpus-mode warning + report-only. A non-zero exit or any `errors` entry flips the verdict.
2. Same cwd: `npm run arggon -- spec validate` — **expected** four `warning … [DOC_NUMBER_COLLISION]` lines naming both files of each pair, then `arggon spec: ok (5 doc(s), 4 warning(s))`, `exit 0`.
3. Same cwd: `npm run arggon -- spec analyze` — **expected** 4 `[duplicate-doc-number]` findings with the identical message text and `exit 0` (proves one message, two surfaces).
4. **Repo root**, `npm run arggon -- spec validate` — **expected** `exit 0` with exactly **5** `DOC_NUMBER_COLLISION` warnings and the pairs named in §4 of this verdict, and nothing else. This is the probe that matters most: a count other than 5, or a 6th name, means my read of the parser against the live corpus is wrong and the renumber item would be chasing ghosts.
5. **Error path** — in a scratch repo containing a colliding pair *and* one structurally broken spec, `npm run arggon -- spec validate --json` — **expected** `ok: false`, `error.code: SPEC_FAILED`, `exit 1`, with the collision warning still present. (Existing `spec.test.ts:369-390` covers this in isolation; this closes finding 4.)
6. **Merged-tree gates** — `npm test` — record the file/test counts on the merged head to supersede the pre-merge numbers in finding 3. (CI's `cli` job already did this and passed; this is for the PR body's own evidence line.)
7. `npm run skills:sync && git status --porcelain skills/ .agents/` — **expected** empty, confirming the skill copies are still byte-equal after the doc edits.

Refs PR #603 · item `bug-spec-analyze-does-not-detect-duplicate-doc-numbers` · parent `story-spec-pipeline`.
