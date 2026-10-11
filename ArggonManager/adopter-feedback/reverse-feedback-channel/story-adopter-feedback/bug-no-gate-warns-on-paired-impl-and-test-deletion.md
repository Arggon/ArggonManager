---
type: bug
status: in_progress
id: bug-no-gate-warns-on-paired-impl-and-test-deletion
title: "Nothing gates a `D` row that removes an implementation and its paired test together — the silent shape that goes green, and it has been reported twice and tracked zero times"
assignee: arggon-delivery-lead
branch: fix/bug-no-gate-warns-on-paired-impl-and-test-deletion
parent: story-adopter-feedback
labels: [ci, tests]
created: "2026-10-06"
updated: "2026-10-11"
claimed_at: "2026-10-11T11:00:45.402Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-no-gate-warns-on-paired-impl-and-test-deletion
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
