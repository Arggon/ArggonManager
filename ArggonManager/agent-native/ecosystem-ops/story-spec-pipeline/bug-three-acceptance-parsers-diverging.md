---
type: bug
status: todo
id: bug-three-acceptance-parsers-diverging
title: "Three different acceptance-box parsers with no parity test, and they ALREADY diverge (CRLF, `- [ ] x`): the done gate refuses, the board and goal-mode report \"no unchecked box\""
parent: story-spec-pipeline
labels: [tracker-schema, done-gate]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-three-acceptance-parsers-diverging.md
  Leaves live only under a story. id is the filename stem: bug-three-acceptance-parsers-diverging.
  CLI `arggon create bug three-acceptance-parsers-diverging` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Three different acceptance-box parsers with no parity test, and they ALREADY diverge (CRLF, `- [ ] x`): the done gate refuses, the board and goal-mode report "no unchecked box"

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] ONE predicate in `lib/src/items.ts` decides what an acceptance row is, and all three call sites use it; any parser that cannot be unified defers to the kernel explicitly and says so in a comment
- [ ] A parity test asserts the three agree across a corpus of shapes: LF and CRLF, empty boxes, ticked/unticked, bare markers, indented markers, and text containing the literal `- [ ]` inside a code span
- [ ] The CRLF case specifically: the done gate refuses, and the board and goal contract ALSO report the unchecked boxes (no "nothing unchecked" while the gate blocks)
- [ ] The `- [ ] x` case has one decided answer, documented in `docs/convention.md` so an author knows which form is a row
- [ ] PR #605's prose that calls the board's parser "the kernel's own" is corrected everywhere it shipped (five places including docs) — a claim naming the wrong owner is how the next agent re-introduces this
- [ ] No behavior change to the done gate's refusals beyond making the other two agree with it

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the reviewer of PR #605 (task-zcode-goal-mode), 2026-10-03, while checking a load-bearing claim. **This is a done-gate correctness defect, not a code-duplication nit.**

There are now THREE acceptance-box parsers, in three places, with no parity test between any two of them:

1. `acceptanceComplete` — `lib/src/items.ts:329` — **the done gate** (ADR 0015), which decides whether `--status done` is allowed
2. `parseAcceptanceRows` — `cli/src/board.ts:724` — the board renderer
3. a third ad-hoc filter inside `cli/src/goal-mode.ts` (PR #605)

They **already diverge, in both directions, on reachable inputs**:

- **CRLF**: the frontmatter parser explicitly tolerates `\r\n`, but a `.` in a regex does not match `\r`. On a CRLF item the done gate still finds unchecked boxes and **refuses** the flip, while the board and goal-mode see "no unchecked criterion" — so the goal contract tells an agent the work is complete when the gate will reject it. That is precisely the inversion the reviewer was asked to hunt for.
- **`- [ ] x`** (a bare marker with trailing content, no space-separated text): the regexes disagree on whether it is a row.

Consequence: the tracker can show a board or a goal contract claiming every acceptance box is ticked while the kernel refuses to close the item — and an agent following the goal contract has been told, by our own tooling, that it is finished.

The fix is one predicate in `lib/src/items.ts` used by all three (the kernel is the only place all three can share, since the board and goal-mode both run inside this package's consumers), plus a parity test asserting the three agree across a corpus of shapes: LF/CRLF, empty boxes, ticked/unticked, bare markers, indented markers, and text containing the literal `- [ ]` inside a code span. Any parser the fix cannot unify must be made to defer to the kernel explicitly and say so in a comment.

Also required: the prose in PR #605 that calls the board's parser "the kernel's own" must be corrected wherever it shipped (the claim appears in five places including shipped docs) — a claim that names the wrong owner is how the next agent re-introduces the bug.
