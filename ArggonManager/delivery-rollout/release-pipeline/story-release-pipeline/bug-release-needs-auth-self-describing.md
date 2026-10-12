---
type: bug
status: in_progress
id: bug-release-needs-auth-self-describing
title: "A failed release publish reports `npm ENEEDAUTH` with no pointer to the one-time npmjs.com trusted-publisher setup that resolves it — the runbook names the cause, but nothing on the failure path does"
assignee: arggon-delivery-lead
branch: fix/bug-release-needs-auth-self-describing
parent: story-release-pipeline
labels: [release, docs, failure-mode]
created: "2026-10-09"
updated: "2026-10-12"
claimed_at: "2026-10-12T13:30:29.065Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-release-needs-auth-self-describing
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-release-needs-auth-self-describing.md
  Leaves live only under a story. id is the filename stem: bug-release-needs-auth-self-describing.
  CLI `arggon create bug release-needs-auth-self-describing` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# A failed release publish reports `npm ENEEDAUTH` with no pointer to the one-time npmjs.com trusted-publisher setup that resolves it — the runbook names the cause, but nothing on the failure path does

## Context

This item has zero dated Notes; the defect is grounded in the named authorities below, not in transcribed testimony.

**The failure path that exhibits it.** `.github/workflows/release.yml:204-220` (Publish the kernel first) and `:249-259` (Publish the CLI) run bare `npm publish --workspace lib` / `npm publish` behind only an already-published idempotency check. The workflow's own header (`release.yml:31-36`) states the design intent plainly: OIDC trusted publishing ONLY, no `NPM_TOKEN` anywhere, failing closed until the one-time npmjs.com setup exists (repo `Arggon/ArggonManager`, workflow filename `release.yml`, no environment, direct publish allowed — for BOTH packages). When that setup is absent or wrong, npm reports `ENEEDAUTH` — authentication failed, with no pointer to which of the four binding fields is wrong.

**The runbook names the cause, but nothing on the failure path does.** `release.md:58-61` states the exact trap: "npm does not verify the configuration when you save it, so a wrong value only surfaces at publish time — as `ENEEDAUTH`, which says authentication failed without naming the cause. The org here is `Arggon`, capital A." `release.md:40-53` is the one-time setup (both packages, filename binding, direct-publish selection); `release.md:75-80` gives the fastest diagnostic (`npm trust list <package>`, 2FA-protected read) and records the two failures that already cost this repo two release attempts (a missing entry for `@arggondev/lib`, a lowercase-org repo string for `arggon-manager`); `release.md:139-149` (Exception: publish fails with an authentication error) is the recovery (fix the config, "Re-run failed jobs", guard idempotent re-entry). None of that is reachable from the failed step's own output: the publish steps echo only the already-published short-circuit (`release.yml:217`, `:256`) and otherwise let npm's bare `ENEEDAUTH` stand as the whole diagnosis. The spec agrees this path is runtime-pending: `ArggonManager/docs/specs/spec-release-pipeline-015.md:457-462` (A17) states publishing stays inert until the human completes the trusted-publisher setup, with the publish path itself listed as observed-only-on-first-real-release.

So the operator who hits the red publish step — the exact person the exception manual was written for — must already know `release.md` exists and which section to open. A failed publish should name its own remedy: the one-time setup section, the four binding fields, and the `npm trust list` diagnostic.

## Acceptance

- [x] When a publish step fails with an authentication error, the workflow prints a self-describing failure on the failure path itself: the cause (npm OIDC trusted-publishing authentication failed), which package failed, and the pointer to the one-time setup — `release.md`'s "One-time setup: npm trusted publishers" section, `npm trust list <package>` as the fastest check, the repo/workflow-filename binding, and the case-sensitivity warning (org is `Arggon`, capital A)
- [x] The mechanism covers BOTH publish steps — `@arggondev/lib` and `arggon-manager` — the two failures that cost this repo two attempts were per-package
- [x] Only genuine auth failures get the pointer: a network error, a 404 on a name typo, a pack failure or anything else must not be mistranslated as an auth failure (a wrong hint on a real failure is worse than none)
- [x] Tests travel with the change: the failure classification/formatting is a tested module with unit tests including a negative case (a non-auth failure is NOT mistranslated)
- [x] Offline smoke evidence: run the module against a fixture npm error log (expected vs observed) — no real publish, no network dependency
- [x] Repo gates green: `npm run test`, `npm run test:structure`, `npm run lint:structure`, `npm run arggon -- validate`; `npx prettier --check` on changed files; if `npx actionlint` is available, the workflow stays clean
- [x] The change does NOT restructure `release.yml`'s publish semantics: lib-first order, "already published = success", propagation poll, OIDC-only (no `NPM_TOKEN`) all unchanged — and the workflow filename stays `release.yml` (the trusted-publisher binding; renaming is a breaking ops change)

## Notes

### 2026-10-12 — classification decision (arggon-maker)

The rule is "auth ⇒ pointer, everything else ⇒ silence", grounded in:
`release.md` § "One-time setup: npm trusted publishers" names `ENEEDAUTH` as the
only surface of a wrong trusted-publisher entry; npm/cli#9088 records the second
trusted-publishing failure shape — an old npm on the runner reports the same
misconfiguration as a **404** ("package not found"), which is also what a name
typo looks like. A 404 therefore gets **no** pointer: telling the two apart is
not something a stderr scan can do honestly, and a wrong hint on a real failure
is worse than none. `E401` is the one status that is unambiguously the registry
refusing the credential, and this workflow carries no token, so a 401 here can
only be the trusted-publisher path. The `npm ≥ 11.5.1` upgrade step in
`release.yml` is the mitigation for the #9088 class and already ships.

### 2026-10-12 — body merge note (arggon-maker)

PR #738 (`task-wave1b-mixed-bodies`) landed this item's Context and a five-box
Acceptance while the fix was in flight. The Context above is kept verbatim from
that authoring; the Acceptance below carries the seven criteria this fix was
dispatched against, which subsume those five (the pointer to the one-time setup,
the binding fields, `npm trust list`, unchanged recovery, gates green). The
five-box list is superseded by the seven, not dropped.

### 2026-10-12 @ses_ecfafb576ffepx0r0tPtLqBoBC

## Verification evidence (2026-10-12, worktree `fix/bug-release-needs-auth-self-describing`)

Shape: a tested module `cli/publish-auth-hint.mjs` that BOTH publish steps wrap —
`node cli/publish-auth-hint.mjs --package "<name>" --version "$VERSION" -- npm publish …` —
on the `cli/release-guard.mjs` / `cli/inspect-tarballs.mjs` precedent (a scripted gate
release.yml calls). It re-emits npm's own stderr verbatim, prints the self-describing
pointer only on a genuine authentication failure, and exits with npm's status, so a
failing publish fails the step exactly as before and a passing publish prints nothing.

Classification rule (auth ⇐ pointer):

- `npm error code <CODE>` / `npm ERR! code <CODE>` with CODE in {ENEEDAUTH, E401}
  (npm 11's lowercase `error` prefix and npm 10's `ERR!` are both parsed);
- or, when the log carries no code line, the messages "need auth", "requires you to be
  logged in", "authorize this machine using `npm adduser`", "401 Unauthorized".
  NOT auth (no pointer at all): E404 (name typo — npm can mask a trusted-publisher
  mismatch as a 404, npm/cli#9088, so it is deliberately not translated), E403 (version
  already published), EPRIVATE, ECONNRESET / ETIMEDOUT / ENOTFOUND / EAI_AGAIN, ELIFECYCLE,
  ENOENT (pack), an unknown code, a log with no error line, and exit 0.

Commands run (all in the worktree; expected → observed):

1. `npx vitest run cli/publish-auth-hint.test.ts` → "Test Files 1 passed (1) / Tests 39 passed (39)" (expected all pass, negatives included).
2. `npm run test` → "Test Files 144 passed (144) / Tests 3181 passed (3181)" (baseline in a fresh worktree first failed 1 file, 5 tests: `cli/src/headless-ci.test.ts` asserts `dist/cli.js` exists — an unbuilt worktree, fixed by `npm run build`, not by this change).
3. `npm run test:structure` → "test result: ok. 5 passed; 0 failed".
4. `npm run lint:structure` → no diagnostics. Mid-flight it flagged one error: the lib-first ordering assertion now goes through `assertOrder` (test/assert-order.ts) instead of a bare `indexOf` comparison.
5. `npm run arggon -- validate` → "arggon validate: ok (0 warning(s), convention v5)".
6. `npx prettier --check` on the three changed files + the item → "All matched files use Prettier code style!". (`prettier --check .` is red on origin/main already — 626 files — so only the changed files are claimed here.)
7. `actionlint .github/workflows/release.yml` → exit 0, clean.
8. `npx eslint cli/publish-auth-hint.mjs cli/publish-auth-hint.test.ts` → exit 0.

Offline smoke against fixture npm error logs (expected → observed):
a. `--package @arggondev/lib --log <ENEEDAUTH log>` → "publish-auth-hint: npm publish for
@arggondev/lib@0.6.0 failed with an AUTHENTICATION error (npm error code ENEEDAUTH)",
plus `npm trust list @arggondev/lib`, the repository/workflow-filename binding,
"`Arggon`, capital A", the stage-only warning and the release.md section names.
b. same for `arggon-manager` with npm 10's `ERR!` prefix → its own pointer
(npmjs.com/package/arggon-manager/access).
c. `--log <404 name-typo log>` → npm's error re-emitted, pointer occurrences: 0 (expected 0).
d. `--log <ECONNRESET log>` → pointer occurrences: 0 (expected 0).
e. wrapper mode with a fake failing npm → npm's stderr echoed verbatim, pointer printed,
child exit status 1 preserved (also pinned for 7 and 0 in the suite).

Publish semantics: step names, `if:` conditions and step order are unchanged — the diff is
the two wrapped `npm publish` invocations plus comments. lib-first order, "already on the
registry - already-published = success", the 300 s propagation poll and OIDC-only (no
`NPM_TOKEN`) are pinned by the workflow-contract test in the suite.

### handoff 2026-10-12 @ses_ecfafb576ffepx0r0tPtLqBoBC (session: ses_ecfafb576ffepx0r0tPtLqBoBC) — next: Delivery lead: review the PR (shape = cli/publish-auth-hint.mjs wrapper on both publish steps) and merge; auto-done flips the item on merge.

- branch: fix/bug-release-needs-auth-self-describing
- open questions: Should the npm/cli#9088 class (a trusted-publisher mismatch reported as 404) get a hedged pointer later, or stay silent by design? Nothing in release.yml/release-please* was touched.

### 2026-10-12 @ses_ecfafb576ffepx0r0tPtLqBoBC

PR open: https://github.com/Arggon/ArggonManager/pull/741 (base main, head fix/bug-release-needs-auth-self-describing) — for the delivery lead to review and merge; auto-done flips this item on merge. The comment/handoff/evidence were auto-committed onto the PRIMARY checkout's main by the in-process arggon tool (it resolves the tracker root from the session cwd, not the worktree); they are carried on this branch too via the merge of origin/main.

### 2026-10-12 @ses_ecf022156ffeGMZDhC7xbsDywP
verdict: approve (scope: failure-path annotation for both release publish steps — bug-release-needs-auth-self-describing; read-only standards review, no gates executed)

**What I inspected (read-only) and what it shows**

- **Scope.** `git diff origin/main...HEAD --name-status` = exactly 3 change files + item bookkeeping: `.github/workflows/release.yml` (3 hunks, +24/-2), `cli/publish-auth-hint.mjs` (new, 289 lines), `cli/publish-auth-hint.test.ts` (new, 512 lines). PR #741 open, head `92997170` = local HEAD, base `main`. The workflow diff is the two command substitutions plus comments — no step names, `if:` conditions, order, permissions or environment touched.
- **Failure-path mechanics** (`cli/publish-auth-hint.mjs`): exit status = child's status (`process.exitCode = status`, :284, with the pipe-flush/truncation reasoning in the comment at :282-284); npm stderr re-emitted verbatim before annotation (:279); annotation fired only when `verdict === "auth"` (:231-234), with the exit-0 short-circuit first (:104). The unit tests pin all of it: exit status 1/7/0 (test :393, :407, :416-418), silence on a passing publish while warnings still reach the log (:417-421), 404 + ECONNRESET in wrapper mode with zero pointer markers (:401-413), classifier negatives including the crafted "proxy answered 401 / not logged in" prose (:235-252), fail-closed exit 2 (:450-456).
- **Classification narrowness.** `AUTH_CODES = {ENEEDAUTH, E401}` plus four message patterns (mjs :64-75); E404 is deliberately silent and the reason is recorded in three places — module docstring (mjs :37-43), test docstring (test :13-18), item's 2026-10-12 note. I fetched the cited npm/cli#9088 to check the authority: title "Trusted publishing failures report misleading 404 / ENEEDAUTH errors...", and its closing finding is that upgrading npm in CI resolved the class — consistent with the recorded reasoning and with the existing `npm@11.5.1` upgrade step in release.yml. The "auth ⇒ pointer, everything else ⇒ silence / a wrong hint is worse than none" tradeoff is honestly recorded, including the open question to revisit the 404 class later.
- **Docs travel.** Every fact in `formatAuthHint` cross-checked against `release.md`: cause/ENEEDAUTH (release.md :58-61), both packages + four binding fields (:40-53), case-sensitive org (:58-61), delete-and-recreate + 2-day expiry (:63-68), `npm trust list` as 2FA-protected read (:75-80), settings pages (:70-73), recovery "Re-run failed jobs" + idempotent re-entry (:139-149). Section names match the headings; no mismatch found. (The `ArggonManager/docs/runbooks/release.md` page is a superseded pointer that sends readers to the root release.md, so the pointer is unambiguous by section name.)
- **Acceptance merge honesty.** Five-box list as landed by PR #738 (`0ba15ea2`) vs the current seven: 5.1/5.2/5.3 → 7.1 + 7.2; 5.4 (recovery unchanged, no token path) → 7.7, and the recovery pointer itself is implemented and test-pinned (:292-295); 5.5 → 7.6. No criterion dropped; the "the seven subsume the five" note is accurate (the one nuance: 7.x doesn't re-name the recovery pointer explicitly, but 7.7 covers the "no new fallback / unchanged recovery" substance and the hint carries it).
- **Scope guard.** Workflow filename `release.yml` and `name: release` unchanged; lib-first order, "already on the registry - already-published = success" (still exactly 2 occurrences), 300 s propagation poll, `id-token: write`, no `NPM_TOKEN` — all unchanged. The workflow-contract test (:477-511) pins both wrapper invocations, the ordering via presence-checked `assertOrder` (not a vacuous `indexOf`), the idempotency line count, the poll string and the OIDC-only rule; without the change both the module import and the invocation assertions fail.
- **Conventions / packaging.** Matches the `cli/release-guard.mjs` / `cli/inspect-tarballs.mjs` precedent (tested `cli/*.mjs`, usage + exit 2, exported functions for tests); `vitest.config.ts` includes `cli/**/*.test.ts` so `npm run test` discovers it; root and lib `files` exclude `cli/` and `bin` is `dist/cli.js`, so nothing new burdens either published tarball; no new runtime dependency (node: builtins only); `spawnSync` argv array — no shell interpolation, no secrets printed. Test-count sanity: `it`/`it.each` expansions total 39, matching the item's "39 passed".

**Minor, non-blocking observations** (maker may fold here or file a follow-up; neither blocks merge):
1. Doc-vs-code precision on the message fallback: the docstring and item evidence say messages are matched "when the log carries no code line", but `classifyPublishFailure` (mjs :104-108) consults `AUTH_MESSAGES` whenever no *auth* code was found — e.g. a log with `npm error code ECONNRESET` plus the literal "need auth" would classify as auth. No realistic npm failure shape emits that combination (the suite's adversarial case is specifically crafted not to), so risk is low; gating the fallback on `codes.length === 0` — or correcting the docstring — would make code and documentation agree.
2. `spawnSync`'s default maxBuffer (1 MiB per stream): more than 1 MiB of npm stderr sets `child.error` and exits 2 through `usage()` before re-emitting npm's (truncated) stderr — the one path where "nothing is swallowed" is not strictly true. Pathological; noted for completeness.

**Not verified here (verifier territory).** The item's observed gate outputs — `npx vitest run cli/publish-auth-hint.test.ts` 39/39, `npm run test` 3181, `test:structure`, `lint:structure`, prettier on changed files, actionlint, eslint — and the actual GitHub Actions run are execution evidence; the maker's expected→observed record is on the item and the offline fixture suite is the applicable smoke for this CI-only change. The verifier's independent run is the standing confirmation; a result contradicting those numbers (or negative-path assertions failing) would change this verdict. No probes requested — no execution evidence is missing from the maker's bundle.
