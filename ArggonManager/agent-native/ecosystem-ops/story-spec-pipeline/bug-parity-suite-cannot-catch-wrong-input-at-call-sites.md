---
type: bug
status: todo
id: bug-parity-suite-cannot-catch-wrong-input-at-call-sites
title: "The acceptance-parity suite hands two consumers `acceptanceBody(item)` itself, so a reverted/wrong call site stays green — input coverage is only structural, not tested"
parent: story-spec-pipeline
labels: [tests, done-gate]
created: "2026-10-03"
updated: "2026-10-03"
depends_on: [bug-convention-md-acceptance-terminator-framing]
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-parity-suite-cannot-catch-wrong-input-at-call-sites.md
  Leaves live only under a story. id is the filename stem: bug-parity-suite-cannot-catch-wrong-input-at-call-sites.
  CLI `arggon create bug parity-suite-cannot-catch-wrong-input-at-call-sites` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The acceptance-parity suite hands two consumers `acceptanceBody(item)` itself, so a reverted/wrong call site stays green — input coverage is only structural, not tested

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Raised by the worker on PR #613 (bug-convention-md-acceptance-terminator-framing) and by the reviewer of PR #611, 2026-10-03. It is a coverage hole, not a bug in shipped behavior.

**What the parity suite proves and what it cannot.** `cli/src/acceptance-parity.test.ts` drives one kernel predicate over a large generated corpus and a pre-fix oracle — excellent evidence that the GRAMMAR is unified and the gate's refusals are unchanged. But for two consumers the test itself supplies `acceptanceBody(item)`:

- `parseAcceptanceRows` (`cli/src/board.ts`)
- `tuiAcceptanceRows` (`cli/src/tui.ts`)

and `board.ts`'s `detailPayloadOf` fixture keeps the checklist inside the body. So if a call site were reverted to pass clipped or comment-stripped prose, the suite would stay green: the wrong-input class that produced the 21/280 live disagreement (gate vs goal contract) is not what the suite tests. The wording "a fifth wrong input" comes from the ast-grep README and is inherited — the ast-grep rule catches a fifth GRAMMAR (a new regex), not a fifth wrong INPUT.

Why this matters more than it looks: the whole #605 round-2 defect was an input-layer divergence with the predicate already correct. The grammar is now enforced; the input is only enforced by convention and by the doc added in #613.

Acceptance:
- [ ] At least one consumer's call site is covered against a WRONG input: feed a comment-filed checklist and a clipped-prose body through `cli/src/board.ts` and `cli/src/tui.ts` and assert they agree with the kernel predicate
- [ ] Or, if the call sites are structurally incapable of passing anything but the canonical body, that is the claim to prove — by type or by a lint rule, not by inspection — and the parity suite's header then says so precisely
- [ ] The ast-grep README's "fifth wrong input" phrasing is corrected to "fifth grammar", or the rule is extended to cover the input side
- [ ] Depends on PR #613 (the doc now states the input invariant, so the wording should match what is actually enforced)
