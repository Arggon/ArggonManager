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
