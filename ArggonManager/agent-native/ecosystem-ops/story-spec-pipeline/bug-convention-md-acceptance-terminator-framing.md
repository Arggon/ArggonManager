---
type: bug
status: in_progress
id: bug-convention-md-acceptance-terminator-framing
title: "`docs/convention.md:139` frames acceptance-box parsing as \"LF and CRLF\" — the exact framing that hid the U+2028/U+2029 done-gate false-pass in PR #611"
assignee: Arggon
branch: fix/bug-convention-md-acceptance-terminator-framing
parent: story-spec-pipeline
labels: [docs, done-gate]
created: "2026-10-03"
updated: "2026-10-03"
claimed_at: "2026-10-03T10:44:56.312Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-convention-md-acceptance-terminator-framing
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
