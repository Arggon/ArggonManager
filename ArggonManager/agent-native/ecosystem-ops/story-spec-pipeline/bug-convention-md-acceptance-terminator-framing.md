---
type: bug
status: done
id: bug-convention-md-acceptance-terminator-framing
title: "`docs/convention.md:139` frames acceptance-box parsing as \"LF and CRLF\" — the exact framing that hid the U+2028/U+2029 done-gate false-pass in PR #611"
assignee: Arggon
parent: story-spec-pipeline
labels: [docs, done-gate]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-convention-md-acceptance-terminator-framing.md
  Leaves live only under a story. id is the filename stem: bug-convention-md-acceptance-terminator-framing.
  CLI `arggon create bug convention-md-acceptance-terminator-framing` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/convention.md:139` frames acceptance-box parsing as "LF and CRLF" — the exact framing that hid the U+2028/U+2029 done-gate false-pass in PR #611

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Found by the reviewer of PR #611 (bug-three-acceptance-parsers-diverging), 2026-10-03, as its one non-blocking ask — filed rather than fixed there, because the PR's scope is the kernel and this is the doc an author reads BEFORE writing a parser.

**The framing is what hid the bug.** `docs/convention.md:139` describes acceptance-box parsing as handling "LF and CRLF". True — and it is precisely the sentence that made every implementation (five consumers, six grammars) believe it had the terminator set covered. The done gate's regex anchors after every JS LineTerminator (`\n`, `\r`, `u2028`, `u2029`); a refactor to a `\n`-only split therefore looked behavior-preserving and silently turned refusals into `done` flips.

The reviewer verified the cost of the _wrong_ fix as well: including `\v`/`\f` in the boundary flips 6.5% of cases from ALLOW to REFUSE — a false refusal wedging a legitimate done flip. So the doc must name both what IS a terminator and what is deliberately NOT, because the symmetric mistake is just as damaging as the original.

Acceptance:


- [x] `convention.md` names the full LineTerminator set the gate anchors on, and states explicitly that VT (`\v`) and FF (`\f`) are NOT line terminators for this purpose
- [x] The doc states which body every consumer must be handed (the canonical body) — the #605 trap — so an author cannot pre-filter before calling the predicate
- [x] Cross-reference the single kernel predicate by name, so the doc points at one implementation rather than describing a grammar to reimplement
- [x] Keep it to what an author needs BEFORE writing a parser; the implementation detail belongs in the predicate's own doc comment

### 2026-10-03 @Arggon
PR #613 — docs-only, one file (`ArggonManager/docs/convention.md`, §Acceptance rows), all four boxes ticked.

**Replaced** the lone sentence "Both LF and CRLF bodies parse identically — the frontmatter parser tolerates `\r\n`, so the acceptance grammar must too" with three things, in the order an author needs them.

1. **Terminator table (`convention.md:141-147`)** — read against the shipped kernel, not paraphrased: `ACCEPTANCE_LINE_BREAK = /[\n\r\u2028\u2029]/` consumed by `body.split(...)` in `acceptanceRows` (`lib/src/items.ts:359,436`), with `ACCEPTANCE_LINE_BREAK`'s own doc comment as the source for the exclusion rationale. `\n` (LF), `\r` (CR), U+2028 LINE SEPARATOR, U+2029 PARAGRAPH SEPARATOR end a row line; `\v` (VT) and `\f` (FF) are whitespace but **NOT** LineTerminators (`^` under `m` never anchored after them, so `- [x] a\v- [ ] b` is ONE row); `\u00a0` is not a break at all — it stays in the tail, where `ACCEPTANCE_TEXT` (`/^\S/`) rejects it as leading whitespace. The old CRLF claim is kept inside the `\r` row, now as a corollary rather than the whole boundary set. The failure mode is named: splitting on `"\n"` glues the rest of a CR/U+2028/U+2029 body onto the previous line, an unchecked criterion goes invisible and the blocked `done` flip goes through (F1).
2. **One implementation, by name (`:149`)** — `acceptanceRows`, with `acceptanceCriteria` → `acceptanceUnchecked` → `acceptanceComplete` layered over it and `acceptanceBody` fixing its input. Also names the guard rails: ast-grep `acceptance-rows-use-kernel` (`tools/ast-grep/rules/`, `npm run test:structure`) catches a fifth GRAMMAR; `cli/src/acceptance-parity.test.ts` is what catches a fifth wrong INPUT — the split the ast-grep README explicitly says it cannot. De-duplicated the symbol list at `:124` to `acceptanceRows` alone so one place owns it.
3. **Input invariant (`:151`)** — the **canonical** body, comment sections included, exactly as `acceptanceBody(item)` hands it over, and never trim / EOL-normalize / clip / filter first ("a reader that pre-processes the body has changed the question, and on reachable shapes it changes the answer"). The comment-filed-checklist case stays as the concrete instance, since `create` has no `--body` flag, so it is the default path for every new item. I cited the item, not the coordinator's 21/280 or the reviewer's 6.5%: live-tree counts decay, and both numbers live in `bug-three-acceptance-parsers-diverging`.
4. **Which form is a row** — the settled answers are reachable from the new prose: `- [ ] x` and `- [ ]x` ARE rows (the space changes nothing; `x` is a one-character criterion), `-  [ ] x` is NOT. Verified against `ACCEPTANCE_MARKER` (`/^[ \t]*[-*] \[( |x|X)\][ \t]*/`) + `ACCEPTANCE_TEXT` — the table above them was already correct, so no table row changed.

**Sweep for the same framing elsewhere** — `docs/agents.md`, `.agents/skills/arggon-cli/references/*` (incl. `pitfalls.md`'s done-gate note), `README.md`, `docs/json-output.md:599`, `docs/opencode2.md`, `tools/ast-grep/README.md`, the adopter template `templates/docs/docs/convention.md` (89 lines, carries no acceptance grammar at all): none describes acceptance-box parsing as LF/CRLF, and the ones that describe the input already say "canonical body". No second site to fix.

**Gates**

- `npm run arggon -- validate` → `arggon validate: ok (0 warning(s), convention v5)` (also ran in the pre-commit hook)
- `npm run lint` → clean, no output
- prettier: `--write` ×3, `diff pass-2 pass-3` empty (CONVERGED) — a single `--check` cannot prove convergence for the indented table continuations; `--check` green afterwards
- `npm test` deliberately NOT run: no test added or touched, and no test reads this doc's content. The `convention.md` assertions in `init-docs`/`init`/`adopt`/`layout`/`capability-matrix` all read GENERATED adopter templates in temp dirs, not this repo's doc (verified by grep).
- smoke exempt (docs-only). Based on `origin/main` (`d160623f`) — already current, so no rebase; no force-push.

One judgment call for the reviewer: I kept the 6.5% and 21/280 numbers OUT of the doc and kept item ids IN, on the grounds that a schema doc should carry the durable rule and the decaying measurements belong to the item. Say the word if you want either number surfaced.

### handoff 2026-10-03 @Arggon — next: Review and merge PR #613 (docs-only, convention.md §Acceptance rows); item is ready to close once merged
- branch: fix/bug-convention-md-acceptance-terminator-framing
- open questions: Should the 6.5% VT/FF ALLOW->REFUSE measurement surface in convention.md, or stay in bug-three-acceptance-parsers-diverging? Worker kept it out as decaying; is the ':124' symbol-list de-duplication i…

### 2026-10-03 @Arggon
**Methodology impact class: ADVISORY** — the required surface `docs/agents.md` §Changing the methodology itself (:473-478) demands from a PR touching a carrier (`ArggonManager/docs/convention.md` is one of the four). Also stated in the PR description, so both required surfaces carry it.

**Why Advisory, not Behavioral.** Behavioral means "agents must re-learn something — a rule, a gate, a command contract, a pipeline step". Nothing here qualifies:

- No rule, gate, command contract or pipeline step changed. The diff is one documentation file plus this item file; no TS, no JSON contract, no fixture.
- The behavior this PR documents **already shipped and was already correct**: `ACCEPTANCE_LINE_BREAK = /[\n\r\u2028\u2029]/` (`lib/src/items.ts:359`), consumed by `body.split(...)` in `acceptanceRows` (:436), landed in #611 and is pinned by `cli/src/acceptance-parity.test.ts`. The terminator set, and the deliberate exclusion of VT/FF, are not new facts to an adopter — they are facts an adopter's agent could only previously find by reading TypeScript.
- Therefore no ADR 0016 reference is owed, and consequently the Behavioral-class obligation to keep `skills/arggon-cli/` ↔ `.agents/skills/arggon-cli/` byte-equal in the same PR is **not** owed here. Nothing was re-synced because nothing in the skill needed to change: the sweep found no skill statement this edit makes false (`references/pitfalls.md`'s done-gate prose is about waivers and the cascade, and never states a terminator set).
- What an adopter's agent gets is strictly better prose for a rule that already applies: "name the four LineTerminators, and VT/FF are not among them" replaces a sentence whose incompleteness is what let a `\n`-only split look behavior-preserving.

Reading it the other way — if the coordinator considers a schema-doc correction that prevents a future behavioral divergence to be Behavioral — then the skill re-sync is still not required (no skill file carries the acceptance grammar), but the ADR 0016 reference and the byte-equal copy would be. I read it as Advisory and am flagging the alternative rather than silently picking it.

### 2026-10-03 @Arggon
Round 2 on #613: **F1 and F2 addressed, F4 and F5 fixed, F3 reported not fixed.** Impact class: see the comment above (Advisory) and the PR body.

## F2 — the gates claim was false; withdrawn and replaced with evidence

What I wrote last round: "`npm test` not run: no test added or touched, and **no test reads this doc's content (verified by grep)**". The reviewer is right and the claim is **withdrawn**. `cli/src/prose-format.test.ts` refutes it: `proseDocs()` (:70-79) keeps every tracked markdown under `ArggonManager/docs/` — `ArggonManager/docs/convention.md` included — and two of its three tests read this file's bytes and run `prettier.format` over them (rule 1, glued tokens, :161-181; rule 2, code-span source text, :183-209). The third (rule 3, `REPAIRED_FILES`) does **not** include this file. My grep enumerated which tests mention the *path* and I never checked which read *content* — that is exactly how a false claim survived a "verified by grep" label. The conclusion (`npm test` not required for a docs-only diff) survives, but on different grounds:

**Why the change is safe, correctly stated.** `prettier.format(source) == source` for the committed bytes: `prettier --write` is what wrote them, and re-running is a no-op — pass-2 ≡ pass-3 byte-identical, and `git status` is clean after three further `--write` passes, which is the proof that the committed bytes are a fixed point. At a fixed point rule 2 compares the code-span slices of the file against themselves, so the new spans (`\n`, `\r`, `\v`, `\f`, `\s`, `\p{Zs}`, `- [x] a\v- [ ] b`, `- [ ]\u00a0x`, the U+2000–U+200A range) cannot be reported as rewritten, and rule 1's glue diff is empty by construction. **And I ran it, so the argument is evidence, not just argument:** `npx vitest run cli/src/prose-format.test.ts` → **3 passed**.

One honesty note about that argument, so nobody later hardens it into the wrong rule: the test's own header (:31-33) says rule 2 is deliberately **not** `prettier --check`, because "these docs are not byte-clean (prettier re-pads tables) and need not become so; the invariant is that formatting cannot change what a code span says". So the fixed point is a *sufficient* condition for these two rules on this file, not the rule's contract. The ongoing protection is that a future non-fixed-point edit which mangles a code span gets caught by rule 2 — the corpus is watched by path, forever.

## Full gate record (all on the pushed tree — proven identical, see below)

| Gate | Result |
| --- | --- |
| `npm run build` | ok (tsc ×3, plugin bundle rebuilt) |
| `npm test` | **124 files, 2555 tests passed** |
| `npx vitest run cli/src/prose-format.test.ts` | **3 passed** (F2's counterexample, run on the new table) |
| `npm run lint` | clean, no output |
| `npm run arggon -- validate` | `arggon validate: ok (0 warning(s), convention v5)` |
| `npm run check:plugin` | bundle rebuilt byte-identical (tree clean after) |
| `npm run test:structure` | `4 passed; 0 failed` — this is what actually runs `acceptance-rows-use-kernel`, the guard the new text delegates to |
| `npm run lint:structure` | clean, no findings |
| prettier convergence | `--write` ×3, pass-2 ≡ pass-3, tree clean after → committed bytes are a fixed point |

No test was added or modified, but `npm test` is run anyway now that the refuting test is known.

## F4 — fixed: the bolded rule no longer conflates row with criterion

`:124` said "a checkbox line **is an acceptance row when — and only when** — it matches the marker followed by at least one non-whitespace character". The kernel keeps two facts apart: `acceptanceRows` returns **every** marker match, and the non-whitespace tail is the separate `AcceptanceRow.criterion` flag — so the bare `- [ ]` is a row with `criterion: false` that renderers still show (the doc's own table row: Row? yes / Gates? **no**). An author implementing the old sentence dropped the placeholder row. Now:

> **A checkbox line is an acceptance ROW when — and only when — it starts with the marker `^[ \t]*[-*] \[( |x|X)\]`; it GATES the `done` flip when — and only when — at least one non-whitespace character follows the box.** Two facts, deliberately not one … so the bare box `- [ ]` is still a row that renderers show, while only a text-bearing row is a criterion.

The reviewer called this pre-existing since #611; I fixed it in place because this PR already edits that sentence and the fix is one clause. No table row changed — it was already right.

## F5 — fixed: the ambiguous phrase is named

"`\u00a0` and the other Unicode spaces" read as "the `\s` class", which contradicted the VT/FF cell's "do not widen the set by analogy with `\s`" two rows above (U+2028/U+2029 are inside `\s` **and** are separators). Replaced with the exact class — **the `\p{Zs}` spaces (U+0020, U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F, U+3000) and U+FEFF** — plus the mechanism (`- [ ]\u00a0x` is a row whose text trims to `x` and still does not gate, because only space and tab are consumed after the box). I verified the enumeration instead of trusting my memory: iterating `/\s/` and `/\p{Zs}/u` over the BMP gives `\s` = {0009 000A 000B 000C 000D 0020 00A0 1680 2000–200A 2028 2029 202F 205F 3000 FEFF}, `\p{Zs}` = {0020 00A0 1680 2000–200A 202F 205F 3000}, so the row's list is exactly `\s` minus the four LineTerminators, minus VT/FF, minus tab. The VT/FF cell now also says "the LineTerminators inside JS's `\s` are exactly the four rows above", which removes the contradiction at the source.

## F3 — reported, NOT fixed (per the coordinator's call), so it is not mistaken for coverage that exists

Recorded here because the doc sentence propagates a claim the suite cannot back: "a consumer that already calls the right parser still needs `cli/src/acceptance-parity.test.ts`, which asserts each consumer reads `acceptanceBody(item)`". The reviewer's own probe is the correction — for `parseAcceptanceRows` and `tuiAcceptanceRows` the **test** hands them `acceptanceBody(item)` itself (`acceptance-parity.test.ts:615-622`, `:736-740`), so it cannot catch a shipped call site that passes clipped prose; only the native consumer is asserted through its own wiring (`boardItemDetail` → `opencode/plugins/arggon/board.ts:436`, `task-comment-only` fixture, :681-706); and `cli/src/board.ts` `detailPayloadOf` (serve + static route, :810/:819) is guarded by `board-serve.test.ts:630-680`, whose fixture keeps the checklist in the **body**, so reverting that call to `bounded.prose` would still pass. Net: the parity suite pins gate/consumer **agreement**; wiring a consumer to the canonical body is a **per-call-site duty**, and no suite currently holds that line for two of the three consumers. The wording is inherited from `tools/ast-grep/README.md:213-224`, so this PR propagates rather than invents it, and the doc's normative input invariant stands on its own. Suggested replacement if the coordinator wants it: "the parity suite pins gate/consumer agreement; wiring a consumer to the canonical body is a per-call-site duty". Left as-is pending that call — this is a follow-up-shaped gap, not a blocker for a docs PR.

## Process note: rebasing an already-published branch

I rebased onto `origin/main` as instructed, then found the branch was **already published** (tip `78d22366`), so the rebased history is not pushable without a force — and force-push is denied by the repo's own rules. Rather than force, I reset to the published tip and **merged** `origin/main` (`05ef1aa2`), then re-applied the F4/F5 commit on top (`8567d450`). Verification that this is equivalent and not a different change:

- `origin/main` moved 12 commits (#609 merged as #614); its diff since my base touches **neither** of my two files (`git diff --name-only d160623f origin/main` → 6 files, no overlap), so the union resolves with no conflict and nothing needed manual union-merging.
- `ArggonManager/docs/convention.md` blob: `01c850c…` before and after — byte-identical.
- Full tree: `25bd149…` before and after — **identical**, so every gate above ran on exactly the tree that is now pushed.
- Diff vs `origin/main` is unchanged: 2 files, +52/−9. Pushed fast-forward `78d22366..8567d450`; no force.

open questions for the coordinator: (1) F3 wording — apply the suggested replacement, or file it as a follow-up under `story-spec-pipeline` (the gap it describes is a real coverage hole in `cli/src/board.ts`'s detail payload and belongs to a test item, not to this doc PR)? (2) The F3 finding is arguably a new bug (a shipped call site could regress to clipped prose with every suite green) — should that be `arggon create bug` rather than a comment here?

### handoff 2026-10-03 @Arggon — next: Re-review #613 round 2: impact class Advisory stated on both required surfaces, F2 gates claim corrected with prose-format 3/3 + full suite 2555 green, F4/F5 fixed; then merge
- branch: fix/bug-convention-md-acceptance-terminator-framing
- open questions: F3: apply the 'per-call-site duty' wording, or file the cli/src/board.ts detailPayload clipped-prose coverage hole as a bug under story-spec-pipeline? Branch merges origin/main (rebase of a published…

### 2026-10-03 @Arggon
Round 3 on #613: **F4′ fixed — one clause, one pattern character.** Nothing else touched.

## The clause, and the falsification it removes

Shipped `convention.md:124` (whole line, bold part):

> **A checkbox line is an acceptance ROW when — and only when — it starts with the marker `^[ \t]*[-*] \[( |x|X)\][ \t]*`; it GATES the `done` flip when — and only when — the first character after the box, after any spaces or tabs, is non-whitespace.**

Two changes, exactly the ones the verdict prescribed:

1. the quoted marker now carries the trailing **`[ \t]*`** it had dropped — the doc's quote is now byte-equal to `ACCEPTANCE_MARKER = /^[ \t]*[-*] \[( |x|X)\][ \t]*/` (`lib/src/items.ts:333`);
2. "at least one non-whitespace character **follows the box**" → "**the first character after the box, after any spaces or tabs, is** non-whitespace".

No caveats added, no second restatement, no hedge. Per the verdict's warning I did **not** harden it back: the clause names the position the kernel tests, and stops.

## The pattern that backs it

`ACCEPTANCE_TEXT = /^\S/` (`items.ts:336`) is tested on `line.slice(m[0].length)` (`items.ts:439-443`) — i.e. on the tail **after the marker has consumed its `[ \t]*`**. So the kernel's criterion is "first character of the post-marker tail is non-whitespace", which is what the new sentence says; the old sentence tested a different thing ("does any non-whitespace character exist anywhere after the box"), which is strictly weaker and false as an equivalence.

Re-ran the reviewer's nine shapes with the two shipped patterns transcribed from `items.ts` (`/tmp` probe, no repo change):

| line | kernel + new doc sentence | round-2 sentence |
| --- | --- | --- |
| `- [ ] x` | gates | gates |
| `- [ ]x` | gates | gates |
| `-  [ ] x` | not a row | not a row |
| `- [ ]` | does not gate | does not gate |
| `- [ ]  x` | gates | gates |
| `- [ ] x` (NBSP) | does not gate | gates — **drift** |
| `- [ ]\vx` | does not gate | gates — **drift** |
| `- [ ]　x` (U+3000) | does not gate | gates — **drift** |
| `- [ ]﻿x` (U+FEFF) | does not gate | gates — **drift** |

**Drift vs the kernel: 4 shapes before, 0 after.** The four are exactly the ones the verdict named, and they are the shapes the `\p{Zs}` row this PR added already described ("Only space and tab are consumed after the box, so `- [ ] x` is a row whose text trims to `x` and still does not gate the flip") — so the bolded rule, that row, `items.ts:368-372` and `acceptance-parity.test.ts:439-441` now say the same thing. I confirmed the paragraph I did **not** edit was not a second copy of the falsified rule: `:150` states only row-forms (`- [ ] x`, `- [ ]x`, `-  [ ] x`), and `:120`/`:282` say "carries text", which is the display-`text` notion, not a criterion biconditional.

## Gates (this round's required set)

| Gate | Result |
| --- | --- |
| prettier convergence | `--write` ×3, **pass-2 ≡ pass-3**; re-proved **after** the code-span edit, tree clean → committed bytes are a fixed point |
| `npm run arggon -- validate` | `arggon validate: ok (0 warning(s), convention v5)` |
| `npm run lint` | clean, no output |
| `npm run test:structure` | `4 passed; 0 failed` |
| `npx vitest run cli/src/prose-format.test.ts` | **3 passed** (the lane that guards the code span I edited) |

The full `npm test` (2555) is not re-run: this round changes one line of one doc file, and the previous round's full-suite result stands for the same tree plus that sentence — `prose-format`, the only suite that reads this file, is re-run above and is green. Say so if you want the full suite re-run anyway.

## Merge: nothing to merge this round

`git fetch origin` → `origin/main` is still `b9646fca`, and `git rev-list --count HEAD..origin/main` = **0**, so this branch already contains all of main; no merge and therefore no conflict. The verdict commit `b89a3398` and the F3 follow-up item exist in this repo only on the primary checkout's local `main` (it is not on `origin/main` yet), so I did **not** merge them in — that is the coordinator's local work to publish, and pulling unpublished commits from another worktree's branch is not mine to do.

Diff vs `origin/main` after the push: still **the same two files** — `convention.md` (**+14/−3**, unchanged numstat from round 2; the fix rewrote the clause in place) and the item file (+108/−6). Two-dot and three-dot diffs return the **identical file set**, so the merge base equals main's tip and nothing main-side is dropped. Pushed fast-forward `f6d00aa8..b6f670a9`; no force.

For the coordinator's merge: the anticipated conflict on the item file (verdict comment vs my round-2/round-3 comments) is still ahead — resolve as a **union** and keep every comment block.

open questions: none blocking. Ready for re-review.

### handoff 2026-10-03 @Arggon — next: Re-review #613 round 3: F4' criterion clause fixed ([ \t]* in the quoted marker + 'after any spaces or tabs'); approve on sight per verdict
- branch: fix/bug-convention-md-acceptance-terminator-framing
- open questions: Merge-time union resolve on the item file still ahead (verdict b89a3398 is on the primary's local main, not origin/main); full npm test not re-run this round - prose-format 3/3 re-run instead

### 2026-10-03 @arggon-reviewer
verdict: request-changes (narrow: two required-surface omissions, neither in the doc text)

The doc change itself is excellent and every technical claim I could check is correct against the shipped kernel. The block is on process/evidence, not on the prose: **(F1)** the required methodology impact class is absent from both surfaces `docs/agents.md:473` demands, and **(F2)** the "no test reads this doc's content" gates claim is refuted by a counterexample in the tree. Both are two-line fixes. F3–F5 are non-blocking notes.

## What I verified by reading (all correct — no doc/code drift found)

- `ACCEPTANCE_LINE_BREAK = /[\n\r\u2028\u2029]/` — `lib/src/items.ts:359`, exact string. Consumed as `body.split(ACCEPTANCE_LINE_BREAK)` at `items.ts:436` in `acceptanceRows`. The worker's `:359,436` citations are exact.
- `ACCEPTANCE_MARKER = /^[ \t]*[-*] \[( |x|X)\][ \t]*/` (:333) and `ACCEPTANCE_TEXT = /^\S/` (:336) are as the table implies; `items.ts:440-444` keeps `text` (trimmed) and `criterion` as separate facts, which is what the `\u00a0` row describes.
- `- [x] a\v- [ ] b` really is ONE row: `\v` is not in the split set → one line, marker matches `- [x] `, tail `a\v- [ ] b`, `^\S` matches → one ticked criterion, unticked box invisible. Documented example is correct.
- `- [ ] x` / `- [ ]x` are rows; `-  [ ] x` is not — confirmed from the marker regex; the pre-existing table rows needed no change, as claimed.
- "CRLF needs no special case" holds: the split yields an empty segment between `\r` and `\n`, and the marker requires `[-*]`, so the empty line is skipped.
- Every named symbol exists with the stated role: `acceptanceBody(source: AcceptanceBodySource): string` (:415), `acceptanceRows(body: string): AcceptanceRow[]` (:434), `acceptanceCriteria` (:455, = rows ∩ criterion), `acceptanceUnchecked` (:460), `acceptanceComplete(body): boolean` (:484, `=== 0` over unchecked). The layering sentence is precise.
- ast-grep: `acceptance-rows-use-kernel.yml` exists, `severity: error`, and its own `note` already says "WHAT IT CATCHES: a fifth GRAMMAR" / "WHAT IT DOES NOT CATCH: a fifth wrong INPUT" and names the parity suite. `npm run test:structure` runs the rule set + committed fixture scan (`package.json:43`). The doc's delegation is coherent with the rule and `tools/ast-grep/README.md:213-240`.
- Sweep claim holds. `docs/agents.md`: no acceptance grammar, no LF/CRLF. `README.md:221`: CRLF is about provenance/EOL-compare only — unrelated. `docs/json-output.md:599`: already says "canonical body". `tools/ast-grep/README.md`: already says "a \n-only line split" — no LF/CRLF framing. `templates/docs/docs/convention.md`: 89 lines, **zero** acceptance/checkbox/terminator mentions (read in full) — ships no grammar to adopters, so nothing to keep in sync. `skills/arggon-cli/references/*`: done-gate/cascade prose only — no statement made false. Repo-wide grep for acceptance+CRLF/terminator co-occurrence outside the tracker tree returns only the parity suite's own CRLF fixtures and one tracker item body.
- Input invariant is written as an invariant, not advice: "must read the item's **canonical** body … and must not trim, EOL-normalize, clip or filter it before calling", plus the default-path reason (`create` has no `--body`). That matches `acceptanceBody`'s own doc comment (`items.ts:383-413`) rather than restating it loosely. Load-bearing, correctly framed.
- Numbers out / ids in is the right call: live-tree counts decay (the parity suite itself asserts a **floor**, not a count — `acceptance-parity.test.ts:774-800`), and 21/280 is already pinned in that file's header and live-tree comment; item ids are stable currency (never deleted; `bug-three-acceptance-parsers-diverging` / `bug-empty-template-checkbox` already live in this doc), so they are traceability, not rot.
- Scope: 2 files (item + one doc), no fixture/CLI/skill churn. All four acceptance boxes are genuinely met; box 4 holds — the added text is pre-parser material and the implementation detail stays in the predicate's doc comments.
- Formatting is consistent with a prettier fixed point: all 9 new table rows measure exactly 350 bytes, and `ArggonManager/docs/` is **not** in `.prettierignore` (only `opencode/plugins/arggon/`, `.opencode/`, `.agents/skills/`), so `--write` really did format this file. Pass-2 ≡ pass-3 is the right convergence proof given the repo's tracked non-idempotence bugs.

## Findings

**F1 — blocking, required surface: the methodology impact class is not stated.**
`ArggonManager/docs/convention.md` is one of the four methodology carriers. `docs/agents.md:473`: "A PR that touches a methodology carrier … states its **impact class** in the PR description **and** as a comment on the work item", and "Reviewers check the impact statement like any review-bar item; a behavioral change without it is a change request." Mirrored in `engineering.md` §Docs. The PR body and the branch item file contain no impact statement (grepped `impact|advisory|behavioral|ADR 0016` → no hits). House precedent: #598 ("Impact class: **Advisory** — wording-only"), #603, #604, #606, #607 all state it; the sibling item `task-adr-readme-index-missing-adr-0020.md:202` shows the reviewer *checking* carrier scope explicitly rather than assuming. My read: **Advisory** — no rule, gate, command contract or pipeline step changed (the terminator behavior was already shipped and correct in #611; this PR makes the doc say so), which also means no skill re-sync is owed. If you disagree and call it Behavioral, then the `skills/arggon-cli` ↔ `.agents/skills/arggon-cli` byte-equal re-sync applies — say which and do it in the same PR. Fix: one line in the PR description + one item comment.

**F2 — blocking, evidence honesty: "no test reads this doc's content" is false.**
`cli/src/prose-format.test.ts` reads exactly these bytes. `proseDocs()` (:70-80) keeps every tracked markdown under `ArggonManager/docs/` — `ArggonManager/docs/convention.md` is included — and two tests assert on its content by running `prettier.format` over the file and diffing the result: "prettier never glues whitespace-separated tokens together" (:161-181) and "prettier never rewrites a code span's source text" (:183-209). The PR body enumerates `init-docs`/`adopt`/`layout` and misses this one; `acceptance-parity.test.ts` also cites this exact section (`:84`) though only in a comment. Your conclusion ("`npm test` not required") still holds — but only because of the prettier convergence you separately proved, not for the stated reason, and the new table is dense with code spans (`\n`, `\v`, `\f`, `\s`, `- [x] a\v- [ ] b`) — exactly what rule 2 asserts on. Restate the gates line honestly ("the file is a prettier fixed point (pass-2 ≡ pass-3), so prose-format's two rules pass by construction") and, cheaply, run `npx vitest run cli/src/prose-format.test.ts` to turn the argument into evidence.

**F3 — non-blocking: the guard pointer overstates the parity suite.** The doc says a wrong-input consumer "still needs `cli/src/acceptance-parity.test.ts`, which asserts each consumer reads `acceptanceBody(item)`". For `parseAcceptanceRows` and `tuiAcceptanceRows` the **test** hands them `acceptanceBody(item)` itself (:615-622, :736-740), so it cannot catch a shipped call site that passes clipped prose. Only the native consumer is asserted through its own wiring (`boardItemDetail` → `opencode/plugins/arggon/board.ts:436`), via the `task-comment-only` fixture (:681-706). For `cli/src/board.ts`` detailPayloadOf` (the serve/static route, :810, :819) the guard is `cli/src/board-serve.test.ts:630-680`, whose fixture keeps the checklist in the BODY — reverting that call to `bounded.prose` would still pass it. The wording is inherited from `tools/ast-grep/README.md:213-224`, so this PR propagates rather than invents it; the normative rule in the doc stands on its own. Suggest: "the parity suite pins gate/consumer agreement; wiring a consumer to the canonical body is a per-call-site duty".

**F4 — non-blocking, pre-existing in the line this PR edited: row vs criterion.** The bolded rule (:124) says a line "is an acceptance row when — and only when" it matches the marker "followed by at least one non-whitespace character". The kernel returns the bare box `- [ ]` as a **row** with `criterion: false` (`items.ts:434-446`; your own table row: Row? yes / Gates? **no**). Two tests, not one; an author implementing the bolded sentence drops the placeholder row and the renderers lose it. Unchanged in substance since #611 and corrected by the table right below — but this PR edited that exact sentence, so it is either a one-clause fix here or a filed follow-up.

**F5 — nit: "`\u00a0` and the other Unicode spaces" is ambiguous against the `\s` warning two rows above.** U+2028/U+2029 are inside JS's `\s` and ARE Unicode line/paragraph separators, so a reader who reads "Unicode spaces" as "the `\s` class" sees a contradiction with "do not widen the set by analogy with `\s`". Precise form: "the `\p{Zs}` spaces" or "the `\s`-class spaces that are not LineTerminators". The kernel's own comment is equally loose ("`\u00a0` and friends"), so this is fidelity, not invention.

**Also checked and clean:** no skill or README statement is made false by this edit; ADR 0015 states no terminator set of its own (grep clean), so this section is now the only normative place it lives — which is the point of the PR; no docs index entry is owed (no new file, no new heading); the "gate has always been a `/…/gm` regex" clause is historical and accurate (`acceptanceComplete` is a pure predicate; #611 keeps the pre-fix regex as the test oracle).

## Probes needed (not run by me — a reviewer must not execute gates)

1. `cd /home/arggon/Projects/ArggonManager-bug-convention-md-acceptance-terminator-framing && npx prettier --check ArggonManager/docs/convention.md` → expect exit 0, no output. Demonstrates the file is a prettier fixed point, which is the only thing making F2's substitute argument sound. A non-zero result turns F2 into a real red gate.
2. `cd /home/arggon/Projects/ArggonManager-bug-convention-md-acceptance-terminator-framing && npx vitest run cli/src/prose-format.test.ts` → expect 3 passed. Demonstrates the content-reading test I flagged in F2 passes on the new table's code spans. Any failure blocks merge on its own.
3. `cd /home/arggon/Projects/ArggonManager-bug-convention-md-acceptance-terminator-framing && npm run arggon -- validate` → expect `arggon validate: ok (0 warning(s), convention v5)` (the branch also rewrote the item file's acceptance boxes and status).
4. `cd /home/arggon/Projects/ArggonManager-bug-convention-md-acceptance-terminator-framing && npm run lint && npm run test:structure` → expect both clean; `test:structure` is what actually runs `acceptance-rows-use-kernel`, the guard the new text delegates to, so it is worth having green in the record even though no TS changed.

None of these change my verdict on the doc text: it is accurate, well-scoped and correctly sourced. Merge as soon as F1 and F2 are addressed.

### 2026-10-03 @arggon-reviewer
verdict: request-changes (one blocking clause in the line this PR just rewrote; F1, F2, F3, F5 and the delivery deviation all check out)

Round 1's two blockers are genuinely fixed and the fixes are better than the minimum: the impact class is stated on both required surfaces with defensible reasoning plus the alternative reading, and the false gates claim is withdrawn by name, replaced with a correct argument, and then backed by evidence (3/3 on `prose-format` + 2555 green). F5's enumeration is exact — I recomputed it. One new blocking finding remains, and it is *inside* the F4 rewrite: the new bolded biconditional for the CRITERION is falsified by the kernel on a reachable shape and by the table row this same PR added two paragraphs below.

## Blocking

**F4' — the criterion rule as now written is false, and the doc's own new row says so.**
Shipped `:124`: "**A checkbox line is an acceptance ROW when — and only when — it starts with the marker `^[ \t]*[-*] \[( |x|X)\]`; it GATES the `done` flip when — and only when — at least one non-whitespace character follows the box.**"

I evaluated the doc's own quoted marker against the kernel's real one — `ACCEPTANCE_MARKER = /^[ \t]*[-*] \[( |x|X)\][ \t]*/` — note the trailing `[ \t]*`, which the doc's quote omits:

| Line | kernel | doc's biconditional says |
| --- | --- | --- |
| `- [ ] x` | row, criterion **true** | gates ✓ |
| `- [ ]x` | row, criterion **true** | gates ✓ |
| `-  [ ] x` | not a row | not a row ✓ |
| `- [ ]` | row, criterion false | not a row ✗ (this half is now right) |
| `- [ ]  x` (two spaces) | row, criterion **true** | gates ✓ |
| `- [ ]\u00a0x` | row, criterion **false**, text trims to `"x"` | "a non-whitespace character follows the box" → gates ✗ **falsified** |
| `- [ ]\vx` / `- [ ]\u3000x` / `- [ ]\uFEFFx` | row, criterion **false** | gates ✗ **falsified** |

`x` is a non-whitespace character and it does follow the box, yet the row does not gate: only space and tab are consumed after the box, and `ACCEPTANCE_TEXT = /^\S/` is tested on what remains (`lib/src/items.ts:434-446`).

Three refutations, all internal or shipped:
1. **This PR's own new table row** — the `\p{Zs}` row the F5 fix added: "Only space and tab are consumed after the box, so `- [ ]\u00a0x` is a row whose text trims to `x` and still does not gate the flip." The bolded rule and the row below it contradict each other.
2. **The kernel's doc comment** (`items.ts:368-372`) names this exact case: "so `- [ ]\u00a0x` is a row whose text trims to `"x"` and still is not a criterion".
3. **It is test-pinned** — `cli/src/acceptance-parity.test.ts:439-441` asserts `text === "x"` and `criterion === false`, and `\u00a0x` is in the fuzz tail list (`:465`, `:513`).

Why it blocks rather than nits: an author implementing the sentence literally makes `- [ ]\u00a0x` **gate** the flip — an invented refusal wedging a legitimate `done` flip, which is verbatim the failure mode the VT/FF cell two rows above warns against ("Splitting on them invents a refusal the gate never made, and a false refusal wedges a legitimate `done` flip"). The doc would teach the symmetric error in the sentence an author quotes first, which is this item's whole thesis. It is also the reachability test: NBSP/VT/FF after a checkbox arrive by copy-paste, and this repo's own convention.md prose uses NBSP in that position on purpose.

**Fix (~6 words + one pattern char):** quote the marker as the kernel has it — add the trailing `[ \t]*` — and say "when the first character after the box **and after any spaces or tabs** is non-whitespace". Then the bolded rule, the `\p{Zs}` row, `items.ts:370` and the parity corpus all say the same thing.

## Verified this round

- **F1 ✓ both surfaces, and the class is right.** PR body opens with "Methodology impact class: **Advisory**" plus the no-rule/gate/contract/pipeline-step reasoning, the #611/test-pinned provenance, "no ADR 0016 reference is owed and no skill re-sync is owed", and the byte-equal obligation identified as the Behavioral class's; the item carries the same statement with the same reasoning. Defensible: the four rules that define Behavioral (`agents.md:475-476`) are all absent — the rule, the gate, the contract and the pipeline step are unchanged and were already correct in #611, and the sweep confirms no skill statement this edit makes false (`references/pitfalls.md` is about waivers and the cascade and states no terminator set). Flagging the alternative reading instead of picking silently is exactly what the bar asks. Advisory also implies the F4/F5 doc edits do not trigger a skill re-sync — consistent.
- **F2 ✓ withdrawn correctly, and the replacement argument is sound.** I re-derived it: at a prettier fixed point `prettier.format(source) === source`, so rule 2 compares the file's code spans against themselves (`before.length === after.length`, no differing slice) and rule 1's glue diff is empty by construction — the conclusion follows. The "sufficient condition, not the rule's contract" caveat is accurate and matches the test's own header (`prose-format.test.ts:31-33`: rule 2 is deliberately not `--check` because the corpus need not be byte-clean). The self-criticism of the method ("my grep enumerated which tests mention the *path* and I never checked which read *content*") is the correct diagnosis of how a "verified by grep" label carried a false claim. Citations check out: `proseDocs()` keeps every tracked md under `ArggonManager/docs/` (`:69-80`), rules 1–2 read the bytes, and rule 3's `REPAIRED_FILES` does **not** include this file (grep count 0) — so rule 3 imposes no formatting obligation here, which is what makes the fixed-point argument the right one.
- **F5 ✓ the enumeration is exactly right** (independent recomputation over the BMP: `\s` has 25 members; `\p{Zs}` has 17; the doc's 17 points are precisely `\p{Zs}` — zero members of `\p{Zs}` outside the list, zero list members outside `\p{Zs}`; and `\s` minus the four LineTerminators minus VT/FF minus tab = that list **+ U+FEFF**, nothing more). The VT/FF cell's new clause is also correct: all four LineTerminators are inside JS's `\s` and they are exactly the four rows above it. The ambiguity that made this a nit is gone.
- **F3 ✓ right home, and the invariant wording does not overstate.** The follow-up is correctly filed: `bug-parity-suite-cannot-catch-wrong-input-at-call-sites` under `story-spec-pipeline`, labels tests/done-gate, `depends_on: [bug-convention-md-acceptance-terminator-framing]` so it cannot be claimed before this merges, and its acceptance list is a real checklist with both routes (cover the call sites with a comment-filed and a clipped body, **or** prove structural incapability by type or a lint rule and say so in the suite header) plus the wording correction. It is a coverage bug about `acceptance-parity.test.ts` / `board.ts` / `tui.ts`, so that story, not this docs item. The doc's §One body, one question@ paragraph is purely normative — "must read the item's **canonical** body … must not trim, EOL-normalize, clip or filter it before calling" — and claims no enforcement, so an author is told the invariant while only the grammar is test-enforced, exactly as it should be. The one overstatement left is the "Call the kernel" sentence (inherited verbatim from `tools/ast-grep/README.md:213-224`), which is tracked. Nit for whoever claims that item: its box 3 lists the ast-grep README as the phrasing site; add `docs/convention.md`'s sentence as a third site.
- **Delivery deviation ✓ disclosed accurately, and the equivalence proof is real.** The reflog shows the sequence exactly as reported: a rebase attempt onto `origin/main` (`08:07:27`, which would have needed a force-push), then `reset: moving to 78d22366` — back to the published tip — then `merge origin/main` (`05ef1aa2`), then `cherry-pick` of the F4/F5 commit (`8567d450`), then three task comments. `origin/fix/bug-convention-md-acceptance-terminator-framing` == local HEAD (`f6d00aa8`), so the push was a plain fast-forward with no force. Nothing from main is dropped: the three-dot (`origin/main...HEAD`) and two-dot (`origin/main HEAD`) diffs return the **same two files**, which is only possible when the merge base equals main's tip — so main's 12 commits are fully contained and nothing main-side is reverted. Equivalence proof verified by hash: the rebased tree and the cherry-picked tree are the **same tree** (`25bd149e`) and the same `convention.md` blob (`01c850cd`); HEAD's tree differs only by the three later `chore(tasks)` comment commits.
- **Diff shape, precisely.** Still **2 files**. `convention.md` is **+14/−3** — the same numstat as round 1 with different content (F4/F5 rewrote the sentence and the two table cells), so the "+52/−9" total in my brief is round 1's figure: the total is now **+122/−9** because the item file grew from +38/−6 to **+108/−6** as it absorbed my verdict and your round-2 notes. No product, CLI, fixture or skill file in the diff.

## Merge note for the coordinator (not a defect in the PR)

`main@ now carries my verdict commit (`b89a3398`) and the follow-up item, and both sides append to the **same** item file at EOF: base is 41 lines, `main` is 86, the branch is 143. Expect a conflict on that one file at merge time. The resolution must keep both my verdict comment and your round-2 comments; `convention.md` itself merges clean (main did not touch it).

## Probes needed (not run by me — a reviewer must not execute gates)

1. `cd /home/arggon/Projects/ArggonManager-bug-convention-md-acceptance-terminator-framing && npx prettier --check ArggonManager/docs/convention.md` → expect exit 0. This is the premise F2's whole argument now rests on; your gates table claims "tree clean after", which is the same fact stated operationally.
2. `cd /home/arggon/Projects/ArggonManager-bug-convention-md-acceptance-terminator-framing && npx vitest run cli/src/prose-format.test.ts` → expect 3 passed (already reported as green; re-confirm on the merged tree).
3. `cd /home/arggon/Projects/ArggonManager-bug-convention-md-acceptance-terminator-framing && npm test && npm run test:structure && npm run arggon -- validate` → expect 124 files / 2555 passed, 4 passed / 0 failed, `ok (0 warning(s), convention v5)`. `test:structure` is the lane that actually runs `acceptance-rows-use-kernel`, the guard the new text delegates to.
4. After the F4' fix: `npx prettier --write ArggonManager/docs/convention.md` then confirm the fixed point again (`--write` ×2 more, byte-identical, tree clean) — the fix edits a code span, which is precisely what `prose-format` rule 2 guards.
5. The merge itself, on a scratch branch: expect a conflict confined to the item file, and confirm the merged diff vs pre-merge main still shows `convention.md` as the only product-doc change.

Everything else in this PR is ready. Approve on sight once F4' lands — and please do not harden the criterion sentence back into "non-whitespace follows the box"; that phrasing is the bug.
