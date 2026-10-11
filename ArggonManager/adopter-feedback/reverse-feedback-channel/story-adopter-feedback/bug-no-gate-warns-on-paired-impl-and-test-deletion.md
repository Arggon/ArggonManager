---
type: bug
status: todo
id: bug-no-gate-warns-on-paired-impl-and-test-deletion
title: "Nothing gates a `D` row that removes an implementation and its paired test together — the silent shape that goes green, and it has been reported twice and tracked zero times"
parent: story-adopter-feedback
labels: [ci, tests]
created: "2026-10-06"
updated: "2026-10-06"
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/bug-no-gate-warns-on-paired-impl-and-test-deletion.md
  Leaves live only under a story. id is the filename stem: bug-no-gate-warns-on-paired-impl-and-test-deletion.
  CLI `arggon create bug no-gate-warns-on-paired-impl-and-test-deletion` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Nothing gates a `D` row that removes an implementation and its paired test together — the silent shape that goes green, and it has been reported twice and tracked zero times

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

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

- [ ] A report-only surface lists every `D` row in `git diff --name-status origin/main...HEAD` for the PR — the command is already written down in the round-2 verdict's probe 1
- [ ] It warns specifically when a `D` row removes an implementation file **and** a paired test (same basename, or whatever pairing rule the repo actually uses), because that pair is the shape that compiles and passes
- [ ] Read the repo's own deletion-reporting precedent rather than inventing a pairing heuristic — `bug-stale-merge-can-delete-merged-feature-silently` may already define the pairing, and duplicating it would be a fourth near-duplicate on this root
- [ ] Verified by mutation: introduce a paired implementation+test deletion on a scratch branch and confirm the surface fires. A report-only check that reports nothing is the same vacuity as `bug-verification-regex-matching-nothing`
- [ ] Two-dot vs three-dot stated explicitly wherever it is invoked — the incident that motivated this item was a **two-dot** diff against a stale branch reporting deletions that did not exist
- [ ] Report-only is recorded as the decision, with a note that promoting it to a blocking gate is a separate call with its own item
- [ ] Impact class stated per `docs/agents.md` §Changing the methodology

### 2026-10-11 @ses_ed55fd9c7ffe3s2uXQDixTbTOW
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

| # | crafted state | expected | observed |
|---|---|---|---|
| 1 | paired `D cli/src/adapters.ts` + `D cli/src/adapters.test.ts` + `D docs/old.md` | every `D` row listed, the pair warned | 3 rows listed, `::warning:: paired deletion — cli/src/adapters.ts (implementation) and cli/src/adapters.test.ts (test) … compiles and stays green`, exit 0 |
| 2 | same state with `--strict` | exit 1 | exit 1 |
| 3 | `D` implementation only / `D` test only / `D docs/old.md` | listed, never paired | listed, `verdict: no paired deletions`, exit 0 |
| 4 | branch deletes NOTHING; base moved ahead and gained a module + its test (three-dot) | no pair | `verdict: no deletions in this diff`, exit 0 |
| 5 | same state, two-dot view (raw git) | both `D` rows present = the #586 phantom | `D cli/src/late.test.ts`, `D cli/src/late.ts` — demonstrated in the suite, not just described |
| 6 | unrecognizable `--base refs/heads/does-not-exist` | exit 2, never a quiet pass | exit 2, message names the shallow-fetch remedy |
| 7 | this branch as it stands | no deletions | `verdict: no deletions in this diff`, exit 0 |

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
