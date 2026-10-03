---
type: bug
status: todo
id: bug-convention-md-acceptance-terminator-framing
title: "`docs/convention.md:139` frames acceptance-box parsing as \"LF and CRLF\" — the exact framing that hid the U+2028/U+2029 done-gate false-pass in PR #611"
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

The reviewer verified the cost of the *wrong* fix as well: including `\v`/`\f` in the boundary flips 6.5% of cases from ALLOW to REFUSE — a false refusal wedging a legitimate done flip. So the doc must name both what IS a terminator and what is deliberately NOT, because the symmetric mistake is just as damaging as the original.

Acceptance:
- [ ] `convention.md` names the full LineTerminator set the gate anchors on, and states explicitly that VT (`\v`) and FF (`\f`) are NOT line terminators for this purpose
- [ ] The doc states which body every consumer must be handed (the canonical body) — the #605 trap — so an author cannot pre-filter before calling the predicate
- [ ] Cross-reference the single kernel predicate by name, so the doc points at one implementation rather than describing a grammar to reimplement
- [ ] Keep it to what an author needs BEFORE writing a parser; the implementation detail belongs in the predicate's own doc comment

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
