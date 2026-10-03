---
type: bug
status: in_progress
id: bug-three-acceptance-parsers-diverging
title: "Three different acceptance-box parsers with no parity test, and they ALREADY diverge (CRLF, `- [ ] x`): the done gate refuses, the board and goal-mode report \"no unchecked box\""
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

### 2026-10-03 @Arggon
## Round 2 — all findings addressed (`fix/bug-three-acceptance-parsers-diverging`, 5 new commits)

The reviewer was right on F1 and I am glad it caught it: **the refactor did drop refusals**, and my own evidence was blind to it for a specific, fixable reason (below).

### F1 (blocking) — the gate's refusal set DID change. Root cause and fix

`acceptanceRows` split on `"\n"`. The gate has always been a `/…/gm` regex, and JS `^` under `m` anchors after **every** LineTerminator — `\n`, `\r`, `\u2028`, `\u2029` — so a `\n`-only split glued the rest of a CR / U+2028 / U+2029 body onto the previous line and a criterion the gate refused on went invisible. Reproduced first, in isolation:

```
body                          pre-fix    shipped    fixed
- [x] a<U+2028>- [ ] b\n      REFUSE     ALLOW      REFUSE
prose<U+2028>- [ ] b\n       REFUSE     ALLOW      REFUSE
- [x] a<U+2029>- [ ] b\n      REFUSE     ALLOW      REFUSE
- [x] a\r- [ ] b\n            REFUSE     ALLOW      REFUSE
- [x] a\v- [ ] b\n           ALLOW      ALLOW      ALLOW   (not a LineTerminator)
LF / CRLF                     REFUSE     REFUSE     REFUSE
```

Fix: `ACCEPTANCE_LINE_BREAK = /[\n\r\u2028\u2029]/`. Deliberately **not** `\v` / `\f` — they are whitespace but not LineTerminators, so `^` never anchored after them; splitting on them would have ADDED a refusal. Both directions are now asserted.

**Why my evidence missed it (the reviewer is right, and it was the generator, not just the cases):** `CORPUS` built CRLF twins via `replace(/\r?\n/g, …)`, and the fuzz put `\r` only at END of line — exactly where old and new already agree. Fixed at the source:

- every shape is now emitted for **all five terminators plus "as written"**
- 8 shapes exist **only** under a non-`\n` terminator (incl. the `\v`/`\f` counter-shapes that must NOT become rows)
- the product fuzz varies the terminator and joins a ticked row to an unticked one **with it**, which is where it decides the answer

### The pre-fix oracle is green again — that is the acceptance evidence

The per-shape `acceptanceComplete(body) === preFixGate(body)` assertion now runs over corpus, real items and both fuzzes and passes. **Proof it is not vacuous:** reverting the one-line kernel fix turns **49 of 271** tests red, including the named `the gate refuses on a body terminated by ANY LineTerminator (review F1)` — which fails on its own when run alone. That is the decisive probe the reviewer asked for, and it is committed.

### F2 (blocking) — JSON contract drift, documented

`docs/json-output.md` and `README.md` no longer say "parsed from the clipped prose" / `{text, checked}`. Both now state the canonical-body input, why it changed (a bounded, comment-stripping `prose` reported "nothing unchecked" on a comment-filed checklist and on a criterion past the 8 KiB cap), and a field table for `criterion` / `acceptance_truncated` / `acceptance_complete`.

**schemaVersion: NO BUMP — decided and stated in the doc.** All three are additive: nothing removed, retyped or made optional, and `text`/`checked` keep their meaning. That is precisely what the document's own rule covers ("Additive fields are OK within a `schemaVersion`; breaking changes bump `schemaVersion`"), and every prior field addition follows the same precedent. The only consumer that notices is a strict `additionalProperties: false` validator — the ordinary cost of an additive field, and noted in the doc so the decision is recorded rather than implied.

### F3 — the vacuous assertion is gone

`toBeGreaterThanOrEqual(0)` is true for every array including the empty one, so it asserted nothing. Replaced with a floor of **1**, plus a per-item assertion that each such item really has an unchecked criterion the gate sees and `showBoundedParts` cannot. Measured on this tracker: **25 items**.

### F4 — the numbers, re-stated from the suite itself

The suite now **prints its own sizes**, so every figure below is re-runnable rather than remembered (`npx vitest run cli/src/acceptance-parity.test.ts --reporter=verbose`):

```
[acceptance-parity] corpus: 43 shapes (35 base + 8 terminator-only) x 5 terminators + as-written = 258 cases
[acceptance-parity] random fuzz: 200000 bodies, 5249 refused (2.6%)
[acceptance-parity] live: 478 items, 81 blocked by the gate, 25 would disagree if a reader stripped comment sections
```

My previous comment said "77 shapes / 70 cases" and "1890 product cases" — both wrong — and quoted a 400k fuzz that existed only in an uncommitted scratch probe. The 200k random fuzz is **now committed, seeded (mulberry32) and re-runnable**. It is also *row-biased*, and deliberately so: the first version of that harness asserted `toBeGreaterThan(1000)` on a count that was always **0** — a pure-alphabet fuzz essentially never assembles a valid criterion. The committed version demands >2000 real refusals and >1%, so it fails loudly if the generator stops producing any.

### F5 — the doc comment no longer describes the pre-fix regex

It claimed `m` and `$` behaviour the shipped marker does not have — which is precisely where F1 hid. It now describes what the code does and names the LineTerminator set, with the false-pass it prevents written out, and why `\v`/`\f` are excluded.

### F6 — the `spec.ts` narrowing is tested

`decides 'is this Acceptance section testable' with the kernel's rows`: the two-space box the old `CHECKBOX_PATTERN` wrongly accepted **still** reads as untestable (the narrowing fixed that, it did not regress it), and the canonical / glued / bare / star / indented / CRLF forms stay testable.

### F7/F8 — the rule's claim corrected to what the rule does

It now says plainly that it catches a fifth **GRAMMAR** (code that recognises boxes itself) and **not** a fifth wrong **INPUT** — grammar shape says nothing about which bytes a consumer hands the kernel, so it would not have caught either bug this item actually closed; both live in code that already called the right parser. And it admits the over-approximation the reviewer measured: `\[[xX]?\]` and alternation spellings fire, and so does a regex that merely *mentions* a box, which is why `lib/src/**` and `**/*.test.ts` are excluded.

### Live corpus, re-measured

```
items: 478   (bounded prose differs from the body: 284;  CRLF bodies in this tree: 0)
BEFORE  board=27  native panel=30  cli pane=0
AFTER   board=0   native panel=0   cli pane=0
gate refusal-set changes: 0
```

Before/after on the two named shapes, gate and every consumer agreeing in both:

```
CRLF item       gate BLOCKS | BEFORE board [] ("nothing unchecked") | AFTER board ["first","second"], panel 1/3
comment-only    gate BLOCKS | BEFORE board [] , panel 0/0         | AFTER board ["criterion filed as a comment"], panel 1/2
```

### Gates — all green

`npm run build` → `npm test` (**123 files, 2547 passed**) → `npm run lint` → `npm run arggon -- validate` → `npm run check:plugin` → `npm run test:structure` → `npm run lint:structure`. Working tree clean.

**Smoke:** `npm run smoke:tui-board` **passed** (10/10, including "the detail pane renders the seeded acceptance rows and the body"). `npx playwright test --grep @smoke` **33/33 passed** — the board-HTML change the reviewer wanted evidence for.

`npm run smoke:opencode` **FAILS, but it is not this change.** I verified it rather than asserting it: a read-only checkout of clean `origin/main` in a throwaway worktree produces the **identical 47 failures** (`diff` of the two sorted FAIL sets is empty). Every failure is a "model executed/drove X" assertion — it needs a live model session, and the log shows `context7` MCP connections closing. Pre-existing/environmental.

Also caught by `check:plugin` this round: the committed plugin bundle still carried the `split("\n")` scan, so the **vendored** kernel would have kept the F1 false-pass even after `lib/src` was fixed. Regenerated and committed (`7f8336b6`).

### Sequencing — not acted on

Per the reviewer's ruling I have **not** touched `cli/src/goal-mode.ts` or any ZCode asset; none are on `main`. After this merges, #605's goal-mode header needs its stale claims updated ("TWO parsers", the CRLF-blind claim, `normalizeEol` "not cosmetic", the now-unreachable `UNRENDERABLE` branch). `docs/json-output.md` is the one file both PRs will want — worth a union resolve.

Item left `in_progress`.

### handoff 2026-10-03 @Arggon — next: Re-review #611: F1 fixed (LineTerminator split, oracle green, 49 tests red on revert), F2-F8 landed. smoke:opencode fails identically on clean origin/main (47/47) - environmental.
- branch: fix/bug-three-acceptance-parsers-diverging
- open questions: After #611 merges: #605's goal-mode header needs its stale claims updated. docs/json-output.md is shared by both PRs - union resolve. Unrelated pre-existing: describe.sequential vs vitest 5.0.0 types…
