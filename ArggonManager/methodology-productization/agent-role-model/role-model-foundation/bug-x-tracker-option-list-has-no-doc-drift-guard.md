---
type: bug
status: done
id: bug-x-tracker-option-list-has-no-doc-drift-guard
title: "No test guards the `x-tracker` option list in convention.md against drift — `product-acceptance` shipped implemented-but-undocumented through PR #637's green CI"
assignee: arggon-delivery-lead
branch: fix/bug-x-tracker-option-list-has-no-doc-drift-guard
parent: role-model-foundation
labels: [tests, docs, cli]
priority: p2
created: "2026-10-04"
updated: "2026-10-13"
worktree_path: /home/arggon/Projects/ArggonManager-bug-x-tracker-option-list-has-no-doc-drift-guard
---
<!--
  Placement (v0): ArggonManager/methodology-productization/agent-role-model/role-model-foundation/bug-x-tracker-option-list-has-no-doc-drift-guard.md
  Leaves live only under a story. id is the filename stem: bug-x-tracker-option-list-has-no-doc-drift-guard.
  CLI `arggon create bug x-tracker-option-list-has-no-doc-drift-guard` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# No test guards the `x-tracker` option list in convention.md against drift — `product-acceptance` shipped implemented-but-undocumented through PR #637's green CI

## Context

The `x-tracker` option list in `ArggonManager/docs/convention.md` §Tracker hygiene was
**prose with no structural guard**: `cli/src/convention.test.ts` and its siblings assert
*parsing behaviour*, and nothing asserted that the documented option list matches the keys
`TrackerConfig` actually reads. The consequence was not hypothetical —
`x-tracker.product-acceptance` shipped implemented-but-undocumented through PR #637's
green CI (seam-drift and docs gates included); it was caught by a worker's escalation, not
by a test. Same class as the ADR-index drift (`adr-index-parity.test.ts`), which exists
because the index silently rotted three times. Found reviewing PR #637, raised by the
worker and confirmed by the coordinator.

## Acceptance


- [x] A test derives the official `x-tracker` option list from the type/parser (the single source) and asserts `docs/convention.md` §Tracker hygiene names every key — a new option cannot be added without a doc line. `cli/src/convention-option-doc-contract.test.ts` derives the list three ways (the `TrackerConfig` type members, the parser's `key === "…"` branches, the runtime default object) and checks all three agree, then requires the doc's "official options" sentence to name every key.
- [x] The guard covers the **parse-error sentence** too: the keys it enumerates as boolean-only are exactly the boolean keys, so a boolean option cannot ship outside that list. The same suite checks the "an `k1`/`k2` value that is not `true`/`false`" window both directions — this is what forced the `x-worktree.env` and `x-github.issue-roundtrip` doc completions below.
- [x] The same treatment for the namespaced extensions documented alongside it: the derivation is cheap and uniform, so `x-playbooks`, `x-import`, `x-worktree` and `x-github` are guarded the same way (`x-github` is not in the delivery lead's list but has the identical shape — an exactness gap one section down; it is covered here rather than left as a known hole, at the cost of one doc line). `x-views` is the one deliberate exclusion, named with its reason in the suite: its parser accepts any view name, so the option set is the adopter's, not the kernel's. `x-generated` is excluded for the same kind of reason (machine-written state, tolerant parse).
- [x] A deliberate escape hatch: the inline marker `undocumented-by-design` on a parse branch in `lib/src/convention.ts` exempts exactly that key; convention.md §Tracker hygiene documents the marker (added below) and the suite fails if the doc ever stops documenting it. The premise test proves the marker discriminates (same option marked vs unmarked over synthetic branches).
- [x] `npx prettier --check` clean for both changed files (`cli/src/convention-option-doc-contract.test.ts`, `ArggonManager/docs/convention.md`); `arggon validate` green (ok, 0 errors, 0 warnings); `npm test` green (137 files, 2945 passed, after `npm run build` in the worktree — the one pre-fix failure was `headless-ci.test.ts` demanding the prebuilt `dist/`, a worktree gap, not the change). Repo-wide `prettier --check .` reports the same 648 pre-existing warnings before and after this change; the §Tracker hygiene clauses touched here are all prettier-clean.
- [x] The test reads the doc and the source, not a copy of either: the kernel's `lib/src/convention.ts` text (type members, parser branches, boolean-validations), the runtime `parseConventionConfig("")` projection, and convention.md's own enumeration and parse-error sentences. The only literals are the section↔type↔projection table (structure, no option names) and the marker string. Negative control run twice: a synthetic new boolean option in all three kernel faces failed exactly the two doc rules (the PR #637 shape), and went green again once its branch carried the marker; both edits were then reverted.

## Notes

### 2026-10-04 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

Found while reviewing PR #637 (`task-role-model-report-only-detector`), raised by the
worker and confirmed by me: the `x-tracker` option list in
`ArggonManager/docs/convention.md` §Tracker hygiene is **prose with no structural guard**.
`cli/src/convention.test.ts` and its siblings assert _parsing behaviour_; nothing asserts
that the documented option list matches the keys `TrackerConfig` actually reads.

The consequence is not hypothetical: `x-tracker.product-acceptance` was implemented and
merged with its option **undocumented** — the flag existed in `lib/src/convention.ts`
while `convention.md` still listed only `auto-commit`, `allow-steal`, `strict-gate-bins`
and `strict-worktree-writes`. The PR's CI was green throughout, including the seam-drift
and docs gates. It was caught by a worker's escalation, not by a test.

That is the same class as the ADR-index drift (`adr-index-parity.test.ts`), which exists
because the index silently rotted three times.

## Acceptance

- [ ] A test derives the official `x-tracker` option list from the type/parser (the single source) and asserts `docs/convention.md` §Tracker hygiene names every key — a new option cannot be added without a doc line
- [ ] The guard covers the **parse-error sentence** too: the keys it enumerates as boolean-only are exactly the boolean keys, so a boolean option cannot ship outside that list
- [ ] The same treatment for the namespaced extensions documented alongside it (`x-views`, `x-playbooks`, `x-import`, `x-worktree`) if the derivation is cheap; if not, say so in the item rather than half-doing it
- [ ] A deliberate escape hatch: an inline marker or an explicit allow-list, documented, so a genuinely undocumented-by-design option is possible and visible in review
- [ ] `npx prettier --check` clean; `arggon validate` + `npm test` green
- [ ] The test reads the doc and the source, not a copy of either — a guard that restates the list in the test is the same bug one level down

### 2026-10-11 @ses_ed596d14bffevSx3fVtpoz6NsL
## Delivery evidence (arggon-maker)

Change on branch fix/bug-x-tracker-option-list-has-no-doc-drift-guard (3 commits, pushed):

- `cli/src/convention-option-doc-contract.test.ts` (new, 18 assertions): the guard. Every list is DERIVED, never restated — `lib/src/convention.ts` text (exported config type members, the parser's own `key === "…"` branches, the `must be a boolean` validations), the runtime `parseConventionConfig("")` projection, and convention.md's own enumeration / parse-error sentences. Only literals: the section↔type↔projection table (structure, no option names) and the marker string.
  - Rule 1 — one source, three faces agree (type members = parser read-keys = runtime default keys; type `boolean` members = parser boolean-validated options).
  - Rule 2 — kernel→doc: every option the parser reads is named in the doc's "official options" sentence (the PR #637 shape), plus the reverse direction over hyphenated names only (deliberate narrowing, documented in the file header: the enumeration's trailing gloss legitimately backticks non-option words, e.g. x-github's "flipped to `done`").
  - Rule 3 — the parse-error sentence is exact, BOTH directions, over the "or an `k` … value that is not `true`/`false`" window.
  - Escape hatch: `undocumented-by-design` on a parse branch exempts exactly that key; a premise test proves the marker discriminates (same option marked vs unmarked over synthetic branches). A test fails if convention.md stops documenting the marker.
  - Coverage: `x-tracker`, `x-playbooks`, `x-import`, `x-worktree`, `x-github`. `x-views` + `x-generated` are the two exclusions, named with reasons in the suite; a new documented `x-*` section must join the table or fail the section test.
- `ArggonManager/docs/convention.md` (3 minimal clause edits, carrier otherwise untouched):
  - §Tracker hygiene: new bullet documenting the `undocumented-by-design` escape hatch.
  - §Worktree bootstrap: parse-error sentence now enumerates `env` as boolean-only (the guard found this real gap — `x-worktree.env` is boolean-validated but its sentence enumerated neither boolean option).
  - §Issue round-trip: same completion for `issue-roundtrip` (not in the delivery lead's four; identical shape, one line, so the guard is uniform instead of one section down).

Gates (run in the worktree):
- `npx prettier --check` on both changed files + the item file: all use Prettier code style. Repo-wide `prettier --check .` reports 648 pre-existing warnings — byte-identical count before and after this change (verified by stashing), so this diff introduces none.
- `arggon validate`: ok, 0 errors, 0 warnings (also run by the repo pre-commit hook on each of my 3 commits).
- `npx vitest run cli/src/convention-option-doc-contract.test.ts`: 18/18 pass. Before the doc edits it failed on exactly the three real gaps (x-worktree env, x-github issue-roundtrip, undocumented hatch) — then the edits closed them.
- `npm test` (full, after `npm run build` in the worktree): 137 files / 2945 tests passed, 0 failed. Without the build, `headless-ci.test.ts` fails on the missing prebuilt `dist/` — a worktree gap, not the change; the build also kept the pinned plugin bundle byte-identical.

Negative controls (both reverted; `lib/src/convention.ts` is unmodified in the final diff):
1. New boolean option in all three kernel faces, undocumented → failed exactly rule 2 and rule 3 with actionable messages ("`x-tracker.future-option` is read by the parser but not named … the PR #637 shape"). One-face-only → rule 1 caught it ("the runtime default object vs TrackerConfig's members").
2. Same branch carrying `undocumented-by-design` → 18/18 green again.

Scope boundary: `templates/docs/**` untouched (the adopter template's abbreviated `x-tracker` row names only `auto-commit`/`allow-steal`, but that file defers to this repo's convention.md as the normative reference and is another item's scope). README.md's bug-note enumeration of the x-tracker flags is not pinned — dated bug notes describe what was true when written. Deliverable covers the delivery lead's four extensions; x-github included as noted; x-views/x-generated exclusions stated above per item rule "if not, say so".

### handoff 2026-10-11 @ses_ed596d14bffevSx3fVtpoz6NsL (session: ses_ed596d14bffevSx3fVtpoz6NsL) — next: Delivery lead reviews and merges the branch; the maker's work is complete (acceptance boxes ticked, gates green, negative controls reverted).
- branch: fix/bug-x-tracker-option-list-has-no-doc-drift-guard
- open questions: 1) Templates: templates/docs/docs/convention.md §Namespaced extensions row still names only auto-commit/allow-steal (defers to this repo as normative, so not a guard target) — adopt the guard there o…

### 2026-10-11 @ses_ed4c5d320ffeScEzxxks3AMgTV

verdict: approve (drift guard + 3 doc clauses)

## What I read

- `git -C /home/arggon/Projects/ArggonManager-bug-x-tracker-option-list-has-no-doc-drift-guard diff main...HEAD` (3 non-tracker files: the new 397-line test, 3 clause edits to `ArggonManager/docs/convention.md`, plus the item file).
- The kernel: `lib/src/convention.ts` — `TrackerConfig`/`PlaybooksConfig`/`ImportConfig`/`WorktreeConfig`/`GitHubConfig` declarations (L48-180), the runtime default objects (L341-363), and every `if (section === "x-…")` parse block (L429-680).
- `ArggonManager/docs/convention.md` §Saved views / §Technology playbooks / §Tracker hygiene / §Import type mapping / §Worktree bootstrap / §Issue round-trip / §Generated-doc provenance (L506-660).
- `templates/docs/docs/convention.md:71` (the adopter template's "full normative reference lives in the ArggonManager repository" deferral).

## What I checked, expected vs observed

**(a) Derives from the kernel and the doc, restates nothing.** Expected: option names come from the kernel, never from a list in the test. Observed: `readKernelSections` walks the kernel text for `key [!=]== "…"` branches under each `if (section === "x-…")` dispatch; `typeMembers` reads the exported type declaration; `documentedOptions` slices the doc's own "the official options today are …" sentence; `documentedBooleans` slices the doc's own `or an \`k\` … value that is not \`true\`/\`false\`` window. The only literals are the `SECTIONS` table (section key ↔ kernel type ↔ projection — structure, no option names), `UNGUARDED_SECTIONS` and the marker string. I traced all 18 assertions by hand:

| Section       | type members | parser read-keys                                                                                               | default-object keys |
| ------------- | ------------ | -------------------------------------------------------------------------------------------------------------- | ------------------- |
| `x-tracker`   | 6            | 6 (allow-steal, strict-gate-bins, strict-worktree-writes, product-acceptance, reap-acked-orphans, auto-commit) | 6                   |
| `x-playbooks` | 1            | 1                                                                                                              | 1                   |
| `x-import`    | 1            | 1                                                                                                              | 1                   |
| `x-worktree`  | 4            | 4                                                                                                              | 4                   |
| `x-github`    | 1            | 1                                                                                                              | 1                   |

All three faces agree on every section, and `typeMembers`' boolean members = the parser's `'…' must be a boolean` validations on every section. Rule 1 is real, not decorative.

**(b) The boolean window, both directions.** Expected: a boolean option outside the doc sentence fails, and a doc-named non-boolean fails. Observed: `BOOLEAN_WINDOW` is anchored on the doc's own wording, and the assertion is `toEqual` over the exact set — both directions. I confirmed the two real gaps the maker claims the guard found: before the edit, §Worktree bootstrap's parse-error sentence carried no boolean window at all while the kernel validates `env` as boolean ([`lib/src/convention.ts:592`], "\`'env' must be a boolean\`"), and §Issue round-trip likewise for `issue-roundtrip`. Both would have failed. The completions are the minimal correct fix, not a decoration.

**(c) The escape hatch is real, documented and discriminating.** Expected: a marker that cannot silently exempt a new option. Observed: `undocumented-by-design` appears nowhere in `lib/src/convention.ts` today (grep: 0 hits outside the test), so no option is currently laundered. The doc's new §Tracker hygiene bullet names the marker, the test file, and that documenting is the default. The premise test builds synthetic branches — `documented-option` unmarked, `legacy-alias` carrying the marker, `typed-option` boolean-validated and unmarked — and asserts `exempt` is true for exactly the marked one. I traced the walk: it fails if the marker were ignored, and fails if it were applied to the whole block rather than the one line. Discrimination confirmed by reading.

**(d) `x-views` / `x-generated` exclusions.** Expected: honest, not a hole. Observed: honest. `x-views`'s parser reads `views[key] = expr` over an open vocabulary — there is genuinely no kernel-owned option list to derive, and the guard's own section test forces any new `### … (\`x-name\`)` section to join `SECTIONS` **or** `UNGUARDED_SECTIONS` with a reason, so the exclusion table cannot rot into a silent widening. `x-generated` does have a fixed key set (`projectName`, `template`, `checksum`, `arggonVersion`, `generatedAt`, `acknowledged`) but it is machine-written state with no adopter-facing enumeration sentence in the doc, so there is nothing to derive against; the exclusion is a defensible judgment call and it is named rather than implied.

**(e) `x-github` widening.** Expected: justified or creep. Observed: justified. The acceptance row asked for the four named namespaces "if the derivation is cheap; if not, say so in the item". The derivation was cheap and uniform, the maker said so in the item, and `x-github` has the identical shape to `x-worktree` — leaving it a known hole one clause down is precisely the PR #637 failure mode this item exists to close. Cost: one doc line. `templates/docs/**` is correctly untouched (`templates/docs/docs/convention.md:71` defers to this repo as normative), and the README bug-note is not pinned, both with reasons stated.

## Findings (none blocking)

1. `boundAdmissionStamp` — see the reverse-direction note: `expected` is filtered by `exempt` but `documented` is not, so a doc parse-error sentence naming a _marked_ boolean option fails with a message that reads as a kernel mismatch. Fail-loud, so acceptable; worth a one-line comment.
2. The `undocumented-by-design` marker is **line**-scoped (`line.includes(marker)`), not branch-scoped: a marker placed on the `throw` line below the `if (key === "…")` line silently does not apply. It fails the doc rule afterwards, so it is not a silent disarm, but the doc says "carries the marker on its parse branch" without saying the branch's _first_ line.
3. `readKernelSections` keys sections by name and `sections.set` overwrites; a future duplicate dispatch for one section would drop the first block's keys. The "one branch per option" assertion makes that fail rather than pass silently.

## What remains unverified

Execution. I ran nothing: no `vitest`, no `prettier --check`, no `npm run build`. The claims I could not check by reading are the gate results (18/18, 2945 tests, prettier clean on both files, `arggon validate` ok) and the maker's reverted negative controls. Everything above is from reading the diff, the kernel and the doc.

## Probes needed

1. `cd /home/arggon/Projects/ArggonManager-bug-x-tracker-option-list-has-no-doc-drift-guard && npx vitest run cli/src/convention-option-doc-contract.test.ts` — demonstrates the 18 assertions actually pass on this tree. If it fails, my hand-trace of the derivations is wrong somewhere and the derivation claim (a) falls.
2. Same cwd: `npx vitest run cli/src/convention-option-doc-contract.test.ts` with `git stash` of the `ArggonManager/docs/convention.md` hunk restored (i.e. run the test against the pre-edit doc) — demonstrates the two doc completions were load-bearing, not cosmetic. If the test passes without the doc edits, the guard does not actually govern the parse-error sentence.
3. `cd /home/arggon/Projects/ArggonManager-bug-x-tracker-option-list-has-no-doc-drift-guard && git diff --exit-code -- lib/src/convention.ts && npx prettier --check cli/src/convention-option-doc-contract.test.ts ArggonManager/docs/convention.md` — demonstrates the escape hatch is unused in the shipped kernel and both touched files are prettier-clean.

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-13 (delivery lead)
Merged as 7015730b (PR #759); auto-done flip #768. Verifier probes on the merged head (34000e79):
- `npx vitest run cli/src/convention-option-doc-contract.test.ts` — 18/18 passed (exit 0)
- `git diff --exit-code -- lib/src/convention.ts` — exit 0, the escape hatch is unused in the shipped kernel
- `npx prettier --check` on the two touched files — clean
The merged head also carries the lead's live-Context transcription (PLACEHOLDER_BODY gate).
Follow-ups filed: task-convention-drift-guard-clarifications (marker line-scoping, mismatch message, duplicate-dispatch hazard); bug-retired-agent-ids-in-doc-samples (the sibling shipped-sample class).
