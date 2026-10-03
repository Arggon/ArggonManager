---
type: bug
status: in_progress
id: bug-three-acceptance-parsers-diverging
title: 'Three different acceptance-box parsers with no parity test, and they ALREADY diverge (CRLF, `- [ ] x`): the done gate refuses, the board and goal-mode report "no unchecked box"'
assignee: Arggon
branch: fix/bug-three-acceptance-parsers-diverging
parent: story-spec-pipeline
labels: [tracker-schema, done-gate]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T02:49:53.379Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-three-acceptance-parsers-diverging
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

- [x] ONE predicate in `lib/src/items.ts` decides what an acceptance row is, and all three call sites use it; any parser that cannot be unified defers to the kernel explicitly and says so in a comment
- [x] A parity test asserts the three agree across a corpus of shapes: LF and CRLF, empty boxes, ticked/unticked, bare markers, indented markers, and text containing the literal `- [ ]` inside a code span
- [x] The CRLF case specifically: the done gate refuses, and the board and goal contract ALSO report the unchecked boxes (no "nothing unchecked" while the gate blocks)
- [x] The `- [ ] x` case has one decided answer, documented in `docs/convention.md` so an author knows which form is a row
- [x] PR #605's prose that calls the board's parser "the kernel's own" is corrected everywhere it shipped (five places including docs) — a claim naming the wrong owner is how the next agent re-introduces this
- [x] No behavior change to the done gate's refusals beyond making the other two agree with it

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

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Coordinator update after the round-2 review of PR #605 (2026-10-03) — **the class defect is confirmed with measured reachability, and there is a second, sharper instance of it.**

The goal-mode fix closed the wrong-input question at the PREDICATE layer (it now calls the done gate's `acceptanceComplete` and publishes its verdict verbatim as `goal.gateUnchecked`), but the review found the INPUT differs: `acceptanceComplete(item.body)` (the gate, `lib/src/update.ts:526`) versus `acceptanceComplete(shown.prose)` (the goal, `cli/src/goal-mode.ts:526`), where `shown.prose` excludes comment sections.

That is not hypothetical. **21 of 280 items in this tracker with comments disagree** — the gate refuses to close, the goal contract says nothing remains. And filing a checklist as a comment is a FIRST-CLASS shape here: `arggon create` has no `--body` flag, and `bug-empty-template-checkbox` carries an acceptance box for exactly this case. So this is the path every newly created item takes.

This sharpens the acceptance for this bug beyond parser unification: the SAME BODY must be presented to every consumer. If a reader trims, normalizes or filters the body before calling a predicate, it has changed the question being asked — and here it produces a false "you are finished".

Add to this item's scope:

- (a) one kernel predicate over one canonical body, with readers forbidden to pre-filter (LF normalization is fine if applied identically to what the gate sees; comment stripping is NOT)
- (b) an explicit test over the LIVE corpus: assert every item with comments yields the same verdict from the gate and from any consumer, so a 21/280 disagreement can never reappear silently
- (c) the PR #605 one-line fix (pass `shown.item.body`, already in scope at `goal-mode.ts:509`) lands in that PR; this item owns the general guarantee

### 2026-10-03 @Arggon

## Worker evidence — `fix/bug-three-acceptance-parsers-diverging` (8 commits, pushed, rebased on origin/main)

### Scope correction: there were SIX grammars, not three

The item names three. Counting what actually shipped on `origin/main` before this branch:

| #   | site                                                      | rule                                                    | disagreed with the gate?                           |
| --- | --------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------- |
| 1   | `lib/src/items.ts` `acceptanceComplete`                   | `^[ \t]*[-*] \[( \|x\|X)\][ \t]*[^\s]`                  | reference                                          |
| 2   | `cli/src/board.ts` `parseAcceptanceRows`                  | `/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/` over `split("\n")`   | **yes** — CRLF-blind, glued box, two-space box     |
| 3   | `cli/src/tui.ts` `tuiAcceptanceRows`                      | `/^[ \t]*[-*] \[( \|x\|X)\]/`                           | no (agreed by luck)                                |
| 4   | `opencode/plugins/arggon/board.ts` `BOARD_ACCEPTANCE_ROW` | `/^\s*[-*]\s+\[([ xX])\]\s?(.*)$/` over `runShow` prose | **yes** — two-space box, comment-stripped input    |
| 5   | `cli/src/spec.ts` `CHECKBOX_PATTERN`                      | `/^\s*[-*]\s+\[[ xX]\]/`                                | **yes** — two-space box (advisory `warn`, no gate) |
| 6   | `cli/src/goal-mode.ts` (PR #605, unmerged)                | inherited #2                                            | **yes** — inherited CRLF blindness                 |

**CRLF correction:** the coordinator's `.`-vs-`\r` claim is real but belongs to `cli/src/board.ts` only. The native panel split on `/\r?\n/` and `trimEnd()`, so it was CRLF-safe; its two defects were `\s+`+`\s?` and the comment-stripped input. My own first comment got this wrong and commit `40df5cb8` corrects it — the point of the item is that a claim naming the wrong owner re-introduces the bug.

### Live-corpus disagreement count, measured through the real readers

```
items: 475   (items whose bounded prose differs from the body: 281;  CRLF bodies in this tree: 0)
DISAGREEMENTS with the done gate (gate blocks, consumer says "nothing left"):
  BEFORE  board=24   native panel=27   cli pane=0    (of 281 items with comment sections)
  AFTER   board=0    native panel=0    cli pane=0    (of 475 items)
gate refusal-set changes: 0
```

**0 CRLF bodies exist in this tracker today**, so the CRLF defect is proven by the corpus, not by the live tree; it stays reachable for any adopter checkout (the frontmatter parser explicitly tolerates `\r\n`). The comment-stripping defect _is_ instantiated: 281 items, 24–27 of them disagreeing, which is the coordinator's 21/280.

### Acceptance 6 — no refusal change, proven twice

1. `acceptanceComplete` is now **specified as** `acceptanceUnchecked(body).length === 0`, and that row set is exactly the old regex's (the parity corpus asserts `gateComplete === preFixGate(body)` for all 77 shapes × LF/CRLF, plus a 3150-case marker×box×separator×text×EOL product).
2. Off-line: 8640 generated bodies and 400 000 seeded random strings — **0** verdict differences against the pre-fix regex.

### Before/after on the two shapes the coordinator named

**CRLF item** (`- [ ] first\r\n- [ ] second\r\n- [x] third\r\n`):

```
gate            : BLOCKS the done flip
BEFORE board    : []                                     -> "nothing unchecked"   <-- INVERSION
AFTER  board    : ["first","second"]
AFTER  pane     : ["first","second"]
AFTER  panel    : 1/3, rows ["[ ] first","[ ] second","[x] third"]
verdict agreement: gate blocks=true board=true pane=true panel=true
```

**Comment-only checklist** (the `create`-has-no-`--body` shape):

```
gate            : BLOCKS the done flip
BEFORE board    : []                                     -> "nothing unchecked"   <-- INVERSION
BEFORE panel    : []   (runShow prose had only the placeholder) -> 0/0   <-- INVERSION
AFTER  board    : ["","criterion filed as a comment"]
AFTER  pane     : ["criterion filed as a comment"]
AFTER  panel    : 1/2, rows ["[ ]","[ ] criterion filed as a comment","[x] already done"]
verdict agreement: gate blocks=true board=true pane=true panel=true
```

### Gates (all green, in order)

`npm run build` → `npm test` (123 files, **2356 passed**) → `npm run lint` → `npm run arggon -- validate` → `npm run check:plugin` → `npm run test:structure` → `npm run lint:structure`. Working tree clean; `npm run skills:sync` reports 7 files byte-equal (no skill/template edit was needed).

### Deliverables

- **One predicate**: `acceptanceRows` / `acceptanceCriteria` / `acceptanceUnchecked` / `acceptanceComplete` / `acceptanceBody` in `lib/src/items.ts`. `acceptanceBody`'s doc comment states the canonical-body invariant where a future reader hits it (the #605 round-2 trap by name).
- **Every consumer defers, no regex left**: `cli/src/board.ts`, `cli/src/tui.ts`, `opencode/plugins/arggon/board.ts` and `cli/src/spec.ts` now call the kernel; each says so in a comment. `tools/ast-grep/rules/acceptance-rows-use-kernel.yml` makes a fifth grammar a lint error (with its own rule test + README section, and its documented limits).
- **Parity corpus**: 77 shapes × LF/CRLF, the real-item fixture, and the **full** live corpus in the default suite (the parity file runs in ~0.5 s, so no bounded-sample/probe split was needed). The three pre-fix parsers are kept as oracles so a regression cannot be "fixed" by reverting.
- **`- [ ] x` decided** in `ArggonManager/docs/convention.md` §Acceptance rows: it **is** a row and **does** gate (so is `- [ ]x`); `-  [ ] x` is **not** a row, kept exactly as-is so no refusal was added; `- [ ]` bare is a row but not a criterion; the literal in a code span is never a row.

### Two things for the coordinator

1. **PR #605 must be re-checked after this merges.** Its corrected header now says "there are TWO parsers, not one", names `cli/src/board.ts` as CRLF-blind, requires `normalizeEol` "not cosmetic", and keeps an `UNRENDERABLE` branch for "the kernel predicate and the checklist reader disagree on this body". After this merge all four are false: there is one parser, the kernel is CRLF-safe, `normalizeEol` is optional, and that branch is unreachable. Those files are not on `main`, so I could not correct them from here. The board's own "kernel's own" prose was already corrected in #605 (item Notes line 907 records it) and nothing stale shipped on `main` — verified by grep.
2. **`describe.sequential` in `cli/src/headless-ci.test.ts:150` does not typecheck against the installed vitest 5.0.0** (`SuiteAPI` has no `sequential`), which fails `npm run build`'s `tsconfig.typecheck.json` pass. Pre-existing, not mine, not fixed here.

### handoff 2026-10-03 @Arggon — next: Review + open the PR for fix/bug-three-acceptance-parsers-diverging (pushed, 9 commits, all gates green); then re-check PR #605's goal-mode header after this merges.

- branch: fix/bug-three-acceptance-parsers-diverging
- open questions: #605's 'TWO parsers / CRLF-blind board / normalizeEol required / UNRENDERABLE' prose becomes false once this merges - who updates it? Also pre-existing: describe.sequential vs vitest 5.0.0 types brea…
