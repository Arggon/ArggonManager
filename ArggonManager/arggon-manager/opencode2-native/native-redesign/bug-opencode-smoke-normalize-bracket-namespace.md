---
type: bug
status: todo
id: bug-opencode-smoke-normalize-bracket-namespace
title: OpenCode smoke namespace normalizer misses tools.arggon bracket-access calls
parent: native-redesign
labels: [opencode-seam, smoke, review-followup]
priority: p1
created: "2026-09-28"
updated: "2026-09-28"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-opencode-smoke-normalize-bracket-namespace.md
  Leaves live only under a story. id is the filename stem: bug-opencode-smoke-normalize-bracket-namespace.
  CLI `arggon create bug opencode-smoke-normalize-bracket-namespace` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# OpenCode smoke namespace normalizer misses tools.arggon bracket-access calls

## Context

PR #421's focused W4 smoke run exposed a harness false failure: the model emitted the valid Code Mode call `tools.arggon["start"]({ ... })`, the tool executed and returned a correct `ok:true` start envelope, but `normalizeNamespace` in `smoke/opencode-smoke.ts` only rewrites `tools["arggon"].x` to dot access. The needle `tools.arggon.start` therefore misses an equally valid bracket-access form and reports a false lifecycle failure. A second reviewer run reproduced the same class with `tools.arggon["update"]` in the invariants script (37/38), where the transcript showed the claim/no-reopen behavior itself fully correct. Because multiple native transcript checks are model-spelling-dependent and the false negative is indistinguishable from a product failure, this is P1 and independent of both the cleanup fix and provider quota.

## Acceptance

- [ ] Normalize `tools.arggon["x"]` and `tools.arggon['x']` to the same canonical dot form already produced for `tools["arggon"].x`.
- [ ] Preserve support for the existing nested/dot access forms and avoid rewriting unrelated bracket access.
- [ ] Add focused unit coverage for double-quoted, single-quoted, and non-matching tool names.
- [ ] Correct the `normalizeNamespace` doc comment that claims every valid namespace spelling is already handled.
- [ ] Replace/rename the misleading `opencode-smoke.test.ts` case (“normalizes every bracket namespace spelling”) that currently asserts the un-normalized result and locks the gap in.
- [ ] Re-run the affected W4 lifecycle smoke with a bounded model-independent fixture or transcript so the normalizer contract is verified without provider quota.
- [ ] Full test, lint, build, `check:plugin`, and validate remain green.

## Notes

Found during PR #421 review smoke; worker evidence is recorded on `bug-native-cleanup-unverified-worktree-removal`.

### 2026-09-28 @Arggon-worker
Worker evidence — branch `fix/bug-opencode-smoke-normalize-bracket-namespace`, head `1d98ea35`, draft PR #422 (https://github.com/Arggon/ArggonManager/pull/422). Harness-only fix: `smoke/opencode-smoke.ts`, `smoke/opencode-smoke.test.ts`, three new `smoke/fixtures/*.jsonl` + a README. No product code, no `package.json`/`package-lock.json`.

### Acceptance, box by box (expected → observed)

**1. Normalize `tools.arggon["x"]` / `tools.arggon['x']` to the same canonical dot form as `tools["arggon"].x`.**
`normalizeNamespace` now chains a second rewrite on top of the existing namespace one: `.replace(/(tools\.arggon)\s*\[\s*(["'`])([\w$-]+)\2\s*\]/g, "$1.$3")` — anchored on the literal `tools` + `arggon`, closing delimiter must match the opening one.
Expected: every one of the five (six with backticks) valid spellings satisfies the needle `tools.arggon.start`. Observed deterministic probe, old → new:

```
MATCH    MATCH     tools.arggon.start({ id: "x" })
MATCH    MATCH     tools["arggon"].start({ id: "x" })
MATCH    MATCH     tools['arggon'].start({ id: 'x' })
NOMATCH  MATCH     tools["arggon"]["start"]({ id: "x" })
NOMATCH  MATCH     tools['arggon']['start']({ id: 'x' })
NOMATCH  MATCH     tools.arggon["start"]({ id: "x" })
NOMATCH  MATCH     tools.arggon['start']({ id: 'x' })
NOMATCH  MATCH     tools.arggon[`start`]({ id: 'x' })
NOMATCH  NOMATCH   tools["context7"]["resolve-library-id"]("x")
NOMATCH  NOMATCH   helpers["arggon"]["start"]({})
NOMATCH  NOMATCH   tools.arggone["start"]({})
```
(Backtick is a small superset of the box wording — it is valid computed member access and leaving it out would re-open the same false-negative class; the substituted template `tools.arggon[`${name}`]` deliberately does NOT match.)

**2. Preserve the existing nested/dot forms and avoid rewriting unrelated bracket access.**
Expected: dot + `tools["arggon"].x` + `tools['arggon']['x']` still normalize; another namespace, another receiver, a near-miss namespace, mismatched delimiters and a substituted template stay byte-identical. Observed: asserted case by case in `normalizeNamespace` → "leaves unrelated namespaces, other receivers and non-matching names alone" (9 assertions) and "normalizes the namespace bracket access" (5, all now ending in the canonical form). `npx vitest run smoke/opencode-smoke.test.ts` → 19 passed.

**3. Focused unit coverage for double-quoted, single-quoted and non-matching tool names.**
Expected: a bracket call to a *different* tool cannot satisfy another tool's needle. Observed: `tools.arggon["show"]` normalizes to `tools.arggon.show`; on that transcript `executedTool(stdout,"show") === true`, `executedTool(stdout,"next") === false`, `executeJson(stdout,"tools.arggon.next") === undefined`.

**4. Doc comment corrected.**
Expected: no claim that every valid spelling is handled. Observed: the comment now shows both axes, records the two observed W4 failures, states the anchor/matching-delimiter rule, and states the one remaining bound (an alias-hoisted call — `const t = tools.arggon; t.next({})` — is still not recognized; the prompts submit the exact code, and only the call spelling ever deviated).

**5. The misleading test case replaced.**
Expected: the case named "normalizes every bracket namespace spelling" gone. Observed: split into `parseTranscript` / `normalizeNamespace` / W4 describes; the old case asserted `tools["arggon"]["next"]` → `tools.arggon["next"]` (the gap) and no longer exists.

**6. W4 lifecycle re-run with a bounded model-independent fixture/transcript.**
Expected: the normalizer contract verified without provider quota, through the same calls the W4 scenarios make. Observed: `smoke/fixtures/w4-lifecycle-start.bracket-namespace.jsonl`, `w4-lifecycle-close.bracket-namespace.jsonl`, `w4-invariants.bracket-namespace.jsonl` are replayed through `executeJson(stdout, "tools.arggon.start")`, `executeJson(stdout, "tools.arggon.cleanup")`, `executeJson(stdout, "tools.arggon.update")` and `executedTool`, asserting the same envelope fields the scenarios read (`ok`, `command`, `branch`, `worktreePath`; `done.status`, `cleanup.failures`; `claim conflict`+`UPDATE_FAILED`, `claim conflict`+`START_FAILED`, `must not reopen`+`UPDATE_FAILED`). Red-before proof: with only the `normalizeNamespace` body reverted to the pre-fix one-liner, 6 of the new cases FAIL (3 normalizer + 3 W4 replay); restored, 19/19 pass. `executedTool` had to be exported for that (it is now a one-line delegation to `executedCode`, dropping the three-pattern spelling list that caused the drift).
Honest limit: these are **reconstructed** fixtures in the shape the recorded transcripts showed (envelope values and refused `ArgonToolError` messages as the transcripts carried them), not a captured run — `smoke/fixtures/README.md` says so. The real `OPENCODE_SMOKE_ONLY=w4 npm run smoke:opencode` was still attempted on this machine and is **quota-blocked**: `AI.Error.QuotaExceeded: Go usage limit exceeded` from `opencode-go/deepseek-v4-flash`, and the kept fixture `/tmp/arggon-smoke-lifecycle-sWmROx/.smoke-evidence/worktree-lifecycle-start.stdout.jsonl` has only `step_start` + `error` frames — no `execute` frame at all, i.e. a provider artifact, not a needle result. No smoke output was faked.

**7. Full gates green.**
```
npm test                → 97 files / 1646 tests passed
npm run lint            → pass
npm run build           → pass
npm run check:plugin    → pass (regenerated bundle byte-identical to the committed one)
npm run arggon -- validate --json → {"ok":true,…,"errors":[],"warnings":[]}
lint:structure          → ast-grep scan 0 findings
test:structure          → ast-grep test: 3 passed / 0 failed + non-plugin-valid scan pass
```
Caveat: `@ast-grep/cli` is **not installed on this machine** (the primary install predates the devDependency and `npm ci` is forbidden in the worktree), so both structural gates were run with the pinned version via the npx cache: `ast-grep 0.45.3`, same as the devDependency pin, same commands from `package.json`. CI runs the real thing.

### Files changed
`smoke/opencode-smoke.ts` (2 hunks: the `normalizeNamespace` doc comment + body, `executedTool`), `smoke/opencode-smoke.test.ts`, `smoke/fixtures/{README.md,w4-lifecycle-start,w4-lifecycle-close,w4-invariants}.bracket-namespace.jsonl`, plus the ticked acceptance boxes in this item. No new items filed — the alias-hoisting bound is documented in the code, not observed in any run, so filing it would be a hypothesis rather than a finding.
