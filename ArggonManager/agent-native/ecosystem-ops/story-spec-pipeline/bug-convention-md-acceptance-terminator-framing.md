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

The reviewer verified the cost of the *wrong* fix as well: including `\v`/`\f` in the boundary flips 6.5% of cases from ALLOW to REFUSE — a false refusal wedging a legitimate done flip. So the doc must name both what IS a terminator and what is deliberately NOT, because the symmetric mistake is just as damaging as the original.

Acceptance:
- [ ] `convention.md` names the full LineTerminator set the gate anchors on, and states explicitly that VT (`\v`) and FF (`\f`) are NOT line terminators for this purpose
- [ ] The doc states which body every consumer must be handed (the canonical body) — the #605 trap — so an author cannot pre-filter before calling the predicate
- [ ] Cross-reference the single kernel predicate by name, so the doc points at one implementation rather than describing a grammar to reimplement
- [ ] Keep it to what an author needs BEFORE writing a parser; the implementation detail belongs in the predicate's own doc comment
