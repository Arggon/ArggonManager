---
type: bug
status: done
id: bug-formatter-glues-markdown-spaces
title: Formatter glues markdown spaces around inline code (prettier 3.9.6)
assignee: Arggon
branch: fix/bug-formatter-glues-markdown-spaces
parent: tooling-and-environment
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-22"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-formatter-glues-markdown-spaces
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-formatter-glues-markdown-spaces.md
  Leaves live only under a story. id is the filename stem: bug-formatter-glues-markdown-spaces.
  CLI `arggon create bug formatter-glues-markdown-spaces` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Formatter glues markdown spaces around inline code (prettier 3.9.6)

## Context

Found in the PR #384 review (`task-native-lib-hygiene`, finding F1): with the
repo's `formatter: true`, prettier 3.9.6 **removes the spaces around inline
code spans** in `ArggonManager/docs/json-output.md` (reproduced on the intact
base: `prettier --write` over `origin/opencode2:docs/json-output.md` produces
the four glued tokens, and `prettier --check` already warns at base). The file
cannot be prose-correct and prettier-clean at the same time; CI does not run
prettier, so the corruption went unnoticed until a review token-diff. The fix
restored the spaces, leaving `prettier --check` warning only on that file.

## Acceptance

- [x] Decide the guard: pin/configure prettier so it stops gluing inline-code
      spacing, exclude markdown prose from `npm run format`, or add a prose
      token-diff check. **Decided: prose token-diff check** (`cli/src/prose-format.test.ts`)
      plus the source repair. Pin/config rejected with evidence — the glue reproduces on
      prettier 3.5.3/3.6.2/3.7.4/3.8.1/3.9.0/3.9.6 and under every markdown option
      (`--print-width 80…100000`, `--prose-wrap always|never|preserve`); `.prettierignore`
      rejected because it hides the corruption, loses table formatting, and leaves the
      spans rendering wrong.
- [x] `npm run format` no longer corrupts `docs/json-output.md` (or the
      exclusion is documented). `prettier --write` on the repaired file is a
      byte-identical no-op (at base it produced the 4 glues plus a mis-padded table);
      the guard pins it in CI.
- [x] Any existing glued tokens elsewhere in docs are repaired (token-diff).
      Repaired the 4 glues in `docs/json-output.md` and the 2-space indent loss in
      `skills/arggon-cli/references/pitfalls.md`. Token-diff over all 552 tracked `.md`
      files: the only remaining hits are 2 tracker items that quote the mangled output as
      evidence (excluded from the guard by design); the indentation-variant findings
      outside this item's scope are listed in the comment below.
- [x] `arggon validate` green; CI green. `arggon validate: ok (0 warning(s),
      convention v5)`; PR #387 checks: `cli` pass (4m9s), `tasks-validate` pass (35s).

## Notes

- Filed per the review-findings rule; cosmetic but recurring (the auto-formatter
  runs on every edit in this repo).

### 2026-09-21 @Arggon
**Worker evidence — guard decision, repairs, gates** (branch `fix/bug-formatter-glues-markdown-spaces`, PR #387, commit `efd1d88`).

### Guard decision (acceptance 1)

**Chosen: prose token-diff check + source repair.** Rejected alternatives, with the probes that killed them:

- **Pin/config (rejected).** `prettier --write` over `origin/opencode2:ArggonManager/docs/json-output.md` (intact base) produces the four glues on **3.5.3, 3.6.2, 3.7.4, 3.8.1, 3.9.0 and 3.9.6**, and with `--print-width 80|100|500|100000` and `--prose-wrap always|never|preserve` — so no version pin and no markdown option fixes it. Root cause: `\`` is **not** an escape inside a CommonMark code span; the parser splits the span at the inner backticks and prettier's printer rebuilds the pieces from its own parse, dropping the whitespace around the split.
- **`.prettierignore` for docs prose (rejected).** It only hides the corruption, loses table formatting, and leaves the spans rendering wrong (the source is invalid markdown, so `docs/json-output.md` renders several broken spans today).

### Changes

- `ArggonManager/docs/json-output.md`: the 4 spans are re-encoded with ` ``double-backtick`` ` delimiters; each now parses as **one** code span whose value is the CLI's actual string (`OPENCODE_MCP_HINT`, init's git warning, the outdated-docs hint, the doctor sample JSON). `prettier --check` is now clean on the file (it warned at base); the same formatter run re-padded the `start` table to canonical alignment (whitespace/dashes only).
- `skills/arggon-cli/references/pitfalls.md`: the code span that spanned a line break is kept on one line, so prettier can no longer eat the continuation indent (`8c98b03` had already lost 2 spaces that way).
- `cli/src/prose-format.test.ts` (new): formats every tracked markdown file outside the tracker item tree with the repo's prettier config and fails when a formatted token is the concatenation of whitespace-separated source tokens — a glue — requiring the same neighbours so a coincidental substring cannot fire it. CI runs it via `npm test`.

### Expected vs observed

| Check                                     | Expected                 | Observed                                                                                                                                     |
| ----------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| guard on the pre-repair file              | fail, naming the 4 glues | fail: `` `null` otherwise → `null`otherwise; and `.mcp.json` → and`.mcp.json`; `v1.findings` entries → `v1.findings`entries; as `{ → as`{ `` |
| guard on the repaired tree                | pass                     | pass (1.6 s)                                                                                                                                 |
| `prettier --write` on the repaired docs   | no prose loss            | **byte-identical** for both files                                                                                                            |
| `npm test`                                | green                    | 91 files / 1467 tests pass                                                                                                                   |
| `npm run lint`, `npm run build`           | green                    | green (plugin bundle unchanged)                                                                                                              |
| `arggon validate`, `arggon spec validate` | green                    | ok (0 warnings, convention v5) / ok (18 docs, 0 warnings)                                                                                    |
| PR #387 CI                                | green                    | `cli` pass (4m9s), `tasks-validate` pass (35s)                                                                                               |

### Out of scope — reported for triage, not in this PR

Same defect class in files outside this item's scope. Token-diff over all 552 tracked `.md` files (format each in-memory, compare whitespace-separated tokens):

- **Token glues** remain only in 2 tracker items that quote the mangled formatter output as evidence: `task-native-lib-hygiene` and `bug-seam-signature-anchor-regressed` (the latter also loses spaces between paragraph lines). Tracker item bodies are excluded from the guard by design — they are historical records.
- **Indentation variant** (code span spanning a line break: prettier joins it and drops the continuation line's indent — renders identically, cosmetic): `docs/explorations/exploration-adopter-upgrade-experience-007.md`, `docs/explorations/exploration-priority-model-008.md`, `docs/explorations/exploration-torture-contention-005.md`, `docs/plans/plan-spec-pipeline-002.md`, `docs/specs/spec-priority-field-008.md`, `docs/specs/spec-spec-pipeline-002.md`, plus `docs/playbooks/node.md` and `docs/playbooks/vitest.md` (in flight in the playbook work item) and 3 tracker items.

Each repair needs its code span restructured, not just the whitespace restored (prettier re-removes it — verified on `pitfalls.md`), so they belong in a follow-up item rather than in this diff. Repro for the whole list: `prettier --write` a copy of each file with the repo config and compare the whitespace run before/after each token.

### handoff 2026-09-21 @Arggon — next: Review PR #387 (guard test + 4 span repairs + pitfalls restructure); merge with a merge commit (tracker-carrying branch); then decide the follow-up for the indentation-variant docs listed in the comm…
- branch: fix/bug-formatter-glues-markdown-spaces
- open questions: File the follow-up item for the 8 docs with the indent variant (2 playbooks in flight)? Extend the guard with an indentation rule once they are repaired?

### 2026-09-21 @Arggon
**Review verdict — PR #387 @ `c3a2561` (draft, base `opencode2`): NO-MERGE as-is — one minor change request (2 spans); everything else verified merge-ready.**

### Verified (evidence)

- **Root cause confirmed.** `prettier --check` on `origin/opencode2:ArggonManager/docs/json-output.md` fails; `--write` on it produces exactly the 4 glues (`null`otherwise, and`.mcp.json`, `v1.findings`entries, as`{`) plus a table re-pad. `diff(prettier(base), head)` is exactly the 4 span lines, so the `start`-table reflow in the head is canonical padding only, not a prose change. The previous claim that the file could not be prose-correct and prettier-clean at once is false.
- **Repairs parse correctly.** prettier `__debug.parse` over the head: each of the 4 spans is one `inlineCode`. The outdated-docs hint (72 chars) and the doctor sample JSON (178 chars) match the CLI strings exactly; the other two are off by a trailing space (finding 1).
- **`pitfalls.md` repair is value-preserving.** The base span's parsed value is `update --steal --reason\n"<why>" --assignee <you>` (line-break form, rendered as a space) and the head's is the same on one line; only the source wrap/indent is restored. Both head files are `prettier --check` clean and `prettier --write` byte-identical no-ops.
- **Guard mutation-tested.** Replacing `json-output.md` with base → fails naming exactly the 4 glues (matches the worker's evidence); reverting only the `opencode.mcp.hint` span → fails naming that glue; guard passes on the head tree.
- **Gates.** `npm run lint`, `build`, `check:plugin` (bundle unchanged), `arggon validate` (ok, 0 warnings, convention v5), `arggon spec validate` (ok, 18 docs, 0 warnings) all green locally. `npm test`: 1466/1467 twice — the only failure is `cli/src/measure.test.ts` "always deletes the measurement temp tree (/tmp hygiene)", environmental: a concurrent test run in a parallel worktree leaves `/tmp/arggon-budget-*` dirs (later mtimes, gone afterwards); the file passes 11/11 standalone. CI `cli` + `tasks-validate` green at head `c3a2561` (verified `headSha`).
- **Scope clean.** Exactly 4 changed files: the item + `docs/json-output.md` + `skills/arggon-cli/references/pitfalls.md` + `cli/src/prose-format.test.ts`. No `start.ts` / `lib/README` / `smoke/**` (parallel workers) touched. Item stays `in_progress`, assignee Arggon, not marked done.
- **Smoke bar:** docs + test-only, no CLI/UI behavior change → exempt per `engineering.md`.

### Findings (severity order)

1. **Minor (change request) — 2 of the 4 repaired spans do not carry the CLI string exactly: a trailing space leaks into the span.** `ArggonManager/docs/json-output.md:140` (init git warning) and `:184` (`opencode.mcp.hint`). The closing ` `` ` needs a separator because the content ends with a backtick, and only the trailing side is padded; CommonMark strips one space from each end only when BOTH ends have one, so the parsed values are `… run `git init` ` (131 chars vs `NOT_A_REPO_WARNING`'s 130) and `… use `arggon mcp` ` (130 vs `OPENCODE_MCP_HINT`'s 129). Rendered: "run `git init` ." / "use `arggon mcp` );", and the item/PR claim "each now parses as one code span whose value is the CLI's actual string" is false for these two. **Fix verified locally:** pad the opening side too (`` `` not a git repository … `` ``), run `prettier --write` (re-pads the table); result: parsed values exact, `prettier --check` clean, `--write` byte-identical, guard green.
2. **Info — the guard does not cover the `pitfalls.md` repair.** Reverting `pitfalls.md` to base still passes the guard (verified): the indent loss is a whitespace replacement, invisible to a token diff. The item lists the indentation rule as an open question, but the test header comment ("The repairs … live in those files; this guard keeps them honest") reads as if it did — worth tightening the wording.
3. **Info — heuristic limits, no false positive observed.** The rule requires the merged token to be absent from the source and to sit between the same neighbours; a legitimate normalization inside an embedded code fence can merge tokens unnoticed (observed: a ```js `foo (bar)` → `foo(bar);` is not flagged). The 272 covered files (61 tracker docs + 211 outside the tracker) pass today.

### Out of scope

- The deferred indentation sweep is filed as `task-code-span-repair-sweep` (`0f39ab1` on `opencode2`), so the "follow-ups filed as tracker items" bar is met.

### Recommendation

Merge with a **merge commit** (never squash) once finding 1 is fixed — or, if the trailing space is deliberately accepted, correct the exactness claim in the item/PR body and record the decision. Everything else is verified merge-ready.

### 2026-09-21 @Arggon
**Review follow-up — both findings addressed** (`a633352`, branch `fix/bug-formatter-glues-markdown-spaces`, PR #387).

### Finding 1 (change request) — FIXED

The two spans now pad **both** ends, so CommonMark's strip rule fires and the parsed values are byte-exact against the CLI constants:

```
EXACT   init warning (:140): parsed 130 chars, CLI 130 chars   (NOT_A_REPO_WARNING)
EXACT   opencode.mcp.hint (:184): parsed 129 chars, CLI 129 chars   (OPENCODE_MCP_HINT)
OK      outdated-docs hint (:164): 72 chars  ("N doc(s) have newer templates — run `arggon init --dry-run` for the plan")
OK      doctor sample JSON (:659): 178 chars ('{ "native": true, "mcpJson": true, "hint": "…use `arggon mcp`" }')
```

- Measured with `prettier.__debug.parse` (inlineCode node values), with `NOT_A_REPO_WARNING` rebuilt from `cli/src/init.ts`'s own expression and `OPENCODE_MCP_HINT` imported from `cli/src/doctor.ts` — not hand-typed. Script: `/tmp/opencode/verify-spans.mts` (reproducible: `npx tsx` over the two constants).
- Source diff: ` ` not a git repository … ` ` and ` (` optional: … ` ` — exactly the fix you verified locally.
- `prettier --check` clean on both repaired files and on the test; `prettier --write` on copies is **byte-identical** (no table re-pad was needed — the committed file was already canonical).

### Finding 2 (info) — documented limit + guard extended where it can be

- Test header now states the coverage limit explicitly: the token diff pins **token merges** only, so it cannot see the `pitfalls.md` repair (a whitespace-run replacement, not a merge).
- Added the companion **stability test**: the two files repaired here must stay byte-stable under `prettier --write`. It catches a _newly introduced_ multi-line code span (prettier drops the continuation indent → bytes move), but **not** a revert to the committed `pitfalls.md` base — that base is already the stable-but-damaged output prettier itself produced. A corpus-wide indentation rule must wait for `task-code-span-repair-sweep` (it fails today on docs outside this item's scope). Both limits are written in the header comment.

Mutation evidence (guard is not vacuous):

| Mutation                                                        | Observed                                                                                                                                                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/json-output.md` ← `origin/opencode2`                      | **both tests fail**: token test names the 4 glues (`null` otherwise → `null`otherwise; and `.mcp.json` → and`.mcp.json`; `v1.findings` entries → `v1.findings`entries; as `{ → as`{`); stability test: "no longer prettier-clean" |
| `skills/arggon-cli/references/pitfalls.md` ← `origin/opencode2` | **both pass** — the documented limit, now stated instead of implied                                                                                                                                                               |

### Gates (all re-run at `a633352`)

| Gate                   | Result                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `npm test`             | 91 files / **1468 tests** pass (was 1467; +1 stability test)                                 |
| `npm run lint`         | clean                                                                                        |
| `npm run build`        | ok                                                                                           |
| `npm run check:plugin` | ok (bundle unchanged)                                                                        |
| `arggon validate`      | ok, 0 warnings, convention v5                                                                |
| `arggon spec validate` | ok, 18 docs, 0 warnings                                                                      |
| PR #387 CI             | running at `a633352` (previous head was green; results reported in the handoff/next session) |

### handoff 2026-09-21 @Arggon — next: Re-review PR #387 at a633352 (finding 1 fixed: both span ends padded, values byte-exact; finding 2: coverage limit documented + stability test added, mutation-tested). CI green. Merge with a merge co…
- branch: fix/bug-formatter-glues-markdown-spaces
- open questions: Acceptable that the pitfalls.md revert is not machine-caught (base is already prettier-stable)? Corpus indentation rule waits for task-code-span-repair-sweep.

### 2026-09-22 @Arggon
**Final review verdict — PR #387 @ `d653c12` (draft, base `opencode2`): MERGE (merge commit, never squash).**

### Finding 1 (change request) — FIXED, verified byte-exact

- All four spans now parse as single code spans with the exact CLI strings, measured against the **real** constants: `OPENCODE_MCP_HINT` imported from `cli/src/doctor.ts` (129 chars) and `NOT_A_REPO_WARNING` taken from a real `arggon init --dry-run --json` run in a non-git dir (130 chars):
  - init warning (`:140`): 130/130 exact — `not a git repository — branch/worktree/push/PR flows and the pre-commit validate hook will be unavailable until you run \`git init\``
  - `opencode.mcp.hint` (`:184`): 129/129 exact — `optional: the native arggon tools do not need MCP — keep "mcp.servers.arggon" only for non-OpenCode clients that use \`arggon mcp\``
  - outdated-docs hint (`:164`): 72/72 exact; doctor sample JSON (`:659`): 178/178 exact.
- `prettier --check` clean on both repaired files and `prettier --write` is a byte-identical no-op on each. `diff(prettier(base), head)` is now exactly the 4 span lines — the `start`-table reflow remains canonical padding only.

### Finding 2 (info) — ADDRESSED

- The test header now states the coverage limit explicitly (token merges only; the `pitfalls.md` indent repair is a whitespace-run replacement; embedded fences out of scope; corpus-wide indentation rule deferred to `task-code-span-repair-sweep`).
- The new stability test pins `prettier --write` as a no-op on the two repaired files. Mutation matrix re-verified by me:
  - `json-output.md` ← base → **both tests fail** (token test names the 4 glues; stability test reports the file no longer prettier-clean).
  - `pitfalls.md` ← base → **both pass** — the documented limit.
  - additionally, introducing the pre-`8c98b03` multi-line span shape in `pitfalls.md` → stability test **fails** with the file named, so the companion test has real discriminating power for a newly introduced multi-line span.

### Gates at `d653c12`

- `npm test`: **91 files / 1468 tests pass** (the +1 is the stability test); `npm run lint`, `build`, `check:plugin` (bundle unchanged), `arggon validate` (ok, 0 warnings, convention v5), `arggon spec validate` (ok, 18 docs, 0 warnings) — all green locally.
- CI `cli` (4m8s) + `tasks-validate` (32s) green at head `d653c12` (`headSha` verified on both runs). PR `MERGEABLE`.
- Scope: exactly 4 files (item + `docs/json-output.md` + `skills/arggon-cli/references/pitfalls.md` + `cli/src/prose-format.test.ts`); no `start.ts` / `lib/README` / `smoke/**` touched. Item stays `in_progress`, assignee Arggon, not marked done.
- Smoke bar: docs + test-only, no CLI/UI behavior change → exempt per `engineering.md`.

### Recommendation

**MERGE with a merge commit (never squash)** — the PR is still a draft, so mark it ready first. The corpus-wide indentation rule stays in `task-code-span-repair-sweep`. No open findings.

### 2026-09-22 @Arggon
Coordinator note: reviewer verified byte-exact parsed values against the real constants (130/130, 129/129, 72/72, 178/178), prettier --check clean and --write byte-identical, stability test + mutation matrix reproduced, limits documented. Gates 1468 tests, lint/build/check:plugin/validate/spec; CI pass. Corpus-wide indent rule deferred to task-code-span-repair-sweep. Merged with merge commit; item flipped to done.
