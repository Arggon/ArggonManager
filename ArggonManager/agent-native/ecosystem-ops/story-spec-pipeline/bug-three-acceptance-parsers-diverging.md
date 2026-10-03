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

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Coordinator update after the round-2 review of PR #605 (2026-10-03) — **the class defect is confirmed with measured reachability, and there is a second, sharper instance of it.**

The goal-mode fix closed the wrong-input question at the PREDICATE layer (it now calls the done gate's `acceptanceComplete` and publishes its verdict verbatim as `goal.gateUnchecked`), but the review found the INPUT differs: `acceptanceComplete(item.body)` (the gate, `lib/src/update.ts:526`) versus `acceptanceComplete(shown.prose)` (the goal, `cli/src/goal-mode.ts:526`), where `shown.prose` excludes comment sections.

That is not hypothetical. **21 of 280 items in this tracker with comments disagree** — the gate refuses to close, the goal contract says nothing remains. And filing a checklist as a comment is a FIRST-CLASS shape here: `arggon create` has no `--body` flag, and `bug-empty-template-checkbox` carries an acceptance box for exactly this case. So this is the path every newly created item takes.

This sharpens the acceptance for this bug beyond parser unification: the SAME BODY must be presented to every consumer. If a reader trims, normalizes or filters the body before calling a predicate, it has changed the question being asked — and here it produces a false "you are finished".

Add to this item's scope:
- (a) one kernel predicate over one canonical body, with readers forbidden to pre-filter (LF normalization is fine if applied identically to what the gate sees; comment stripping is NOT)
- (b) an explicit test over the LIVE corpus: assert every item with comments yields the same verdict from the gate and from any consumer, so a 21/280 disagreement can never reappear silently
- (c) the PR #605 one-line fix (pass `shown.item.body`, already in scope at `goal-mode.ts:509`) lands in that PR; this item owns the general guarantee

### 2026-10-03 @arggon-reviewer
verdict: request-changes (done-gate refusal set changes on CR / U+2028 / U+2029 separators; the documented JSON contract does not travel with two new payload fields)

Reviewer pass over PR #611 (branch `fix/bug-three-acceptance-parsers-diverging`, HEAD `471bb76a`, 9 commits, base `e27e9e66`). Read-only: I executed **no** project gate (build / test / lint / structure / smoke). Everything below is either a file reference, a JS-regex **semantics** probe (node on a transcribed regex, not repo code), or a read-only walk of this tracker.

## Blocking

### F1 \ the refactor DOES change the done gate's refusals (false-pass direction)

`acceptanceRows` (`lib/src/items.ts:411`) iterates `body.split(`BS`"n")`. The pre-fix gate regex `/^[ \t]*[-*] \[( |x|X)\][ \t]*[^\s]/gm` carries `m`, and JS `^` under `m` matches after **every** LineTerminator \BS`n`, `BS`r`, `BS`u2028`, `BS`u2029`. Rows after a lone CR or a U+2028/U+2029 are therefore invisible to the new parser.

Semantics probe, pre-fix regex transcribed verbatim from `main:lib/src/items.ts:329`, post-fix transcribed from the PR:

```
body                                     pre-fix      post-fix
`- [x] a\BS`u2028- [ ] b\BS`n`                  REFUSE       ALLOW(done)   <-- gate false-pass
`prose\BS`u2028- [ ] b\BS`n`                   REFUSE       ALLOW(done)   <-- gate false-pass
`- [x] a\BS`u2029- [ ] b\BS`n`                  REFUSE       ALLOW(done)
`- [x] a\BS`r- [ ] b\BS`n`                     REFUSE       ALLOW(done)
`- [ ] a\BS`r- [x] b\BS`n`                     REFUSE       REFUSE        (row set still differs)
LF / CRLF variants                      REFUSE       REFUSE        (unchanged)
```

This violates the item's own acceptance box 6 (`No behavior change to the done gate's refusals`) and DoD #5 (`No known validate false-pass for the new behavior`), and it is precisely the class the item exists to close: the gate permits a `done` flip on an item that still carries an unchecked criterion.

It also explains why the differential evidence cannot carry the `no refusal change` claim. Neither the corpus nor the fuzz product contains such a separator: `CORPUS` (`cli/src/acceptance-parity.test.ts:68`) builds its CRLF twins by splitting on `/\BS`r?\BS`n/`, and the fuzz `markers` (`:322`) are `["-","*","  -","\BS`t-","   *","-  ","-","+","1."]` with `texts` (`:325`) = `["","a"," x","x","\BS`u00a0x","  ","a\BS`r"]` \ the `\BS`r` only ever lands at end-of-line, where the old regex and the new one already agree. Reachability is low but real (a body pasted with U+2028, a lone-CR body, any adopter checkout); on a done-gate item that is blocking, not a follow-up.

Fix, one line inside `acceptanceRows`: iterate JS LineTerminator boundaries instead of `\BS`n` \ e.g. split on `/\BS`r\BS`n>|[\BS`r\BS`u2028\BS`u2029]/` as a RegExp built from escapes, plus two `CORPUS` shapes and a `U+2028` separator in the fuzz `markers`. The pre-fix oracle then going green **is** the proof it was the right fix.

### F2 \ documented JSON contract drift (docs do not travel with code)

`cli/src/board.ts` `detail` gains two public fields, each row gains a third, and the bound moves from prose bytes to a row count over the whole canonical body:

- new `acceptance_truncated: boolean` (`cli/src/board.ts:698-701`, populated `:813`) and `acceptance_complete: boolean` (`:703-708`, `:819`)
- `acceptance[]` element shape: `{ text, checked }` -> `AcceptanceRow` = `{ text, checked, criterion }` (`cli/src/board.ts:688-691`)
- bound: `MAX_DETAIL_ACCEPTANCE_ROWS = 64` (`cli/src/board.ts:730`) over `acceptanceBody(kernelItem)`, replacing `the prose cap also bounds the acceptance rows`

Untouched and now false:
- `ArggonManager/docs/json-output.md:597` \ `acceptance[] ("{text, checked} rows parsed from the prose) … (the same caps bound the acceptance rows)`
- `ArggonManager/docs/json-output.md:585` \ `acceptance rows parsed from the clipped prose`
- `README.md:418` \ `acceptance rows are parsed from the clipped prose`
- `ArggonManager/docs/opencode2.md:290` and `playbooks/opencode.md:263,473` \ the panel footer/blocks are rows; the count is now **criteria**

`json-output.md` is the documented public contract for `GET /api/item` and `--details`, and `engineering.md` makes `docs that travel with code` and `no silent schema forks` review-bar items. Also: `cli/src/board-serve.ts:184-190` deliberately re-exports `the byte caps, the clippers, the acceptance-row parser` to keep the serve import path \ the new `MAX_DETAIL_ACCEPTANCE_ROWS` should ride along there.

## Should ride along

### F3 \ a vacuous non-vacuity assertion
`cli/src/acceptance-parity.test.ts:587`: `expect(commentOnly.length).toBeGreaterThanOrEqual(0);` inside `it("a comment-filed checklist is reachable: the corpus is not vacuous")`. `>= 0` is a tautology; the comment claims `The assertion is that the SHAPE exists` and the assertion does not assert that. Either `toBeGreaterThan(0)` (the shape is present \ my live walk finds 32 such items) or rename the test to the report-only thing it is. Same smell, harmless, at `:345` (`checked === markers.length * …` restates the loop).

### F4 \ the evidence overstates itself
- `77 corpus shapes x LF/CRLF` -> `CORPUS` has **35** shapes -> **70** cases (`:68-154`; `:222` asserts `CORPUS.length * 2`).
- `a 3150-case product` -> `9 markers x 3 boxes x 5 seps x 7 texts x 2 EOLs` = **1890** (`:322-345`).
- `off-line against the pre-fix regex on 8640 generated bodies + 400 000 fuzz strings (0 differences)` -> no committed harness, not reproducible from the repo. The *in-repo* differential (`preFixGate` oracle, `:175-179`) is real and does run in `npm test`; label the off-line numbers as off-line, or ship the script.

Right kind of evidence, wrong numbers. On a done-gate change the numbers are the argument.

### F5 \ stale rationale in the kernel's own doc comment
`lib/src/items.ts:329-333` claims that `m` gives `^` and `$` their per-line meaning and that `$` matches before a `\BS`r`, so the captured text never carries the carriage return. `ACCEPTANCE_MARKER` (line 336) has **no `m` flag and no `$`** \ it is applied per line already. That comment describes the pre-fix regex. It is also where F1 hides: CRLF is solved by the line splitting, not by the regex \ and the line splitting is what breaks on the other LineTerminators.

### F6 \ `cli/src/spec.ts` narrows an advisory check, untested and unremarked
Old `CHECKBOX_PATTERN` allowed `\BS`s+` between bullet and box and required no space after the box. New: the kernel marker (exactly one space after the bullet). So `-  [ ] x`, `-\BS`t[ ] x`, `*   [x] ok` now raise `untestable-acceptance` where they did not \ a **new advisory finding on an existing spec**. `:537-543` calls the finding advisory and notes that deferring `changes no refusal` (true) but does not record the narrowed detection, and `cli/src/spec.test.ts` has no two-space/tab checkbox case (grep: none). Unifying the grammar is right; shipping the narrowing undocumented and untested is not.

### F7 \ the guard catches the fifth *grammar*, not the fifth *wrong input*
The rule forbids a row-shaped regex. The deeper half of the #605 defect was a correct predicate over the wrong string, which no syntax rule can see \ and the PR now has two such calls: `cli/src/spec.ts:544` (`acceptanceRows(section)` on a spec file section) and `opencode/plugins/arggon/board.ts:465` (`acceptanceRows(row)` on one reader-derived prose line). Both are legitimate today (neither is a verdict about an item body) and both are the exact shape a future reader copies. Every other call site got the `why this input is canonical` note; these two should too \ or `acceptanceBody` should return a nominal type so the wrong input is a compile error (needs an escape for `spec.ts`, which genuinely has a non-item section \ a decision worth making, not necessarily in this PR).

### F8 \ `tools/ast-grep/README.md` and the rule `note` understate the rule
The compiled pattern from that YAML single-quoted string is a literal ``, one or more of `` ) | space tab x X, an optional ``, then `` (single-quoted YAML does not collapse ``, and the `(` is the first char **inside** the class). Semantics probe over the rule's own fixtures and neighbours:

```
invalid-1 BOARD_ACCEPTANCE_ROW            FIRES (matches "[ xX]")
invalid-2..6 (gate marker, x-only,         FIRES
              gate full, bare box, ticked)
valid-1..3   (md link, negated class,      passes
              quantifier inside the class)
quantified box  "\[[xX]?\]"               README/rule: does not fire   FIRES
two groups      "[ ]|\[x\]"               README/rule: does not fire   FIRES
escaped class   "\[[\s]*x\]"              README/rule: correct          passes
```

So the rule genuinely holds \ it catches a differently-named out-of-kernel row regex regardless of identifier, it covers `cli/src/**` and `opencode/plugins/arggon/board.ts` (only the generated bundle is ignored), and `npm run test:structure` (`ast-grep test --skip-snapshot-tests` plus a fixture scan) and `npm run lint:structure` (`ast-grep scan` from the repo root) both cover it. But coverage is **broader** than documented, and `the false-positive rate is zero` is an overclaim: a class holding only task-box chars (`/[(]/`, `/[x]/` used to match a literal) fires. Correct the limitations list.

On the scope question: `files` is `**/*.ts` / `**/*.tsx`, and I verified `templates/` and `skills/` contain **only** `.md` and `.mjs` (zero `.ts` / `.tsx` under either), so nothing escapes today \ but a future `skills/**/*.mjs` consumer would, and the README scope section should say so rather than leave the reader guessing.

## Verified good \ do not re-litigate

1. **Shape.** One kernel owner; all five consumers defer; a repo-wide grep for the checkbox-shaped class in production code returns only `lib/src/items.ts` prose and unrelated prompt strings in `cli/src/adopt.ts`. `parseAcceptanceRows` / `tuiAcceptanceRows` survive as thin deferring wrappers with no regex, each carrying the `this is NOT a parser` comment.
2. **The parity proof is the right kind of evidence**: a differential against the pre-fix regex kept in-repo as an oracle (`preFixGate`, `:175-179`, plus `preFixBoard` / `preFixPluginRows`), over a corpus **and** a product, not a fixture \ with the pre-fix defects pinned so the test cannot be `fixed` by reverting (`:249-284`). The glued-box / two-space / bare-placeholder / code-span decisions are each asserted with a discriminating value, including the U+00A0 case (I checked the bytes: `c2 a0` at `:303` and `:306`, distinct from the plain-space case at `:302`).
3. **`acceptanceBody` really closes the #605 trap, in the right place.** `lib/src/items.ts:369-395` states the invariant (`Never pass a reader-derived string to an acceptance predicate… A reader that trims, clips, byte-caps, strips HTML comments or strips COMMENT SECTIONS before calling has changed the question`) and names the reachable shape (`arggon create` has no `--body`, so a comment checklist is the default path). Comment-stripping is gone from the path that caused the 21/280 disagreement: `cli/src/board.ts:810,819` and `opencode/plugins/arggon/board.ts:436,512` read `acceptanceBody(...)`; the surviving `prose` work is display partitioning only (`splitBoardDetailRows`, documented as such), and `cli/src/tui.ts:319` feeds the canonical body into the pane. No consumer passes anything but the canonical body for a verdict.
4. **The board inversion is fixed structurally, not cosmetically**: `detailPayloadOf` no longer derives acceptance from `bounded.prose`, and `acceptance_complete` rides next to a byte-bounded list so a clipped list cannot read as `nothing left`. Good.
5. **Live-corpus numbers are believable \ I reproduced them.** Read-only walk of this tracker (files with `type:` + `status:` frontmatter): **485** items, **293** with comment sections, **0 CRLF bodies** (exactly as claimed \ the CRLF claim rests on the generated corpus, not the tree). Pre-fix disagreements against the gate: **board=34, native panel=37, cli pane=0**; post-fix **0/0/0**. Your 24/27/0 on 475 items / 281 commented matches within corpus growth (+10 on both consumer counts, +12 commented items). The cli pane's 0 is real, not luck of the sample \ its old grammar plus skip-empty-text already equals the kernel criterion rule.
6. **Both corrections to the brief are right.** (a) The native panel was **not** CRLF-blind: `main:opencode/plugins/arggon/board.ts:409,420-421` carries `[ xX]` with `\BS`s+` then `\BS`s?`, over `split(/\BS`r?\BS`n/)` + `trimEnd()`; probed on a CRLF body it returns 2 rows. Its real defects were the looser pattern and comment-stripped input \ commit `40df5cb8` correcting the parity-test comment is correct. (b) `cli/src/board.ts` **was** the CRLF-blind one: probed on the same body its pattern over `split(`BS`"n")` returns an empty list (the dot does not match a carriage return, and the dollar anchor has no `m` flag) while the gate refuses. (c) The board's `the kernel's own` prose was already fixed in #605: across every file #605 touches, that phrase appears **only** inside #605's own item file (round-1 verdict quote, line 79; round-2 note, line 907). Nothing stale on `main` \ so that acceptance box belongs to #605, not #611. Correct scoping, and correcting the brief was the right call.
7. **Sequencing ruling: merge #611 first, then update #605 on top of it, then merge #605.** #611 must **not** touch `cli/src/goal-mode.ts`, the ZCode templates or `agents.md` \ none are on `main` (`main` has no `cli/src/goal-mode.ts`) and none are in #611's diff, so editing them from here would be unreviewable. After #611 merges, #605 must: drop `there are TWO parsers, not one` and the board-as-CRLF-blind claim (`goal-mode.ts:16-31`); drop the `normalizeEol` `Required, not cosmetic` rationale and the import (`:77-81`) \ the kernel marker is CRLF-safe by construction; retire the `renderable` / `UNRENDERABLE` branch (`:185`, `:271`), now unreachable because the gate rows and the text rows are the same rows. **Interaction to watch:** #605 also edits `ArggonManager/docs/json-output.md`, so land F2's drawer-contract correction so it survives their merge rather than colliding in the same file.
8. **Scope is clean.** `cli/src/start.ts`, `templates/` and `skills/arggon-cli/**` are untouched (consistent with your `skills:sync` `7 files byte-equal`). No new runtime dependency; no ADR needed (a refactor plus a row grammar ADR 0015 already owns \ your `convention.md` §Acceptance rows table is accurate on all ten shapes I checked, including two-spaces = no and `text - [ ] x` = no). One wording nit: the section's opening sentence defines `acceptance row` with the **criterion** rule while the table's `Row?` column uses the looser one; the table disambiguates, but convention.md is the schema authority. Also add `cli/src/spec.ts` to the consumers that sentence enumerates.

## Probes needed

```
# 1. F1 \ the blocker. Add a CORPUS shape, show the differential oracle fail, then show it pass.
cd /home/arggon/Projects/ArggonManager-bug-three-acceptance-parsers-diverging
npm test -- acceptance-parity
# expected after the fix : shapes 35 -> N, all green, incl. U+2028 / U+2029 / lone-CR twins
# expected before the fix: the gateComplete === preFixGate assertion fails on those shapes
# what it changes: whether F1 is a real gate change or my regex-semantics read is wrong

# 2. structural gates I could not execute
npm run build && npm run lint
npm run test:structure     # expect: acceptance-rows-use-kernel-test.yml passes (6/6 invalid, 3/3 valid)
npm run lint:structure     # expect: 0 findings \ the only evidence for the zero-false-positives claim
npm run check:plugin       # expect: index.bundle.ts byte-equal to build:plugin output; the bundle is
                             # the ONE place a stale parser can reappear (it is rule-ignored)

# 3. blocking smokes (engineering.md): board HTML + /api/item payload + TUI all changed here
npm run smoke:tui-board                        # TUI changed (tuiAcceptanceRows)
npm run smoke:opencode                         # native panel changed; expect 1/2 acceptance (was 0/0)
                                             # on a comment-only checklist
npx playwright test --grep @smoke              # ui-smoke lane green (drawer-note divs are new)
# real-browser drive of board --serve on a fixture, expected vs observed:
#   cards == arggon list; one status change round-trips and persists per arggon show;
#   a comment-only-checklist item renders the done-gate note with acceptance_complete=false
#     in GET /api/item;
#   a >64-row checklist renders the more-rows note with acceptance_truncated=true;
#   the axe-core scan of the drawer state still reports zero violations, no new exclusions.

# 4. CI: confirm the cli job is green on 471bb76a \ I could not read CI status (no network here).

# 5. cli/src/spec.ts (F6): argyon spec audit --json on a spec whose Acceptance section uses
#    two spaces before the box \ expected now one untestable-acceptance finding; observed pre-fix: none.
#    Decides whether F6 needs a doc line + test or is immaterial.
```

**No-merge until F1 and F2 land.** F3-F6 are a few lines each and belong in this PR; F7/F8 are notes the coordinator can route to a follow-up item. Sequencing per finding 7: #611 -> update #605 -> #605.

### 2026-10-03 @arggon-reviewer
verdict: request-changes (unchanged from my previous comment; that comment rendered the backslash escapes as "\BS" instead of "\r" / "\n" in a few code spans and in the F1 evidence block. This comment supersedes its FORMATTING only — every finding, file reference, count and ruling in it stands as written.)

What to re-read from the previous comment, all inside code spans — the prose, the findings and the verdicts were unaffected:

~~~
previous (garbled)                 reads as
`body.split(\BS"n")`                    `body.split(\"n")`
`split(/\BSr?\BSn/)`                       `split(/\r?\n/)`
`[..., \BSt-, ...]`                 `[..., \t-, ...]`
`a\BSr- [ ] b`                    `a\r- [ ] b`
~~~

F1, restated with the escapes intact — the only place the garbling was load-bearing:

~~~
body                                     pre-fix      post-fix
`- [x] a\u2028- [ ] b\n`                  REFUSE       ALLOW(done)   <-- gate false-pass
`prose\u2028- [ ] b\n`                   REFUSE       ALLOW(done)   <-- gate false-pass
`- [x] a\u2029- [ ] b\n`                  REFUSE       ALLOW(done)
`- [x] a\r- [ ] b\n`                     REFUSE       ALLOW(done)
`- [ ] a\r- [x] b\n`                     REFUSE       REFUSE       (row set still differs)
LF / CRLF variants                      REFUSE       REFUSE       (unchanged)
~~~

Root cause, unchanged: `acceptanceRows` (`lib/src/items.ts:411`) iterates `body.split(\"n")`, while the pre-fix regex `/^[ \t]*[-*] \[( |x|X)\][\t]*[^\s]/gm` carries `m`, so JS `^` matched after **every** LineTerminator `\n`, `\r`, `\u2028`, `\u2029`. The fix is one line in `acceptanceRows` — split on the LineTerminator set rather than on `\n` alone — plus two `CORPUS` shapes and a U+2028 separator in the fuzz `markers` (`cli/src/acceptance-parity.test.ts:322`); the pre-fix oracle going green is the proof it was the right fix.

Everything else stands. **No-merge until F1 (the gate refusal set changes on CR / U+2028 / U+2029) and F2 (`ArggonManager/docs/json-output.md:585,597` and `README.md:418` still say the acceptance rows are parsed from the clipped prose, while the payload now carries `acceptance_truncated`, `acceptance_complete` and a `criterion` field under a 64-row cap) land.** F3-F6 ride along; F7/F8 are notes.

Sequencing, unchanged: merge #611, then update #605 on top of it, then merge #605 — #611 correctly does not touch `cli/src/goal-mode.ts` or the ZCode assets, since none of them are on `main`.

The probes needed are listed in my previous comment and are unchanged. The decisive one is `npm test -- acceptance-parity` after adding a `\u2028` CORPUS shape: expected to fail before the fix (the `gateComplete === preFixGate` assertion) and to pass after it.

### 2026-10-03 @arggon-reviewer
verdict: approve (F1 and F2 are genuinely closed; the VT/FF exclusion is correct and test-pinned, the oracle is non-vacuous by measurement, and the bundle catch was real. One one-line doc note should ride along (the convention.md EOL sentence); the model-driven smoke stays a named probe, not a blocker.)

Round 2, HEAD 0ecbf756, 6 new commits on top of round 1. Read-only again: I executed no project gate. Everything below is a file reference, a JS-semantics probe (node on a transcribed regex), or a read-only walk of this tracker.

## F1 § closed, and the fix is exactly right

`ACCEPTANCE_LINE_BREAK = /[\n\r\u2028\u2029]/` (`lib/src/items.ts:356`), consumed as `body.split(ACCEPTANCE_LINE_BREAK)` (:436). Independent probe: pre-fix regex transcribed from `main`, new scanner transcribed from the branch, 21 bodies.

```
case                                     pre-fix  round1  round2
LF ticked>unticked                       REFUSE   REFUSE  REFUSE
CRLF ticked>unticked                     REFUSE   REFUSE  REFUSE
CR alone ticked>unticked                 REFUSE   ALLOW   REFUSE   <- round 1 dropped it
U+2028 ticked>unticked                   REFUSE   ALLOW   REFUSE   <- round 1 dropped it
U+2029 ticked>unticked                   REFUSE   ALLOW   REFUSE   <- round 1 dropped it
U+2028 prose>unticked                    REFUSE   ALLOW   REFUSE
U+2029 prose>unticked                    REFUSE   ALLOW   REFUSE
mixed CR, LF, U+2028                     REFUSE   ALLOW   REFUSE
leading lone CR                          REFUSE   ALLOW   REFUSE
ticked>ticked (CR / U+2028 / U+2029)     ALLOW    ALLOW   ALLOW
trailing lone CR                         REFUSE   REFUSE  REFUSE
double CR (blank segment)                REFUSE   REFUSE  REFUSE

round1 wrong 7/21        round2 wrong 0/21
```

**The VT/FF exclusion is load-bearing, correct, and I confirmed the failure it avoids.** A second probe adds VT and FF to the set:

```
body                                  pre-fix  shipped  withVTFF  effect
"-x-x-a<VT>- - -b \n "                 ALLOW    ALLOW    REFUSE     ADDS a refusal
"-x-x-a<FF>- - -b \n "                 ALLOW    ALLOW    REFUSE     ADDS a refusal
"prose<VT>- - -b \n "                   ALLOW    ALLOW    REFUSE     ADDS a refusal
```

That is the other direction of the same class of regression § a false REFUSAL wedging a legitimate `done` flip § and it was avoided deliberately and for the right reason (VT/FF are whitespace, not LineTerminators, so `^` under `m` never anchored after them). The kernel comment (`lib/src/items.ts:342-356`) states the exclusion, the reason and the NBSP case, and no longer describes the pre-fix regex (F5 closed: that stale m/dollar rationale was where F1 hid, and it is gone).

**The exclusion is pinned by tests, not by a comment.** `cli/src/acceptance-parity.test.ts:378-382` asserts `preFixGate` true, `acceptanceComplete` true and `acceptanceUnchecked` length 0 for the VT and FF bodies. Adding VT to the constant turns 12 of 186 cases in my transcription of the corpus against the pre-fix oracle (6.5 percent), so a test fails, not a comment.

## The oracle is non-vacuous § by my own count, not on trust

I transcribed the corpus generator (:196-223) and ran it against both candidate scanners:

- **shipped LineTerminator split: 0 disagreements** with the pre-fix gate over the whole generated corpus.
- **reverted `split("\n")`: 31 disagreements, 16.7 percent of cases.** The oracle has real discriminating power; your 49-of-271 red on revert is the same order of magnitude as my independent count (I ran a subset of the suite, not the suite).

Your three sub-questions, confirmed by reading :164-223 and :457-545:

- **Five terminators plus as-written, per shape:** `corpusBodies()` emits `[as written]` plus one case per `TERMINATORS` entry, using `replace(/(?:\r\n|\r|\n|\u2028|\u2029)/g, eol)` (:218). The self-check at :292-317 asserts the arithmetic AND that CR-only, U+2028 and U+2029 bodies really are present (:305-309). My transcription reproduced the same count identity.
- **8 shapes that exist only under a non-LF terminator:** yes § `TERMINATOR_SHAPES` (:164-181) has exactly 8 entries, including the VT and FF counter-shapes that must NOT become rows. The comment at :156-163 explains why uniform re-termination cannot manufacture them, which is the right reason.
- **The fuzz joins a ticked row to an unticked one with the terminator:** yes § :476 builds `## Acceptance${eol}${eol}${line}${eol}- [ ] todo${eol}- [x] done${eol}` plus the bare two-row `${line}${eol}- [ ] todo` at :485, with `eols` now `[\n, \r\n, \r, \u2028, \u2029]` (:466). That is the F1 shape, generated.

## The evidence numbers now reproduce bit-exactly

I re-implemented the committed 200k harness from the file (mulberry32, seed `0x5eed1234`, the same fragment pools) and got **5249 refused, 2.62 percent**, with 0 disagreements for the shipped split § your figure to the digit. Product: 9 x 3 x 5 x 7 x 5 = **4725** iterations x 2 bodies (:492 asserts the identity). Corpus: 43 shapes x 5 plus as-written = **258** cases (:295). The suite prints its own sizes (:312-316, :541-544) so these are re-runnable rather than remembered (F4 closed).

**On your first fuzz having the same flaw I flagged in F3** § you are right about the mechanism and right about the fix. A pure-alphabet fuzz over the bracket, space and dash characters essentially never assembles a criterion, so `toBeGreaterThan(1000)` on a count that is always 0 asserts nothing. The committed version builds each body from line fragments, 75 percent of them well-formed rows (:522-523), and asserts `refusals > 2000` AND `refusals / bodies > 0.01` (:539-540) § an absolute floor plus a rate, so a generator that stops producing refusals fails loudly. My run: 5249 > 2000 and 2.62 > 1. Verified: the replacement fixes it.

## F2 § closed, and the schemaVersion call is right

- `ArggonManager/docs/json-output.md:585` now reads 8 KiB prose, 4 KiB per comment, kernel 3-comment tail, 64 acceptance rows; :597 lists `acceptance[] ({text, checked, criterion}) rows parsed from the item's canonical body`, `acceptance_truncated` and `acceptance_complete`, plus a new paragraph and a per-field table.
- `README.md:418` states the canonical-body input, the 64-row cap, `acceptance_complete`, and why: a bounded, comment-stripping `prose` reported nothing unchecked on a comment-filed checklist and on a criterion past the 8 KiB cap.
- **The no-bump decision checks out against the document's own rule AND against precedent.** The rule is at :35 (additive fields are OK within a `schemaVersion`). The precedent is exact: `json-output.md:500` documents `candidates[].via` as additive within `schemaVersion: 1`§§ an array element gaining a field, the same shape of change as `acceptance[].criterion`. Nothing removed, retyped or made optional; `text` and `checked` keep their meaning. I agree: no bump, and recording the reasoning in the doc, including the strict-validator note, is the right way to spend the decision.

**F3-F8 all closed.** The non-vacuity floor is now `toBeGreaterThanOrEqual(1)` plus a per-item assertion that each such item really has an unchecked criterion the gate sees and `showBoundedParts` cannot (:786-798) § a floor plus a shape check, not a tautology. The `spec.ts` narrowing is tested by a discriminating case: a two-space box still reads `untestable-acceptance`, and the canonical, glued, bare, star, indented and CRLF forms stay testable (`cli/src/spec-analyze.test.ts:119-160`). The ast-grep rule's note and README now say plainly that it catches a fifth grammar and NOT a fifth wrong input, that it would not have caught either bug this item closed, and that it is deliberately broader than the spellings the removed parsers used (`\u2028[xX]?\u2029` and alternations do fire) § that is my F8, measured and conceded.

## The bundle catch was real, and the regeneration moved nothing else

`git diff --numstat 471bb76a..HEAD -- opencode/plugins/arggon/index.bundle.ts` = **2 insertions, 1 deletion**, and the full diff is the F1 fix alone (the new constant and the changed split call). Your point is worth stating plainly: the vendored kernel is what an adopter actually loads, so without `check:plugin` catching it the F1 gate false-pass would have shipped to every plugin-bundle consumer with `lib/src` looking clean. The gate earned its keep, and nothing else in the artifact moved.

## Live corpus, independently re-measured (486 items by my filter)

```
CRLF bodies in this tree      : 0
PRE-FIX disagreements         : board=35  nativePanel=38  cliPane=0
comment-stripped (605 shape)  : 33
POST-FIX disagreements        : 0
gate refusal-set changes      : 0        <- new scanner vs pre-fix regex, per item
```

The line that matters is **refusal-set changes: 0** § not only on generated bodies but on every real item body in this tracker, with the LineTerminator-aware scanner. My absolute counts run above yours (35/38/33 vs 27/30/25) because my item filter differs; **AFTER = 0** reproduces exactly, and both counts are far above the F3 floor of 1.

## smoke:opencode § admissible as a differential, not as runtime evidence

Judged, and the nuance matters. `ArggonManager/docs/agents.md:295` is explicit that `smoke:opencode` is model-driven and timing sensitive, run each one alone, never beside a test suite or another headless harness; `CONTRIBUTING.md:122-123` says the same. So **a parallel full-suite run is not admissible as evidence that the native panel works**, and I am not treating it as such.

What your evidence does establish is the narrower and, for this purpose, sufficient claim: two runs of the same inadmissible harness on two different trees produce an **identical sorted FAIL set**, every failure in the same category (a model-executed assertion, `context7` connections closing). That isolates the change variable § if this harness flakes in this environment it flakes the same way on both trees § which is the correct way to show a pre-existing red is pre-existing. Combined with the changed native surface (`opencode/plugins/arggon/board.ts`, the panel's acceptance count) being exercised end-to-end through the real reader in the suite (`acceptance-parity.test.ts:609-710`: `boardItemDetail(root, id)` off disk, asserting the CRLF item yields 1/3 with its three rows and the comment-only item 1/2 with all three rows); `smoke:tui-board` green; `playwright --grep @smoke` 33/33 green for the board-HTML change § I am satisfied this PR does not regress the native panel. **Not blocking.**

One process note per `AGENTS.md` (findings become items): `smoke:opencode` red on clean `origin/main` is a real, separate, actionable defect in this repo's model-driven evidence path and should be **filed as an item**, not left in a review comment. Not this PR to fix.

## Sequencing § clean

I checked every path #611 touches against `git cat-file -e main:<path>`. The only three that do not exist on `main` are the new `cli/src/acceptance-parity.test.ts` and the two new `tools/ast-grep/` files, all genuinely created here. **Nothing touches `cli/src/goal-mode.ts`, the ZCode templates, or `agents.md`** § the round-1 ruling was respected. Your `docs/json-output.md` union-resolve warning is right: it is the one file both PRs will want.

## One non-blocking note, recommended in this PR

`ArggonManager/docs/convention.md:139` still reads that both LF and CRLF bodies parse identically, because the frontmatter parser tolerates `\r\n`, so the acceptance grammar must too. That statement is **true**, but it is the exact framing that hid F1: naming only LF and CRLF is what makes `split("\n")` look correct. `convention.md` is the schema authority a future author or agent reads before writing a parser, so it is the one place worth spending a line: extend it to the full LineTerminator set (`\n`, `\r`, U+2028, U+2029, and explicitly NOT VT/FF). One sentence, no code. Not blocking, but it closes the loop on the root cause rather than just the instance, and convention.md was untouched in this round.

I also no longer count `docs/opencode2.md:290` and `playbooks/opencode.md:263,473` as stale (my F2, round 1): those describe **what the block renders**, and the rendered rows are unchanged § only the footer's denominator moved from rows to criteria. A precision gap in prose, not a wrong claim; I withdraw it as a finding.

## Probes needed

```
cd /home/arggon/Projects/ArggonManager-bug-three-acceptance-parsers-diverging

# 1. The decisive non-vacuity probe, standalone (the one number I cannot produce by reading).
npx vitest run cli/src/acceptance-parity.test.ts --reporter=verbose
# expected: 258 corpus cases; printed 43 shapes / 5249 refused 2.6% / live line; all green
# then: revert ONLY lib/src/items.ts:436 to body.split("\n") and re-run, ALONE
# expected: many red, including the named test "the gate refuses on a body terminated by ANY
#   LineTerminator (review F1)" failing on its own. My independent count says `17% of corpus cases.

# 2. Admissibility re-run of the model-driven smoke (agents.md:295: run it ALONE, never beside a suite).
npm run smoke:opencode
# expected on a healthy machine: exit 0. On this box: the same 47 category-failures, which the
#   main-vs-branch differential already covers. Run it alone before recording it either way.

# 3. Confirm the regenerated bundle is byte-equal to a fresh regeneration from this tree.
npm run build:plugin && git diff --exit-code -- opencode/plugins/arggon/index.bundle.ts
# expected: empty diff (I read a 2-line diff vs round 1, the F1 fix only).

# 4. Optional, my one ask: extend the EOL sentence in convention.md to the full LineTerminator
#   set, naming VT/FF as NOT line terminators.
```

**Merge.** F1 and F2 are closed and verified independently; the oracle has measured discriminating power; the evidence numbers are re-runnable and reproduce to the digit; the bundle is in sync and moved nothing else; scope and sequencing are clean. After this merges, #605 can be updated on top (drop the TWO-parsers framing, the CRLF-blind claim, the `normalizeEol` not-cosmetic rationale, and the now-unreachable `UNRENDERABLE` branch), with a union resolve on `docs/json-output.md`.
