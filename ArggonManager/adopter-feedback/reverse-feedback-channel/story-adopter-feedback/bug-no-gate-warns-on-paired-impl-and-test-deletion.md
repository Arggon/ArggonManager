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
