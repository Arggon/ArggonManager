---
type: bug
status: done
id: bug-done-gate-counts-checkboxes-inside-comment-blocks
title: "The done gate counts `- [ ]` anywhere in an item body, so a reporter comment that quotes its acceptance verbatim makes the item impossible to complete"
assignee: arggon-delivery-lead
branch: fix/bug-done-gate-counts-checkboxes-inside-comment-blocks
parent: methodology-improvements
labels: [done-gate, tracker-schema, tests]
created: "2026-10-05"
updated: "2026-10-06"
worktree_path: /home/arggon/Projects/ArggonManager-bug-done-gate-counts-checkboxes-inside-comment-blocks
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-done-gate-counts-checkboxes-inside-comment-blocks.md
  Leaves live only under a story. id is the filename stem: bug-done-gate-counts-checkboxes-inside-comment-blocks.
  CLI `arggon create bug done-gate-counts-checkboxes-inside-comment-blocks` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The done gate counts `- [ ]` anywhere in an item body, so a reporter comment that quotes its acceptance verbatim makes the item impossible to complete

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [x] A ticked live `## Acceptance` section plus unticked boxes inside a dated `## Notes` block flips `done` **without a waiver** — the defect. Verified by the real flip of `bug-validate-does-not-check-frontmatter-present` (5 comment-only boxes, `10bb6060`) and `bug-engineering-doc-stale-adr-statuses` (`d9b3f4bb`), both of which the pre-fix gate refused
- [x] An unticked criterion in the **live** section is still refused, so the gate was narrowed rather than gutted. Mutation-verified: reverting the scoping fails 237 assertions
- [x] **No live criterion at all is refused** with a distinct `no-live-contract` reason, even when every box in the comment record is ticked — otherwise a fresh `arggon create` scaffold is the _default_ flippable item and an item with no contract gets a free pass
- [x] A bare `- [ ]` carrying no text stays a scaffold, not a criterion (`convention.md:300`), and a section of bare boxes refuses for _no contract_ rather than for an unfinished criterion. Pinned by a mutation that fails 33 assertions
- [x] The **auto-done workflow's classifier recognises both refusal reasons**. `.github/workflows/auto-done.yml` grepped `"unchecked boxes"`, so ADR 0025's new `no-live-contract` refusals annotated as "update failed unexpectedly" — backwards, and untested. Now classified by `error.code === "UPDATE_FAILED"` plus the gate's shared `cannot mark '` prefix (`cli/auto-done-refusal.mjs`), so a third reason classifies without a code change
- [x] The classifier is verified against **verbatim kernel strings**, not pasted ones: both gate messages (`lib/src/update.ts:572`, `:576`) classify `expected`, and `id '…' not found under the tracker`, `parent '…' not found`, and `cannot transition status blocked -> todo` all classify `unexpected` — the prefix occurs in exactly two places in the kernel, both the gate
- [x] The refusal classifier has its own test, built from the **real kernel** via `updateOperation` rather than pasted messages, plus an assertion on the wiring (2 call sites, 1 definition, no inline message match)
- [x] ADR 0025 amends 0015, is indexed, and its row's status class agrees with the ADR file. Its Context carries the **measured** split with definitions attached — 5 unblocked / 56 relabelled / 56 unchanged, 7 open leaves newly refused, 40 relabelled, 3 unblocked — not the inverted "61 already satisfied", and not the review's 61 either. Both prior figures were wrong in the direction that flattered the change
- [x] The container-cascade deferral is recorded in the carrier per `docs/engineering.md` §Definition of done 6, with the live instance named (`story-ci-wall-clock`, `liveCriteria=0`, `wholeUnchecked=5`), as `task-cascade-whole-body-acceptance-defers-this-defect` — not only in a PR comment
- [x] `acceptanceComplete` keeps its whole-body meaning for renderers and cascade; only its doc comment changed, and `update.ts:1073` still uses it. No silent semantic flip under the new readers
- [x] Gates green on the merged result: full `npm run build`, `npm run test` **132 files / 2803 tests**, `arggon validate` ok (0 warnings, v5), `npm run check:plugin` green, lint and prettier clean, generated bundle byte-unchanged

This section was the template placeholder while the work landed — the rule this item ships
refuses exactly that, so the contract is recorded here after the merge, with the evidence in
`## Notes` and the review verdicts beneath it.

## Notes

### 2026-10-06 @arggon-maker

## Gate evidence — the live `## Acceptance` section, and the no-contract refusal

**Rule implemented for "no live criteria" (the decision the brief left open): zero criteria in the live section, and nothing else.** Not "absent", not "empty after trim", not "template-placeholder" as three separate checks — one predicate, `liveAcceptanceCriteria(liveSection).length === 0`, so absent / empty / whitespace-only / `<!-- … -->` placeholder / bare-`- [ ]`-only all reduce to the same refusal. It is the only reading that cannot be satisfied by accident: each of the three plausible definitions has a fourth spelling beside it (a renamed `## Acceptance mapping`; a section holding only `\u00a0`; a section holding only bare boxes), and any of them becomes a free pass. Two further reasons it is the right one, both measured on this tree: a fresh `arggon create` scaffold (the placeholder comment) would otherwise be the _default_ flippable item, and 40 open items in this tracker have their real criteria ticked in dated comments — exactly the vacuous-success shape.

**Why "the live body is the contract" rather than "the newest comment is the contract":** there is no timestamp a body carries that distinguishes a comment recording a _past_ obligation from one reporting a _new_ one. `### <date> @author` is append-only history by format, so the block is history; a comment-supplied `## Acceptance` cannot stand in for a missing live section (tested).

**Where the scan changed:** `lib/src/items.ts` gained `liveAcceptanceRegion` / `liveAcceptanceRows` / `liveAcceptanceCriteria` / `liveAcceptanceUnchecked` / `acceptanceGate` beside `acceptanceRows` (comment blocks stripped BEFORE the section is located, so a `## Acceptance` pasted inside a comment cannot become the contract). `lib/src/update.ts` (the `→ done` rule) consults `acceptanceGate`; `lib/src/import-issues.ts` asks the same predicate before offering its waiver. `acceptanceRows`/`acceptanceCriteria`/`acceptanceComplete` keep their whole-body meaning for the acceptance-aware container cascade and for renderers, so history stays visible. The verdict consumers were re-pointed so none can contradict the gate: the board drawer's `acceptance_complete` and the ZCode goal contract's `gateUnchecked` (+ its criteria rows, and a separate rendered contract for the no-contract case, because "nothing left to loop on" means opposite things for a satisfied contract and a missing one). Containers stay exempt.

### Per-test expected → observed, with mutation counts

Four mutations of `lib/src/items.ts`, each rebuilt with the FULL `npm run build` and run over `done-gate` + `goal-mode` + `acceptance-parity` (347 tests in those three files):

| mutation                                        | failing / total | defect   | control | trap     | no-criteria shapes | bare-box | comment-filed | nested `###` | live fuzz |
| ----------------------------------------------- | --------------- | -------- | ------- | -------- | ------------------ | -------- | ------------- | ------------ | --------- |
| baseline (unmutated)                            | 0 / 347         | PASS     | PASS    | PASS     | PASS               | PASS     | PASS          | PASS         | PASS      |
| **M1** pre-fix gate (whole body)                | **237** / 347   | **FAIL** | PASS    | **FAIL** | **FAIL**           | **FAIL** | **FAIL**      | **FAIL**     | **FAIL**  |
| **M2** naive scoping (no no-live-contract half) | **235** / 347   | PASS     | PASS    | **FAIL** | **FAIL**           | **FAIL** | **FAIL**      | **FAIL**     | **FAIL**  |
| **M3** bare `- [ ]` counted as a criterion      | **33** / 347    | PASS     | PASS    | PASS     | **FAIL**           | **FAIL** | PASS          | PASS         | **FAIL**  |
| **M4** comment blocks not excluded              | **9** / 347     | **FAIL** | PASS    | **FAIL** | PASS               | PASS     | PASS          | **FAIL**     | **FAIL**  |

Reading of that table, since "a test that passes with and without the fix is not evidence": the **defect** test fails only under M1 and M4 (the two mutations that restore whole-body reading); the **trap** test fails under M1, M2 and M4 — M2 is the naive-scoping false pass this fix exists to prevent; the **negative control** (unticked box in the LIVE section, all comment boxes ticked) passes under EVERY mutation, which is correct: it does not depend on the scoping decision, so it is the control, not evidence. The bare-box carve-out is pinned by M3 alone. The new `acceptance-parity` fuzz compares `acceptanceGate` against an independently written oracle over 40 000 generated bodies (901 allowed / 36 367 no-live-contract / 2 732 unchecked-live-criteria, non-vacuity asserted in all three directions) and it caught a real disagreement while being written — the ORDER of "strip comments, then find the section" — which is now pinned on both sides. The board-drawer test fails under M2 as well (checked separately: 1 / 100).

Expected → observed for the five required cases (all end-to-end through `runUpdate` on a real tracker): ticked live acceptance + unticked dated-comment boxes → pre-fix refusal, **post-flip succeeds**, no waiver recorded, comment block byte-unchanged; unticked box in the live section + fully ticked comment → **still refused** with `…live '## Acceptance' section still has unchecked boxes…`, and the same item flips the moment that one box is ticked; template placeholder + all comment boxes ticked → **still refused** with `…has no acceptance criteria…` (this is the trap); bare `- [ ]` → never in `liveAcceptanceUnchecked`, a section of bare boxes refused as `no-live-contract` and never as an unfinished box, and bare box + ticked criterion flips; negative controls: the live unticked box is caught with the comment record disagreeing, and the section ends at the next `#`/`##` heading (a criterion under `## Notes` prose is not in the contract). CRLF and U+2028/U+2029 bodies are asserted to read like LF.

### Gates (all run in this worktree)

| gate                         | expected                | observed                                                                                                                  |
| ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run build` (full)       | exit 0                  | exit 0, `build:plugin` 42 modules / 476 897 bytes                                                                         |
| `npm run test`               | pass                    | **131 files / 2784 tests passed**, exit 0                                                                                 |
| `npm run arggon -- validate` | ok                      | `arggon validate: ok (0 warning(s), convention v5)`, exit 0                                                               |
| `npm run check:plugin`       | bundle in sync          | exit 0 after the bundle was committed (it exits 1 while the regenerated bundle is uncommitted — that is the gate working) |
| `npm run lint`               | clean                   | exit 0                                                                                                                    |
| `npm run skills:sync`        | skill copies byte-equal | 7 files synced; no drift                                                                                                  |

**Blast radius, measured over the 482 claimable leaves:** pre-fix 117 refused → 5 unblocked (`bug-validate-does-not-check-frontmatter-present`, `bug-engineering-doc-stale-adr-statuses`, plus `bug-harness-config-churn`, `task-done-gate-acceptance-waiver` already `done`, and `bug-seam-drift-gate-blocks-new-generated-seam-content` `todo`) and 189 refused: 133 new `no-live-contract` (47 open, 40 of them the vacuous-success shape) + 56 `unchecked-live-criteria` (29 open). **The cost is real and is the lead's call:** acceptance criteria must now be authored into the live `## Acceptance` section, and `arggon create` still has no `--body` flag, so the first write is a hand-edit of the item file. 121 tests across 17 suites flipped red under the new half; they are arranged through the shared helper `test/acceptance.ts` (`satisfyAcceptance` / `satisfyAllAcceptance`, renamed from `tickAcceptance` because it now also PUBLISHES a live criterion when the section has none) plus three fixtures that needed the arrange call. That churn is the change's honest cost, not a side effect: every done-flip test in the tree now carries an acceptance contract.

**Both blocked items are honest.** `bug-validate-does-not-check-frontmatter-present` (5 ticked live criteria, evidence in a 2026-10-03 block) and `bug-engineering-doc-stale-adr-statuses` (4 ticked, the spec/plan-009 case explicitly decided and recorded) each read `acceptanceGate → { gated: false }` now. I did not flip either status, and did not touch their dated blocks. Note for the lead: **this item's own live `## Acceptance` section is still the template placeholder**, so it is refused as `no-live-contract` until the criteria are transcribed — I did not tick or transcribe any box, per instructions.

### handoff 2026-10-06 @arggon-maker — next: Lead: review + merge; decide whether to accept the no-live-contract half's friction (create --body as follow-up)

- branch: fix/bug-done-gate-counts-checkboxes-inside-comment-blocks
- open questions: Author criteria in the live section now required (create has no --body); container cascade deliberately left whole-body

### 2026-10-06 @Arggon

### 2026-10-06 @arggon-standards-reviewer

verdict: request-changes (two in-scope fixes: the auto-done refusal classifier and the ADR 0025 measured claim)

Read against `docs/engineering.md` §Review bar and `docs/convention.md` §Done gate, on `git diff origin/main...HEAD` (three-dot). Two findings block; everything else — the design, the consumers, the evidence, the docs, the scope, the bundle — passes, and finding 2 below actually **strengthens** the design under review.

**Q1 — the `no-live-contract` refusal is the right call, and the cost is smaller than claimed.** I looked for the third design (prefer the live section when it has criteria, else fall back to the comment record) and measured it over all 482 claimable leaves with a script against the shipped kernel: it disagrees with the shipped rule on **67 items, every one of them already `done`**, and on **zero open leaves**. So the fallback buys this tracker nothing and would only re-open the door for items whose criteria were ticked inside a dated block — exactly the vacuous-success shape. The maker is right. The dated-block-is-history premise is the repo's own carrier rule (PR #586/#619 ruling, restated in `agents.md` §0), and the gate was the last surface not honouring it.

The cost argument as briefed is wrong in a way that helps the change: the "40 open leaves newly refused because their criteria are ticked in dated comments" are **not newly refused and are not ticked**. Crosstab over the 79 open leaves, measured: pre-fix-refused → post-fix-refused = 69 (40 relabelled to `no-live-contract`, 29 to `unchecked-live-criteria`), pre-fix-allowed → post-fix-refused = **7**, pre-fix-refused → post-fix-allowed = **3**. The 7 are items with **zero criterion rows anywhere in the body** (scaffolds whose `## Acceptance` was never written) — `bug-prover-agent-has-no-x-generated-entry`, `task-mcp-doc-contract-scan-surface-widened`, `task-opencode2-doc-builtworkspaces-bound-unstated`, `task-mcp-parity-branch-fails-pr610-spawnlane`, `task-adapter-report-nits-from-review`, `task-capability-matrix-followups-from-review`, and this item. Refusing those is the rule working, not a regression. The 40 have 223 criterion rows, **all unticked** — they were already refused before the change for exactly the right reason and stay refused; only the label moved. So the honest blast-radius sentence is "7 open leaves newly refused, 40 relabelled, 3 unblocked", not "47 newly refused". That also answers the cascade sub-question in the same measurement: the deferral is coherent, but see F3.

**Q2 — no consumer contradicts the gate, and `acceptanceComplete` kept its whole-body meaning.** Read: `board.ts:822` is `!acceptanceGate(acceptanceBody(kernelItem)).gated` (list stays whole-body by design, documented in json-output.md); `goal-mode.ts:528` is `acceptanceGate(body).gated` with rows from `liveAcceptanceRows`, and the maker's self-flagged hazard landed — `deriveGoal` splits `NO_CONTRACT_OBJECTIVE` / `NO_CONTRACT_VERIFICATION` / the `checklistNote` branch off the criterion count, so a satisfied contract and a missing one no longer read alike. `acceptanceComplete`'s body is byte-unchanged (`acceptanceUnchecked(body).length === 0`); only its doc comment grew, and the cascade call site (`update.ts:1073`) still uses it. Confirmed live: 13 containers are cascade-vetoed, and `story-ci-wall-clock` is vetoed on history alone (`liveCriteria=0`, `wholeUnchecked=5`). Bare-box carve-out holds — `liveAcceptanceUnchecked` filters on `criterion`, and the tests pin bare-box-only as `no-live-contract` and bare-box-beside-ticked as a flip. `import-issues.ts:414` asks `acceptanceGate(...).gated`, so it cannot offer a waiver the gate would refuse; it now waives no-contract imports by default, which json-output.md documents.

**F1 (blocking) — `.github/workflows/auto-done.yml` no longer recognises the gate's second refusal.** Lines 90 and 181 classify a refusal with `grep -q "unchecked boxes"`. The new `no-live-contract` message (`lib/src/update.ts:572`) does not contain that substring — verified: `node -e` on the exact message returns `false` — so those refusals fall into the `else` branch and are annotated `update failed unexpectedly (output: …)`. The PR is what broke it: the diff changed the string that workflow matches on, and `agents.md:262` (edited in this PR) now promises the workflow treats a gate refusal like the skipped-todo case. No test covers the classifier (`grep "flip refused by the done gate"` → nothing), which is why it drifted. Fix: match the new message too (and update both annotations to name the live section). Expected: a no-contract refusal annotates as a gate refusal. Observed now: "failed unexpectedly".

**F2 (blocking) — ADR 0025 Context states the measured blast radius backwards.** Line 19-23: "61 leaves whose live acceptance was already satisfied were refused solely because a dated block carried the original unticked criteria". Measured over the same 482 leaves: leaves with live criteria **all ticked** yet pre-fix refused = **5** (the two `in_progress` blockers named plus 3); leaves pre-fix refused with **no live criteria at all** = **61**. Those two populations are opposites, and the new rule does not unblock the 61 — it re-labels them. Same inversion in the item comment (`40 open items … have their real criteria ticked in dated comments`: 0 of 40 have a single ticked criterion). The sentence is the ADR's argument for the change, so it has to be the true one: the scoping unblocks 5 and refuses 7 new; the `no-live-contract` half is what keeps the 61 from becoming vacuous successes. This is a doc edit, not a design change — and correcting it makes the case stronger, because the fallback measurement above shows the alternative rescues nothing.

**F3 (process) — the deferred cascade scoping is not filed.** ADR 0025 §Alternatives defers "apply the same scoping to the container cascade", and `story-ci-wall-clock` is a live instance of exactly that defect (vetoed on comment history alone, `liveCriteria=0` / `wholeUnchecked=5`). `docs/engineering.md` §Definition of done 6 requires deferred follow-ups as tracker items, not ADR prose. No such item exists in the tree. Ask: file it under `methodology-improvements` before merge.

**Non-blocking, verified good:**

- **Test discrimination.** `acceptance-parity.test.ts:641-711` asserts `acceptanceGate(body)` equals an independently written oracle over 40 000 bodies _and_ floors all three buckets (`> 500` each; observed 901 / 36 367 / 2 732), so it is not a counting-only oracle. I re-ran the same corpus shape against a deliberately wrong locate-then-strip variant: 4 714 disagreements, so the fuzz genuinely constrains the strip-then-locate ordering it was written to pin. The done-gate tests carry their negative control and their trap as separate assertions.
- **Docs/index.** ADR 0025 row exists in `adr/README.md` with status class `Proposed`, matching `- Status: Proposed`; the 0015 row's `Accepted (amended by 0025)` qualifier is within the documented class-comparison rule, and `declaredStatus()` still reads `Accepted` through the inserted blockquote. `convention.md` §Done gate, `agents.md` §5, `json-output.md` (both refusal messages verbatim), `methodology.md`, `pitfalls.md` all carry the new rule. ADR 0025 is behavioural and names the ADR 0016 upgrade channel, per §Docs.
- **Bundle.** `opencode/plugins/arggon/index.bundle.ts` is a true regeneration: `buildPluginBundle(root)` returns code byte-identical to the committed file (42 modules, 476 897 bytes). Not a hand edit.
- **Scope.** All 36 files accounted for: 4 kernel, 2 consumers, 1 bundle, 7 docs + 2 ADR, 2 skill references, 1 shared test helper, 17 test suites. Nothing unrelated rode along.

**Unverified (verifier's job, not mine):** I did not run the mutation matrix M1–M4 or the gate suite; I read the tests and re-derived the corpus counts with read-only `tsx` scripts against `lib/src`.

## Probes needed

- `npx tsx` reproduction of F1/F2 from the worktree root (already run read-only by me; re-run for the record):
  - F1: `node -e 'const m="cannot mark \x27x\x27 done: the item\x27s live \x27## Acceptance\x27 section has no acceptance criteria (…)"; console.log(m.includes("unchecked boxes"))'` → expect `false`; expected-vs-observed for the workflow annotation is then self-evident.
  - F2: over the 482 leaves, count leaves with live criteria all ticked yet `acceptanceComplete === false` (expect 5), and leaves with `liveAcceptanceCriteria === 0` yet pre-fix refused (expect 61).
- `npm run build && npx vitest run cli/src/done-gate.test.ts cli/src/goal-mode.test.ts cli/src/acceptance-parity.test.ts cli/src/board.test.ts` in the worktree — confirms the suites that carry the F1/F2 blast radius are green on the head that will merge.
- `npm run arggon -- validate` and `npm run check:plugin` — the bundle and tracker-tree claims I verified by reading/regenerating, but the gate is the verifier's.

### 2026-10-06 @Arggon

## Correction to the blast-radius numbers in my 2026-10-06 evidence comment and in ADR 0025 Context

The standards review (commit 97ce5fcf) is right that my numbers were inverted, and it is right about the direction: the rule **relabels** the no-live-criteria population, it does not unblock it, and the genuinely unblocked set is small. My evidence comment above claimed "40 open items in this tracker have their real criteria ticked in dated comments". **That is false**: measured over the same 482 claimable leaves, those 40 open leaves carry 223 criterion rows and **zero** ticked ones. They were already refused before the change, for the right reason, and only the label moved.

Re-measured from the shipped kernel (read-only `tsx` over `loadItems`, pre-fix `!acceptanceComplete(body)` vs post-fix `acceptanceGate(body).gated`):

| population (482 claimable leaves, 117 pre-fix refused) | count | effect of this change                                                         |
| ------------------------------------------------------ | ----- | ----------------------------------------------------------------------------- |
| live criteria present and ALL ticked                   | 5     | **UNBLOCKED** (2 merged `main`-green blockers + 3)                            |
| NO live criteria (absent / empty / placeholder)        | 56    | **RELABELLED** `unchecked-live-criteria` -> `no-live-contract`; still refused |
| live criteria present, some unticked                   | 56    | unchanged, same refusal reason                                                |

Open leaves only (79): pre-refused -> post-refused 69 (40 relabelled + 29 unchanged), pre-allowed -> post-refused **7**, pre-refused -> post-allowed **3**. The 7 are scaffolds with **zero criterion rows anywhere in the body** — exactly the vacuous-success shape decision 2 exists to refuse, so refusing them is the rule working, not a regression. All 56 no-live-criteria leaves carry their unticked boxes in dated comment blocks and nowhere else (checked against the kernel's own comment-block rule, not a reimplementation).

**Where the "61" came from, since both my comment and the ADR cited a number that does not exist in that shape:** the 61 is the count of leaves that were pre-fix refused **and have a live section with criteria** (5 + 56) — a population that contains both the unblocked and the unchanged, so it described neither. Corrected in [`ArggonManager/docs/adr/0025-done-gate-live-acceptance-section.md`](../../../docs/adr/0025-done-gate-live-acceptance-section.md) (Context and Consequences); the honest per-population table above replaces it. Correcting it **strengthens** the ADR: the measured fallback comparison (67 disagreements, all already `done`, zero open leaves) shows the comment-record fallback rescues nothing, so the cost of decision 2 is the visible 7 items and the labelled 40 — not a large hidden number.

Also recorded, per `docs/engineering.md` §Definition of done 6: the cascade-scoping deferral is carried by the filed item **`task-cascade-whole-body-acceptance-defers-this-defect`**, not by ADR prose. I confirmed its live instance myself: `story-ci-wall-clock` is cascade-vetoed on comment history alone (`liveCriteria=0`, `wholeUnchecked=5`). I did not file it, nor `task-create-needs-a-body-flag-to-author-a-live-contract` or `task-migrate-7-leaves-with-no-live-acceptance-contract` — all three were filed by the delivery lead.

Unchanged by this round: the gate's decision logic (`liveAcceptanceCriteria(...) === 0` as the single no-contract predicate, the bare-box carve-out, the container exemption). No status flipped, no acceptance box ticked — this item's own live `## Acceptance` is still the template placeholder and still refuses as `no-live-contract`, which is the lead's to populate after merge.

### 2026-10-06 @Arggon

## Review round 2: evidence for both blocking fixes (commit f8b7551b)

### B1 — proof the classifier now recognises BOTH refusal reasons

Mechanism: `error.code` + the gate's shared prefix, not prose. `cli/auto-done-refusal.mjs` classifies `expected` iff the envelope is `ok:false`, `error.code === "UPDATE_FAILED"`, and `error.message` contains `cannot mark '`. **Why not the code alone:** `UPDATE_FAILED` is what _every_ kernel update refusal carries (unknown id, illegal transition, refused steal, agent `--waive`), so code-only would annotate real breakage as an expected refusal. **Why not prose alone:** `error.message` is human text the kernel may reword; the prefix `cannot mark '<id>' done:` is shared by both reasons, so a THIRD reason is classified correctly with no change to the classifier — which is exactly what the message-substring list could not promise. The code is on the wire, so I used it; the prefix is the narrowest stable discriminator available on top of it.

Observed, driving the workflow's exact `classify_refusal` shell function against envelopes produced by the **real kernel** (`updateOperation` on real fixtures, not pasted strings):

| refusal reason                    | pre-fix `grep "unchecked boxes"` | pre-fix annotation           | now          | now annotation                         |
| --------------------------------- | -------------------------------- | ---------------------------- | ------------ | -------------------------------------- |
| `no-live-contract`                | **MISS**                         | "update failed unexpectedly" | `expected`   | "flip refused by the done gate"        |
| `unchecked-live-criteria`         | MATCH                            | gate refusal                 | `expected`   | "flip refused by the done gate"        |
| control: `unknown id` (same code) | MISS                             | unexpected                   | `unexpected` | "update failed unexpectedly" (correct) |

New suite `cli/auto-done-refusal.test.ts`, **19 passed**. Its central assertion: `expect(classifyUpdateRefusal(NO_CONTRACT)).toBe("expected")` — the ADR 0025 `no-live-contract` refusal, produced by the kernel, is classified expected, so it can never again annotate as unexpected.

Mutation-checked, because a test that passes with and without the fix is not evidence:

- reverting the prefix to `unchecked boxes` (the shipped bug) → **4 failed**
- dropping the `error.code` check (prose-only) → **1 failed**

Both halves are independently load-bearing. It also asserts the wiring (2 classifier call sites, 1 definition, no inline message match) — a correct classifier does not help while the workflow keeps its own grep. Both call sites fixed: the redo path had its own copy of the grep. Call sites now capture stderr too, and both annotations name the live section.

### B2 — the corrected measurement, and where "61" came from

I re-measured from the shipped kernel instead of adopting either number. Over 482 claimable leaves, 117 pre-fix refusals split **5 / 56 / 56**: 5 unblocked (live criteria all ticked), 56 with no live criteria (relabelled, still refused), 56 keeping an unticked live criterion. Open leaves: **7** newly refused, **40** relabelled, **3** unblocked — the review's crosstab and my earlier figures both reproduce exactly.

**One correction to the correction:** the no-live-criteria bucket is **56, not 61**. 61 is the count of pre-fix refusals that _have_ a live section (5 + 56) — a population containing both the unblocked and the unchanged, so it described neither. The ADR's Context and Consequences now carry the 5/56/56 split with the definitions, which is what makes decision 2's 7-item cost visible and proportionate. Also verified: the 40 relabelled open leaves carry 223 criterion rows and **0** ticked (so my earlier "their real criteria ticked in dated comments" was false), and all 56 no-live-criteria leaves keep their unticked boxes in dated comment blocks and nowhere else — checked against the kernel's own comment-block rule, not a reimplementation.

### F3 — deferral in the carrier

ADR 0025 §Alternatives now names `task-cascade-whole-body-acceptance-defers-this-defect` per `engineering.md` §Definition of done 6, and records it as live: `story-ci-wall-clock` is cascade-vetoed on comment history alone (`liveCriteria=0`, `wholeUnchecked=5`). I filed none of the three follow-ups.

### Gates (expected -> observed)

| gate                                                                     | expected                 | observed                                                              |
| ------------------------------------------------------------------------ | ------------------------ | --------------------------------------------------------------------- |
| `npm run build` (full, before any test)                                  | exit 0                   | exit 0                                                                |
| `npm run test`                                                           | pass                     | **132 files / 2803 tests passed** (was 2784; +19)                     |
| `npm run arggon -- validate`                                             | ok                       | `ok (0 warning(s), convention v5)`                                    |
| `npm run check:plugin`                                                   | exit 0, bundle unchanged | exit 0, **476897 bytes byte-unchanged** — no kernel change this round |
| `npx vitest run` done-gate + goal-mode + acceptance-parity + board + new | pass                     | **5 files / 466 passed**                                              |
| `npm run lint`                                                           | clean                    | clean (it caught one unused param in my test helper; fixed)           |
| `npx prettier --check` on all 4 touched files                            | clean                    | clean                                                                 |

Deliberately untouched: the gate's decision logic, `acceptanceComplete`, the consumers, the bundle, every status, and every acceptance box — this item's live `## Acceptance` is still the template placeholder and still refuses as `no-live-contract`.

### handoff 2026-10-06 @Arggon — next: Reviewer: re-verify B1 by running the workflow's classify_refusal against a real no-live-contract envelope (must print 'expected'); B2 is a doc edit in ADR 0025 Context/Consequences. Then lead merges.

- branch: fix/bug-done-gate-counts-checkboxes-inside-comment-blocks
- open questions: Classifier keys on UPDATE_FAILED + the gate's shared 'cannot mark' prefix, not a per-message list — is the prefix too broad a gate? No-live-criteria bucket measured 56, not the 61 in the verdict (61 …
