---
type: bug
status: done
id: bug-no-gate-warns-on-paired-impl-and-test-deletion
title: "Nothing gates a `D` row that removes an implementation and its paired test together — the silent shape that goes green, and it has been reported twice and tracked zero times"
assignee: arggon-delivery-lead
branch: fix/bug-no-gate-warns-on-paired-impl-and-test-deletion
parent: story-adopter-feedback
labels: [ci, tests]
created: "2026-10-06"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/bug-no-gate-warns-on-paired-impl-and-test-deletion.md
  Leaves live only under a story. id is the filename stem: bug-no-gate-warns-on-paired-impl-and-test-deletion.
  CLI `arggon create bug no-gate-warns-on-paired-impl-and-test-deletion` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Nothing gates a `D` row that removes an implementation and its paired test together — the silent shape that goes green, and it has been reported twice and tracked zero times

## Context

**The shape (reported twice, tracked zero times).** Existing protection is `npm test` / `npm run build`, and that only fires when a deletion breaks compilation or orphans a test. Deleting an implementation file **and its paired test** in the same change leaves nothing to fail: it compiles, no test is orphaned, the suite is green, and the module is simply gone. During the round-2 review of PR #586 the reviewer hit it — `D cli/src/adapters.ts` + `D cli/src/adapter-selection.test.ts` — and it turned out to be an artifact of a **two-dot** diff against a stale branch, but the only reason anyone could tell was manual `git diff --name-status` inspection. A reviewer running the three-dot view, or trusting a summary, would have merged a deletion of a module and its test. This is the detection half of `bug-stale-merge-can-delete-merged-feature-silently` (that item is the stale-merge _cause_; this one is the missing _detection_).

**The landed surface** (one script, one test, one CI step — the house `cli/*.mjs` guard pattern of `version-guard.mjs` / `auto-done-refusal.mjs`; no new mechanism, no parallel tooling):

- `cli/paired-deletion-guard.mjs` — lists every `D` row of a PR's **three-dot** diff (`merge-base -> head`), then warns when a `D` row removes an implementation file whose paired test is deleted in the same change. `--diff <file|->` reads a captured `git diff --name-status` (the human probe, no git state needed); `--strict` turns a finding into exit 1. Exit 2 when it could not look (unresolvable base, no merge base, usage error) — a run that cannot look is never a quiet pass, which is the vacuity `bug-verification-regex-matching-nothing` is about.
- `cli/paired-deletion-guard.test.ts` — 20 tests: the pairing rule, real git fixtures for every deletion shape, and the CI wiring.
- `.github/workflows/ci.yml` — a PR-only step in the `cli` job, after `lint:structure` and the spec-analyze lane, before the smoke steps (whose recorded rationale is "cheap and last"). It fetches the PR's own base and head by SHA (the default checkout is shallow, so `git merge-base` needs both sides) and runs the guard.

**Pairing rule (read before extending it).** Same directory, same basename, one of the pair carrying a test marker (`.test`, `.spec`, and the repo's `.property.test` convention). It is deliberately coarse and errs toward **under**-reporting: it fires only when both sides are deleted, so a file without a test, a test without an implementation (the #586 pair itself — `adapters.ts` vs `adapter-selection.test.ts`), a cross-directory match, and every non-code deletion (`.md`, `.json`, `.yml`) are listed and never paired. A rename (`R100`) is a rename, not a deletion. The full rule set is pinned by the unit suite.

**Loudness: WARN, report-only. Recorded reasoning.**

1. **The shape is legitimate-but-suspicious, not defective.** Unlike a NEW spec finding (always a defect) or a build failure (always a break), deleting a module and its test is a routine, reviewed refactor step. Measured on this repo: across the last 500 commits there are 40 `D` rows and **zero** paired deletions — so a blocking gate would buy nothing today and would need a bypass on the first intentional module removal, and a bypass in a workflow (`|| true`, `continue-on-error`) is the knob that rots into the default.
2. **The motivating incident was a false positive from a stale base.** A blocking gate built on a diff whose base can be stale turns an unresolvable base into a red lane indistinguishable from the real thing. Report-only degrades that to an annotation; the guard also prints the merge base it used and warns when that base sits on the shallow boundary.
3. **The pairing rule is a heuristic** with known non-matching shapes in this very repo. A heuristic that blocks needs an exemption list from day one, and an exemption list is the first thing to go stale (this is the same shape of argument the seam-pin gate records for itself).
4. **Report-only is not vacuous.** The bite is asserted, not promised: `--strict` exits 1 on the pair, and the test suite drives it on a real git fixture in every `npm test` — so a future edit that broke the detection would redden `npm test`, the same lane that blocks merges.
5. **Promotion to blocking is a separate call with its own item**, and the evidence it needs is a run of this report over the repo's PR history showing the pair essentially never occurs legitimately — which the 500-commit scan above already begins to supply. `--strict` exists precisely so the promotion is one line in the CI step.

**Impact class (per `ArggonManager/docs/agents.md` §Changing the methodology): advisory.** No methodology carrier, no agent operating contract, no kernel or CLI behavior changes; the tracker schema is untouched. The change adds a dev-only repo CI lane plus its tests. The two-dot/three-dot discipline the guard enforces is a _review habit made visible_, which is the same class as the report-only habit this item asks to make durable.

## Acceptance

- [x] The gate lists every `D` row of the PR's three-dot diff (`merge-base -> head`) and warns specifically when a `D` row removes an implementation **and** its paired test — same directory, same basename, one carrying a `.test`/`.spec`/`.property.test` marker (the pairing rule is pinned by the unit suite)
- [x] Verified by mutation on real git fixtures (not hand-written diff strings): a paired implementation+test deletion warns in report mode and exits 1 under `--strict`; impl-only, test-only, and non-code deletions are listed and never paired; a rename is not a deletion
- [x] The stale-base phantom is pinned as a negative control: a branch that deleted nothing, where the base moved ahead and gained a module plus its test, reports no pair — while the same state's two-dot view carries both `D` rows (the #586 false positive, demonstrated in the suite rather than described)
- [x] Two-dot vs three-dot stated wherever the diff is invoked — in the script header, in the CI step comment, in the report itself (`three-dot semantics`, plus the printed merge base and a shallow-boundary warning)
- [x] Report-only is the recorded decision, with the reasoning above and the note that promoting it to blocking is a separate call with its own item (`--strict` is the promotion path)
- [x] The gate runs in the `cli` CI job consistently with the other structural gates (after `lint:structure` and the spec-analyze lane, before the smoke steps), PR-only, fetching the PR's own base and head by SHA, with no `|| true` / `continue-on-error`
- [x] `npm run build`, `npm test` (137 files / 2987 tests), `npm run check:plugin`, `npm run lint`, `npm run test:structure`, `npm run lint:structure` green; `arggon validate` ok; `actionlint` 0 on the edited workflow
- [x] Impact class stated (advisory)

## Notes

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q

Filed by the delivery lead, as the round-2 reviewer on PR #586 explicitly required and the worker correctly declined to file it herself.

### Context

The reviewer wrote: _"**The worker did not file it**, and `docs/agents.md:31` + `engineering.md:214` require a deferred finding to be tracked, not just reported. Coordinator: that is one `arggon create bug` — no code, no round trip needed."_ So this is a deferred finding reported twice and tracked zero times.

**The shape.** Existing protection is `npm test` / `npm run build`, and that only fires when a deletion breaks compilation or orphans a test. The **silent** shape — deleting an implementation file **and its test** in the same commit — compiles fine, leaves no orphan test, and goes green. Nothing notices.

This is not hypothetical for this repo. During the round-2 review of PR #586 the reviewer hit it: the worker reported `D cli/src/adapters.ts` and `D cli/src/adapter-selection.test.ts` and concluded the branch deleted both. It turned out to be an artifact of a **two-dot** diff against a stale branch, not a real deletion — but the only reason anyone could tell was manual `git diff --name-status` inspection. A reviewer running the three-dot view, or trusting a summary, would have merged a deletion of a module and its test.

That is the same failure the repo already tracks as `bug-stale-merge-can-delete-merged-feature-silently` ("A stale branch merge silently DELETES merged code (implementation and its test together) and goes green"). **This item is the detection half of that one** — that item is about a stale merge deleting code; this is about nothing flagging the `D` row when it happens. They are complementary; close them deliberately, not as duplicates.

**The proposed gate is cheap and report-only**, in the spirit of the existing `context:report`: print `git diff --name-status origin/main...HEAD` on every PR and warn when a `D` row removes a file whose paired test is also deleted. Report-only means no behavioural change to CI and no new gate to keep green.

### Acceptance

- [x] A report-only surface lists every `D` row in `git diff --name-status origin/main...HEAD` for the PR — the command is already written down in the round-2 verdict's probe 1
- [x] It warns specifically when a `D` row removes an implementation file **and** a paired test (same basename, or whatever pairing rule the repo actually uses), because that pair is the shape that compiles and passes
- [x] Read the repo's own deletion-reporting precedent rather than inventing a pairing heuristic — `bug-stale-merge-can-delete-merged-feature-silently` may already define the pairing, and duplicating it would be a fourth near-duplicate on this root
- [x] Verified by mutation: introduce a paired implementation+test deletion on a scratch branch and confirm the surface fires. A report-only check that reports nothing is the same vacuity as `bug-verification-regex-matching-nothing`
- [x] Two-dot vs three-dot stated explicitly wherever it is invoked — the incident that motivated this item was a **two-dot** diff against a stale branch reporting deletions that did not exist
- [x] Report-only is recorded as the decision, with a note that promoting it to a blocking gate is a separate call with its own item
- [x] Impact class stated per `docs/agents.md` §Changing the methodology

### 2026-10-11 @arggon-maker

Landed on `fix/bug-no-gate-warns-on-paired-impl-and-test-deletion` — PR #705. Design, evidence and the loudness decision below.

## Where it lives (house pattern, not a new mechanism)

The repo's CI-shaped guards are `cli/<name>.mjs` + a colocated `.test.ts` + a step in the `cli` job (`version-guard.mjs`, `auto-done-refusal.mjs`). I followed that exactly:

- `cli/paired-deletion-guard.mjs` — lists every `D` row of a PR's **three-dot** diff (`merge-base -> head`) and warns when a `D` row removes an implementation and its paired test together.
- `cli/paired-deletion-guard.test.ts` — 20 tests.
- `.github/workflows/ci.yml` — PR-only step, after `lint:structure` and the spec-analyze lane, before the smoke steps (the "cheap and last" rationale).
- `ArggonManager/docs/engineering.md` — the CI-tier entry.

The ast-grep lanes were considered and rejected as the home: they are source-structure rules, and this check's input is a git diff.

## Pairing rule

Same directory, same basename, one of the pair carrying a test marker (`.test`, `.spec`, plus the repo's `.property.test` convention). Fires only when **both** sides are deleted, so it under-reports by design: the #586 pair itself (`adapters.ts` vs `adapter-selection.test.ts`) does not pair, nor do cross-directory matches, renames (`R100`), or non-code deletions (`.md`/`.json`/`.yml`).

## Detection evidence (negative controls, real git fixtures — not hand-written diff strings)

| #   | crafted state                                                                       | expected                                 | observed                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | paired `D cli/src/adapters.ts` + `D cli/src/adapters.test.ts` + `D docs/old.md`     | every `D` row listed, the pair warned    | 3 rows listed, `::warning:: paired deletion — cli/src/adapters.ts (implementation) and cli/src/adapters.test.ts (test) … compiles and stays green`, exit 0 |
| 2   | same state with `--strict`                                                          | exit 1                                   | exit 1                                                                                                                                                     |
| 3   | `D` implementation only / `D` test only / `D docs/old.md`                           | listed, never paired                     | listed, `verdict: no paired deletions`, exit 0                                                                                                             |
| 4   | branch deletes NOTHING; base moved ahead and gained a module + its test (three-dot) | no pair                                  | `verdict: no deletions in this diff`, exit 0                                                                                                               |
| 5   | same state, two-dot view (raw git)                                                  | both `D` rows present = the #586 phantom | `D cli/src/late.test.ts`, `D cli/src/late.ts` — demonstrated in the suite, not just described                                                              |
| 6   | unrecognizable `--base refs/heads/does-not-exist`                                   | exit 2, never a quiet pass               | exit 2, message names the shallow-fetch remedy                                                                                                             |
| 7   | this branch as it stands                                                            | no deletions                             | `verdict: no deletions in this diff`, exit 0                                                                                                               |

Also pinned: the lane fires on `board-serve.property.test.ts` + `board-serve.ts` (the repo's property-test convention) and does not fire on `adapters.ts` + `adapter-selection.test.ts`.

## Loudness decision: WARN, report-only (recorded reasoning)

1. **Legitimate-but-suspicious, not defective.** Measured: across the last 500 commits this repo has 40 `D` rows and **zero** paired deletions. A blocking gate buys nothing today and costs a bypass on the first intentional module removal — and a bypass in a workflow is the knob that rots into the default.
2. **The motivating incident was a false positive from a stale base.** A blocking gate turns an unresolvable/stale base into a red lane indistinguishable from the real thing. Report-only degrades that to an annotation; the guard also prints the merge base it used and warns when it sits on the shallow boundary.
3. **The pairing rule is a heuristic** with known non-matching shapes in this very repo. A heuristic that blocks needs an exemption list from day one, and an exemption list is the first thing to go stale.
4. **Report-only is not vacuous.** `--strict` exits 1 on a pair and is asserted on a real git fixture in every `npm test`, so a broken detection reddens the lane that blocks merges — the opposite of `bug-verification-regex-matching-nothing`.
5. **The one thing that DOES fail the lane is exit 2** — the run could not look (unresolvable base, no merge base, usage error). Deliberately no `|| true` and no `continue-on-error` in the step. **Promotion to blocking is its own call with its own item**; `--strict` is the promotion path (one line in the CI step).

## Gates run (declared order)

```
npm run build            0
npm test                 137 files / 2987 tests
npm run check:plugin     0
npm run lint             0
npm run test:structure   5 passed
npm run lint:structure   0
arggon validate          ok (0 warnings, convention v5)
actionlint ci.yml        0 (v1.7.12)
spec analyze --baseline  0 new / 0 resolved / 4 unchanged  (baseline JSON untouched)
prettier -c              all matched files clean
```

## Open questions for the delivery lead

- Promotion to blocking: the item records it as a separate call. The evidence it needs (this report run over N PRs showing zero legitimate pairs) is partly in hand from the 500-commit scan.
- `--depth=250` on the CI fetch is a judgement call; a deeper PR would land on the shallow boundary and the guard warns loudly rather than guessing. `fetch-depth` on the shared checkout step was deliberately NOT changed.

> > > > > > > origin/main

### handoff 2026-10-11 @ses_ed55fd9c7ffe3s2uXQDixTbTOW (session: ses_ed55fd9c7ffe3s2uXQDixTbTOW) — next: Review and merge PR #705 (fix/bug-no-gate-warns-on-paired-impl-and-test-deletion); the item body already carries the filled Context/Acceptance, 8 ticked live boxes and the evidence comment.
- branch: fix/bug-no-gate-warns-on-paired-impl-and-test-deletion
- open questions: Promotion to blocking is a separate call with its own item (evidence: 0 paired deletions in the last 500 commits). CI fetch depth 250 is a judgement call.
### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — review verdict: APPROVED, merge (PR #705)

Reviewed against engineering.md §Review bar: the gate follows the repo's own CI-guard pattern (cli/<name>.mjs + colocated test + cli-job step — the version-guard/auto-done-refusal shape), not a new mechanism; the loudness decision (report-only warn, exit 2 only when it could not look, --strict as the promotion path) is argued from measurement (0 paired deletions in 500 commits out of 40 D rows — a blocking gate buys nothing and costs a bypass that rots), from the motivating incident's own false-positive mechanics, and from the pairing rule being a heuristic; evidence travels with the change (7 negative controls on real git fixtures, incl. the two-dot phantom that caused the original incident); actionlint + all gates green. The reviewer's own recovery note (native tools resolving to the session cwd — bug-native-arggon-tools-resolve-tracker-root-to-session-cwd) is recorded; recovery followed docs/agents.md §0 and left one copy of everything.
