---
type: bug
status: in_progress
id: bug-adopter-engineering-template-software-locked
title: templates/docs/docs/engineering.md (the adopter-facing review-bar template) is software-locked — ADR 0021 §6.2 domain neutrality does not reach the file every new adopter reads first
assignee: arggon-delivery-lead
branch: fix/bug-adopter-engineering-template-software-locked
parent: role-model-foundation
labels: [docs, templates, methodology]
priority: p2
created: "2026-10-04"
updated: "2026-10-11"
claimed_at: "2026-10-11T09:57:40.781Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-adopter-engineering-template-software-locked
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-adopter-engineering-template-software-locked.md
  Leaves live only under a story. id is the filename stem: bug-adopter-engineering-template-software-locked.
  CLI `arggon create bug adopter-engineering-template-software-locked` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# templates/docs/docs/engineering.md (the adopter-facing review-bar template) is software-locked — ADR 0021 §6.2 domain neutrality does not reach the file every new adopter reads first

## Context

ADR 0021 §6.2 makes domain neutrality part of the methodology: a role is named by
**what the project declares**, never by software artifacts. The adopter-facing
templates still taught a software-only bar — `templates/docs/docs/engineering.md`
opened with *"code is cheap; good practices and sound software architecture are
always important"* and kept *"Tests cover the behavior change"* in its
expectations table; `templates/docs/docs/convention.md` carried the superseded
verbatim parity sentence; `templates/docs/AGENTS.md:17` carried a pre-rename role
word — so the first documents a non-software adopter reads after `init`
contradicted the carriers. Found reviewing PR #636; scope widened twice by the
coordinator from PR #638's and PR #641's reviews. No test guarded the template
family against carrier drift, so a superseded rule could ship green and be wrong
at every adopter's first read.

## Acceptance

- [x] The operating principle and the testing-expectations rows are restated as what the adopting project declares, software case kept as one worked example
- [x] Software-noun table headers generalized the same way
- [x] The **review bar keeps its teeth**: a generically stated bar is still blocking, still evidenced, still owned — no bar weakened or dropped while being generalized
- [x] `x-generated` provenance respected — re-running `init` must not read as adopter-edited spuriously
- [x] `cli/src/init.test.ts` + the prose-format suite green; `arggon validate` ok; prettier clean
- [x] Cross-checked against `templates/docs/docs/agents.md` and `convention.md` for the same lock — the former is absent, the latter had it and is fixed; the other family members are now guarded family-wide
- [x] `templates/docs/docs/convention.md` carries the two-axis rule (or points at the carrier that does) instead of the verbatim parity sentence
- [x] **A guard exists**: a test asserts the adopter templates' invariant statement matches the carriers' invariant block, so the two cannot drift. Without this row, the fix is one `init` regeneration away from regressing
- [x] The guard covers `templates/docs/docs/engineering.md`, `agents.md`, `convention.md`, `AGENTS.md` and `README.md` as one set — the whole template family — rather than the single file that happened to break
- [x] ADR 0016 upgrade-channel note: an **existing** adopter's copy is not refreshed by `init` (never-overwrite), so the corrected template only reaches **new** trees. Release notes say adopters must reconcile their own copies; the `init --propose` decision is recorded
- [x] `templates/docs/AGENTS.md:17` uses the shipped role vocabulary (ADR 0021 §6.1) rather than the pre-rename wording
- [x] Cross-checked against `templates/docs/docs/AGENTS.md:17` and `templates/docs/docs/viewer-spike.md` — the work-loop-parity statements there are still correct under the two-axis rule and are left alone

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

### 2026-10-11 @ses_ed596d14affebT3A7Wx22iqJPB
## 2026-10-11 @arggon-maker (worktree fix/bug-adopter-engineering-template-software-locked, commit 6ea424dc) — done, evidence

### Path caveat resolved (paths in the notes above do not exist)

I read the tree instead of trusting the note:

- `templates/docs/docs/AGENTS.md` — **absent**. The adopter router lives one level up at
  `templates/docs/AGENTS.md` (it renders to the adopting repo's ROOT).
- `templates/docs/docs/viewer-spike.md` — **absent**, and no `viewer-spike` anywhere under
  `templates/` at all. `viewer-spike` exists only under `ArggonManager/` and `README.md`
  as *task* stems (opencode2-native/native-redesign, ui/ui-web-board-v2) — it is an item
  id, never an adopter template. So there is no viewer-spike work-loop-parity statement
  to leave alone.
- `templates/docs/docs/agents.md` — **absent**. `templates/docs/docs/` holds exactly
  convention.md, deploy.md, engineering.md, runbooks/.

Resolved file set: `templates/docs/AGENTS.md` (+1), `templates/docs/docs/convention.md`,
`templates/docs/docs/engineering.md`, and the new guard. `templates/docs/docs/AGENTS.md`
and `viewer-spike.md` were NOT invented. Work-loop-parity statements that DO exist and were
left alone: `templates/docs/AGENTS.md` line 3 ("For humans and AI agents working on…" — a
router preamble, not a rules parity claim) and "Subagents follow the same rules" in the
Orchestration paragraph (correct under the two-axis rule).

### The two templates

`templates/docs/docs/engineering.md` — the operating principle, the reviewable checklist,
the non-functional bar, the smoke gate, the definition of done and the testing rows are now
stated as what the adopting project **declares**; the software case survives as two
clearly-marked worked examples (`_Worked example (software):_` for the principle,
`_Worked examples (software):_` for the end-to-end check). Bar teeth unchanged:

- "It does one thing" · verification the project declares exists and covers the change
  (new checks for new behavior, updated for changed) · docs in the same PR · item id in the
  PR · `arggon validate` passes — all five kept verbatim-ish.
- "Smoke gate (blocks merge)" → "**Blocking end-to-end check (blocks merge)**": still
  blocking, still evidenced ("record expected-vs-observed evidence in the review verdict"),
  still owned ("Blocking means the verdict says so, the evidence is attached, and someone
  owns the call").

"Software-noun table headers": **this template has no markdown tables** — the row headers it
does have are the CLI/UI clause labels, "Tests green locally and in CI (including lint/typecheck
gates)" and "unit vs integration split". Those are what I generalized ("The verification this
project declares… (all of its gates, not only the fastest)", "part-level / whole-behavior").

`templates/docs/docs/convention.md` — line 3's "Humans and agents follow the same rules." is
replaced by the two-axis rule restated in adopter-local words (work-loop parity + authority
asymmetric and named), plus the carriers' byte-identical `- **Invariants:**` block. It now
also carries `- **Scope:** any project — not only software.`

`templates/docs/AGENTS.md` — "coordinator" → the shipped **delivery lead**; the review clause
is now "code-reviews every subagent change against the project's own bar" (the pre-rename
wording also carried the software job title "lead architect", which ADR 0021 §6 remaps). The
invariant pointer is one clause in Docs & gates — AGENTS.md is budget-bounded at 2048 bytes
(ADR 0006) and the generated file lands at 2033 bytes (15 bytes headroom), so it POINTS at the
carrier instead of carrying the block. That forced five small trims elsewhere in the file
(dropped "(Code Mode tools.arggon.*)", "`--no-agents` omits it", "claim rules"→"claims",
"Claim before starting"→"Claim first", "for a full scan"→"for a scan") — the old file's render
was already 2036 bytes, so it had 12 bytes of slack.

### The guard (cli/src/adopter-template-invariant-drift.test.ts, 6 tests)

Clause 1 — the four carriers (ArggonManager/docs/agents.md, engineering.md, convention.md,
README.md) carry ONE byte-identical `- **Invariants:**` block and ONE `- **Scope:**` line
(PR #636's parity had nothing pinning it). Clause 2 — the whole adopter template family is
walked as one set (every .md under templates/docs/ except the opencode/ and zcode/ seam
subtrees, which PR #641 owns) and no member may carry the superseded flat-parity sentence
(whitespace/case-normalized), a retired agent id, or the pre-rename role word; a member that
restates an invariant or the scope must restate it byte-identically to the carriers, which are
read at run time. Clause 3 — the family cannot shrink: the members the guard leans on are
required to exist and to carry the block.

Why the seams are out of the walk: the OpenCode/ZCode templates are generated agent contracts
whose id sweep is PR #641's, not the governing docs a new adopter reads first.

### Gates — expected vs observed

| Gate | Expected | Observed |
| --- | --- | --- |
| `npx vitest run` (after `npm run build`, dist was absent in the worktree) | 0 failures | **137 files / 2933 tests passed** |
| `npm run arggon -- validate` | ok, 0 warnings | **ok (0 warning(s), convention v5)** |
| `npx prettier --check` on the 5 files I touched | clean | **clean** |
| `npx prettier --check CHANGELOG.md` | no NEW violations | prettier wants 905 changed lines on it — **exactly the 905 it wants at HEAD** (pre-existing `*`→`-` release-please churn; my section is written `-`, adding 0). Repo-wide `prettier --check .` is red for 648 files at HEAD and 646 after this change (convention.md + engineering.md became clean). |
| `npm run lint` / `npm run test:structure` | clean | **clean** |
| `x-generated` provenance | re-running `init` must not read my edit as adopter-edited | this repo's AGENTS.md / ArggonManager/docs/{engineering,convention}.md are NOT in x-generated (they are hand-maintained carriers), so `init` skips them as adopter content; the audit test (`provenance-audit.test.ts`, repo-self block) stays green and `headless-ci.test.ts`'s packed drift gate passed. |

### Demonstrated red — the guard is a real drift guard, not theatre

Each break below was applied to a copy, run, and restored; all five went red:

1. Superseded sentence re-inserted into `templates/docs/docs/convention.md` →
   `"templates/docs/docs/convention.md: carries the superseded flat-parity sentence…"`
2. `- **Invariants:**` bullet in `templates/docs/docs/engineering.md` reworded (one word) →
   `"- **Invariants:** diverges from the carriers' block"` × 2 (byte-identity + required-block)
3. **A carrier** (`ArggonManager/docs/agents.md`) rewrote its own invariant line →
   `expected 2 to be 1` (the one-block precondition)
4. "a coordinator" restored in `templates/docs/AGENTS.md` →
   `"uses the pre-rename role word "coordinator""`; and `cli/src/init-docs.test.ts` went red twice for the same reason (its new `not.toMatch(/\bcoordinat/i)` assertion, plus the 2 KB budget at 2067 bytes)
5. The invariant block deleted from `templates/docs/docs/convention.md` →
   `"templates/docs/docs/convention.md must carry the invariant block: expected null not to be null"`

I also updated `cli/src/init-docs.test.ts`'s orchestration assertions (`coordinator` /
`lead architect` → `delivery lead` / `project's own bar`) — the template fix would otherwise
have left that suite red.

### ADR 0016: release-notes note, and the `init --propose` decision

CHANGELOG.md gains a `## [Unreleased]` section with an explicit **"Adopter upgrade channel
(ADR 0016)"** subsection: `init` never overwrites, an acked/modified doc is skipped on every
re-run, so the corrected templates reach **new** trees only and existing adopters must
reconcile their own copies (doctor's `outdated` bucket → `init --dry-run` → `init --propose`
side files → re-ack).

**Decision: `init --propose` IS the carrier, and no new flag is needed.** Proven on a fixture
adopter (git init → `init --full` → old template bytes restored into the three dests →
`adopt --ack`): plain `init` left the adopter's superseded sentence byte-identical (never
overwrite honoured), while `init --propose` wrote exactly three side files
(`AGENTS.md.proposed-0.6.0`, `ArggonManager/docs/convention.md.proposed-0.6.0`,
`ArggonManager/docs/engineering.md.proposed-0.6.0`); the engineering proposal carries
"_Worked example (software):_" and the blocking end-to-end check, the convention proposal
carries "work-loop parity" and zero occurrences of the superseded sentence, the AGENTS proposal
carries "delivery lead", and all three originals stayed untouched. Every affected destination is
exactly the acked-or-modified case `--propose` exists for.

### Acceptance checklist (ticked here — the boxes live in the comment record, not the live section)

- [x] Operating principle + testing rows restated as what the project declares; software kept as a worked example
- [x] Software-noun row headers generalized (no tables in this template — see above)
- [x] Review bar keeps its teeth: generic but still blocking, evidenced, owned
- [x] `x-generated` provenance respected — re-running `init` does not read as adopter-edited
- [x] `cli/src/init.test.ts` + prose-format suite green; `arggon validate` ok; prettier clean
- [x] Cross-checked `templates/docs/docs/agents.md` (absent) and `convention.md` (had the lock, fixed it); the other family members are now guarded family-wide
- [x] `templates/docs/docs/convention.md` carries the two-axis rule
- [x] A guard exists and asserts the templates' invariant statement matches the carriers' block
- [x] The guard covers the whole family as one set (walked, not hand-listed)
- [x] ADR 0016 upgrade-channel note in the release notes + `--propose` decision proven
- [x] `templates/docs/AGENTS.md:17` uses the shipped role vocabulary
- [x] The work-loop-parity statements that exist are left alone (see the path resolution above)

**The live `## Acceptance` section of this item is still the boilerplate placeholder** — the
contract lives in the dated comment record above, and `tools.arggon.comment` is append-only,
so I could not tick it in place. Filling that section (or flipping the item to done) is the
delivery lead's call at merge, per §Done.

### Findings for the delivery lead — not fixed here, please file

1. **`templates/docs/CONTRIBUTING.md:32`** — "- [ ] Tests pass locally (`npm test` or the
   project equivalent)" names the software noun first; **`templates/docs/github/PULL_REQUEST_TEMPLATE.md:18`** —
   "- [ ] Tests pass locally" has no project-equivalent escape at all. Same class as this item
   but outside its named file set, and the cross-check row says report rather than edit.
2. **`templates/docs/zcode/arggon/commands/arggon-goal.md:29`** — "so the coordinator can
   follow the claim", a pre-rename role word surviving in a shipped seam template. Outside my
   walk by design (the seam belongs to PR #641's sweep + the adapter tests, which are another
   maker's file set).
3. This repo's own `CHANGELOG.md` carries 905 lines of pre-existing prettier drift
   (`*`→`-`), so repo-wide `prettier --check .` is red at HEAD (648 files) and cannot be used
   as a gate until someone runs `prettier -w` over the tree.

### handoff 2026-10-11 @ses_ed596d14affebT3A7Wx22iqJPB (session: ses_ed596d14affebT3A7Wx22iqJPB) — next: Review PR on branch fix/bug-adopter-engineering-template-software-locked (commit 6ea424dc); template edits + drift guard + ADR 0016 release note are complete and every gate is green (2933 tests, vali…
- branch: fix/bug-adopter-engineering-template-software-locked
- open questions: Three findings are NOT filed and need tracker items (decision is the lead's): (1) templates/docs/CONTRIBUTING.md:32 and templates/docs/github/PULL_REQUEST_TEMPLATE.md:18 still name the software noun …

### 2026-10-11 @ses_ed596d14affebT3A7Wx22iqJPB
### 2026-10-11 @arggon-maker — typo correction to the handoff above

The handoff's open-questions reads "argonn-goal.md"; the real path is
`templates/docs/zcode/arggon/commands/arggon-goal.md:29`. Nothing else in the handoff
changes.

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

| Row                              | Before                                                                          | After                                                                                                                                                                                                                                      | Teeth                                                  |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Operating principle              | "code is cheap; …always important"                                              | "the artifact is cheap; sound structure and good practice are always important" + declare-your-own + marked worked example                                                                                                                 | intact (still "always", still blocks "refactor later") |
| Verification row                 | "Tests cover the behavior change"                                               | "The verification this project declares for the change exists and covers it — new checks for new behavior, updated checks for changed behavior"                                                                                            | intact (same obligation, generalized noun)             |
| Docs / item id / arggon validate | verbatim                                                                        | verbatim                                                                                                                                                                                                                                   | intact                                                 |
| Scalability                      | "payloads stay bounded; complexity is declared … no unbounded reads or renders" | "the artifact's cost stays bounded wherever its inputs grow with the data (a superlinear step must justify its input ceiling); no unbounded reads, renders or rework"                                                                      | intact, marginally stronger                            |
| Security                         | "subprocess arguments are arrays, never shell-interpolated"                     | "anything that reaches a shell, a store or a third party is validated or parameterized, never interpolated"                                                                                                                                | intact and broader                                     |
| End-to-end                       | "Smoke gate (blocks merge)… CLI: probe…; UI: real browser…; Docs-only exempt"   | "**Blocking end-to-end check (blocks merge)**… run it and record expected-vs-observed evidence in the review verdict. Blocking means the verdict says so, the evidence is attached, and someone owns the call." + marked software examples | intact, and strengthened by adding an explicit owner   |

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

Execution. I ran no gate: not npm test (2933 tests), not argong validate, not prettier --check, not the init --propose fixture proof, not the five reverted red runs. I verified by reading that the assertions _can_ fail and that the invariants they compare are byte-identical; the red-run evidence and the gate results are the verifier's to reproduce.

## Probes needed

1. cd /home/arggon/Projects/ArggonManager-bug-adopter-engineering-template-software-locked && npx vitest run cli/src/adopter-template-invariant-drift.test.ts cli/src/init-docs.test.ts — demonstrates the guard passes and the rewritten init-docs.test.ts orchestration assertions (delivery lead / project's own bar / not.toMatch(/\bcoordinat/i)) hold on the new template. A failure here would mean the family walk fires on something I did not see.
2. Same cwd: printf 'Humans and agents follow the same rules.\n' >> templates/docs/docs/convention.md && npx vitest run cli/src/adopter-template-invariant-drift.test.ts; git checkout templates/docs/docs/convention.md — demonstrates the superseded-parity clause actually fails (the PR #638 shape). If it passes, the guard is theatre and finding (c) is wrong.
3. Same cwd: npx vitest run cli/src/init-docs.test.ts with git stash of the templates/docs/AGENTS.md hunk — demonstrates the 2 KB budget assertion is load-bearing on the new router (I compute the render at ~2021-2030 bytes against the 2048 budget; if the budget test fails without the trims, the trims were forced, not cosmetic).
