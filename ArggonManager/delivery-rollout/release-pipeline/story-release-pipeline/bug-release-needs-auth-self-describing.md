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
