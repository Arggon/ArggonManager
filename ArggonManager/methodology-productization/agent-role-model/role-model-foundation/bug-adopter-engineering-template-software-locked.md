---
type: bug
status: todo
id: bug-adopter-engineering-template-software-locked
title: templates/docs/docs/engineering.md (the adopter-facing review-bar template) is software-locked — ADR 0021 §6.2 domain neutrality does not reach the file every new adopter reads first
parent: role-model-foundation
labels: [docs, templates, methodology]
priority: p2
created: "2026-10-04"
updated: "2026-10-04"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-adopter-engineering-template-software-locked.md
  Leaves live only under a story. id is the filename stem: bug-adopter-engineering-template-software-locked.
  CLI `arggon create bug adopter-engineering-template-software-locked` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# templates/docs/docs/engineering.md (the adopter-facing review-bar template) is software-locked — ADR 0021 §6.2 domain neutrality does not reach the file every new adopter reads first

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

ADR 0021 §6.2 makes domain neutrality part of the methodology: a rule is named by
**what the project declares**, never by software artifacts. The carriers now honor
that, but `templates/docs/docs/engineering.md` — the template `arggon init` renders
into every adopting repo's `ArggonManager/docs/engineering.md` — still opens with
*"code is cheap; good practices and sound software architecture are always
important"* and keeps *"Tests cover the behavior change"* in its expectations table.

So the first document a non-software adopter reads after `init` teaches them a
software-only bar, while the carriers say otherwise. Found reviewing PR #636 (the
worker flagged it rather than widening scope — correct, `templates/**` was outside its
file set).

## Acceptance

- [ ] The operating principle and the testing-expectations rows are restated as what the adopting project declares, software case kept as one worked example
- [ ] Software-noun table headers generalized the same way
- [ ] The **review bar keeps its teeth**: a generically stated bar is still blocking, still evidenced, still owned — no bar weakened or dropped while being generalized
- [ ] `x-generated` provenance respected — re-running `init` must not read as adopter-edited spuriously
- [ ] `cli/src/init.test.ts` + the prose-format suite green; `arggon validate` ok; prettier clean
- [ ] Cross-checked against `templates/docs/docs/agents.md` and `convention.md` for the same lock — if clean, say so in the item rather than editing them

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K
### 2026-10-04 @coordinator — scope widened (finding from PR #638's review)

A worker on `bug-parity-invariant-restated-outside-carriers` found the **same defect in a
sibling file with a larger blast radius**, and it belongs in this item rather than a
near-duplicate:

- **`templates/docs/docs/convention.md:3`** — the adopter template `arggon init` writes into
  every new project still says *"Humans and agents follow the same rules"* **verbatim**,
  which the two-axis rule (ADR 0021 §1) superseded. This is the file that becomes every
  new adopter's `ArggonManager/docs/convention.md`, so it teaches the superseded rule at
  `init` time — before the adopter has read anything else.

**The part that matters more than the sentence:** no test guards it.
`cli/src/init-docs.test.ts:166` asserts the file is *adopter-owned* but never compares its
content against the carriers' invariant block. So an adopter template can carry a
superseded rule, ship green, and be wrong at every adopter's first read. That is the same
class as `bug-x-tracker-option-list-has-no-doc-drift-guard` — a carrier restated in a
second place with nothing tying the two together.

**Added to this item's acceptance:**

- [ ] `templates/docs/docs/convention.md` carries the two-axis rule (or points at the carrier that does) instead of the verbatim parity sentence
- [ ] **A guard exists**: a test asserts the adopter templates' invariant statement matches the carriers' invariant block, so the two cannot drift. Without this row, the fix is one `init` regeneration away from regressing
- [ ] The guard covers `templates/docs/docs/engineering.md`, `agents.md`, `convention.md`, `AGENTS.md` and `README.md` as one set — the whole template family — rather than the single file that happened to break
- [ ] ADR 0016 upgrade-channel note: an **existing** adopter's copy is not refreshed by `init` (never-overwrite), so the corrected template only reaches **new** trees. Say in the release notes that adopters must reconcile their own copies, and decide whether `init --propose` should carry it
- [ ] Cross-checked against `templates/docs/docs/AGENTS.md:17` and `templates/docs/docs/viewer-spike.md` — the work-loop-parity statements there are still correct under the two-axis rule and must be left alone

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
### 2026-10-04 @coordinator — one more file added (from PR #641's review)

`templates/docs/AGENTS.md:17` carries a **pre-rename role word**, so the adopter template family
sweep now has a fourth member. Add it to this item's file set and to the guard clause:

- [ ] `templates/docs/AGENTS.md:17` uses the shipped role vocabulary (ADR 0021 §6.1) rather than the pre-rename wording
- [ ] The existing guard row ("the whole template family, not the file that happened to break") now covers `engineering.md`, `agents.md`, `convention.md`, `AGENTS.md`, `README.md`

Note for whoever picks this up: PR #641 renamed the ids the *shipped* seam generates. The
**adopter templates** are a separate copy and were deliberately out of that PR's scope — which
is why this item exists.

### 2026-10-11 @ses_ed4c5d320ffeScEzxxks3AMgTV
verdict: approve (review-bar generalization + family drift guard)

## What I read

- git -C /home/arggon/Projects/ArggonManager-bug-adopter-engineering-template-software-locked diff main...HEAD (6 non-tracker files: 3 templates, the new 272-line guard, cli/src/init-docs.test.ts, CHANGELOG.md).
- templates/docs/docs/engineering.md in full (60 lines) — line-by-line against the pre-change version.
- ArggonManager/docs/{agents,engineering,convention}.md and README.md:66-67 — the carriers' `- **Scope:**` / `- **Invariants:**` block.
- cli/src/init-docs.test.ts:79-91 (the 2 KB AGENTS.md budget), cli/src/docs.ts:858-905 (renderGeneratedDoc + marker stamping), lib/src/convention.ts:733 (readGeneratedState).
- release-please-config.json, .release-please-manifest.json, release.md §"What the automation owns", and the CHANGELOG's own history (git log -S '## [Unreleased]' -- CHANGELOG.md, git show fcbb3356 -- CHANGELOG.md, git show 13d72f5f -- CHANGELOG.md).
- find templates -type f (the full 75-file template tree).

## What I checked, expected vs observed

**(a) The review bar kept its teeth.** Expected: generic but still blocking, still evidenced, still owned. Observed — row by row, all five reviewable rows, both non-functional bars and the end-to-end clause survive with the requirement intact:

| Row | Before | After | Teeth |
| --- | --- | --- | --- |
| Operating principle | "code is cheap; …always important" | "the artifact is cheap; sound structure and good practice are always important" + declare-your-own + marked worked example | intact (still "always", still blocks "refactor later") |
| Verification row | "Tests cover the behavior change" | "The verification this project declares for the change exists and covers it — new checks for new behavior, updated checks for changed behavior" | intact (same obligation, generalized noun) |
| Docs / item id / arggon validate | verbatim | verbatim | intact |
| Scalability | "payloads stay bounded; complexity is declared … no unbounded reads or renders" | "the artifact's cost stays bounded wherever its inputs grow with the data (a superlinear step must justify its input ceiling); no unbounded reads, renders or rework" | intact, marginally stronger |
| Security | "subprocess arguments are arrays, never shell-interpolated" | "anything that reaches a shell, a store or a third party is validated or parameterized, never interpolated" | intact and broader |
| End-to-end | "Smoke gate (blocks merge)… CLI: probe…; UI: real browser…; Docs-only exempt" | "**Blocking end-to-end check (blocks merge)**… run it and record expected-vs-observed evidence in the review verdict. Blocking means the verdict says so, the evidence is attached, and someone owns the call." + marked software examples | intact, and strengthened by adding an explicit owner |

**(b) Worked examples clearly marked.** Observed: exactly two, both italicized and explicitly scoped — _Worked example (software):_ (the operating principle) and _Worked examples (software):_ (the end-to-end check). The software nouns survive in the examples, not in the bars. The claim is honest.

**(c) The guard is a real drift guard.** Observed: cli/src/adopter-template-invariant-drift.test.ts is 3 clauses — (1) the carriers carry ONE Invariants block and ONE Scope line (precondition, so a moving target cannot be compared); (2) the whole templates/docs/** .md family is walked (not hand-listed) and no member may carry the superseded flat-parity sentence, a retired id, or the pre-rename role word, with a byte-identity assertion for any member that restates an invariant or the scope, read from the carriers **at run time**; (3) the family cannot shrink (REQUIRED_MEMBERS must exist, walked.length > 10, and the two seam prefixes must be non-empty so the exclusion is a decision, not an accident). A vacuous walk is therefore impossible. I verified the invariants are byte-identical across all four carriers and both templates: one md5 (c404a661a98a) on ArggonManager/docs/{agents,engineering,convention}.md, README.md:67, templates/docs/docs/engineering.md:6 and templates/docs/docs/convention.md, and the Scope line `- **Scope:** any project — not only software.` is likewise unique. The maker's five reported red runs are consistent with those assertions.

**(d) CHANGELOG.md and release-please.** Expected: a hand-added ## [Unreleased] section in a release-please-owned file to be either the project's own convention or a maintenance hazard. Observed: **this repo's live convention**, so not a finding. release-please-config.json has skip-changelog: false and release.md #2 says release-please "drafts the CHANGELOG.md section" in a PR touching exactly five files. But the history shows the same practice twice since automation landed: PR #541 (fcbb3356, 2026-10-01) added an ## [Unreleased] section carrying an adopter migration note for exactly this reason ("init skips adopter-modified opencode.jsonc → hand-apply"), and the 0.5.0 release commit (13d72f5f) replaced -## [Unreleased] with the curated ## [0.5.0](…) section — i.e. the release PR's documented curation step absorbs it. CHANGELOG.md is also acknowledged: true in this repo's x-generated, so init never regenerates it and the hand edit cannot read as adopter-drift. Precedent + provenance + a documented curation step: the shape is right.

**(e) The maker's file claims.** Expected: templates/docs/docs/AGENTS.md and templates/docs/docs/viewer-spike.md absent, and the item's path references were wrong. Observed: confirmed by find templates -type f — templates/docs/docs/ holds exactly convention.md, deploy.md, engineering.md, runbooks/; no agents.md, no viewer-spike anywhere under templates/. The adopter router is templates/docs/AGENTS.md and the maker correctly resolved the item's path error to it.

## Findings (none blocking)

1. **The guard's own header overstates what it compares.** The comment says "The four ADR 0020 carriers carry a byte-identical - **Invariants:** line", but bulletsOf only matches blockquote-prefixed lines, and README.md:66-67 carries the same two bullets as **plain list items**. The README therefore contributes nothing to carrierInvariants/carrierScopes and the clause actually compares the three doc carriers. Harmless today (the text is byte-identical — I checked) but the claim in the file is broader than the assertion. A one-line comment in the guard fixes it.
2. **Docs-only exemption moved inside the software worked example.** "Docs-only changes are exempt." used to be a general clause; it now sits inside the _Worked examples (software):_ sentence. For a non-software adopter this reads as software-specific. One sentence out of the example restores the tooth.
3. **The seam exclusion is a real hole for the very class it guards.** templates/docs/zcode/** and templates/docs/opencode/** are excluded from the family walk, and the maker's own finding #2 names a pre-rename role word surviving at templates/docs/zcode/arggon/commands/arggon-goal.md:29. That is the exact defect the guard exists to catch, sitting in the excluded subtree. Justified for this item (PR #641 owns the seam ids) but it is an open hole — the delivery lead should file it.
4. templates/docs/docs/convention.md's extension table was re-padded by prettier (content unchanged); this is pre-existing drift the maker did not introduce, but it does mean the rendered adopter convention.md changes bytes for every existing adopter at their next init.

## What remains unverified

Execution. I ran no gate: not npm test (2933 tests), not argong validate, not prettier --check, not the init --propose fixture proof, not the five reverted red runs. I verified by reading that the assertions *can* fail and that the invariants they compare are byte-identical; the red-run evidence and the gate results are the verifier's to reproduce.

## Probes needed

1. cd /home/arggon/Projects/ArggonManager-bug-adopter-engineering-template-software-locked && npx vitest run cli/src/adopter-template-invariant-drift.test.ts cli/src/init-docs.test.ts — demonstrates the guard passes and the rewritten init-docs.test.ts orchestration assertions (delivery lead / project's own bar / not.toMatch(/\bcoordinat/i)) hold on the new template. A failure here would mean the family walk fires on something I did not see.
2. Same cwd: printf 'Humans and agents follow the same rules.\n' >> templates/docs/docs/convention.md && npx vitest run cli/src/adopter-template-invariant-drift.test.ts; git checkout templates/docs/docs/convention.md — demonstrates the superseded-parity clause actually fails (the PR #638 shape). If it passes, the guard is theatre and finding (c) is wrong.
3. Same cwd: npx vitest run cli/src/init-docs.test.ts with git stash of the templates/docs/AGENTS.md hunk — demonstrates the 2 KB budget assertion is load-bearing on the new router (I compute the render at ~2021-2030 bytes against the 2048 budget; if the budget test fails without the trims, the trims were forced, not cosmetic).
