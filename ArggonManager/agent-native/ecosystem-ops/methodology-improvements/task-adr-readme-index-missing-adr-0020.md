---
type: task
status: done
id: task-adr-readme-index-missing-adr-0020
title: "`docs/adr/README.md` index is missing ADRs 0005–0009 and 0020 (six rows), not just 0020"
assignee: Arggon
branch: feat/task-adr-readme-index-missing-adr-0020
parent: methodology-improvements
labels: [docs, adr]
created: "2026-10-02"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-adr-readme-index-missing-adr-0020.md
  Leaves live only under a story. id is the filename stem: task-adr-readme-index-missing-adr-0020.
  CLI `arggon create task adr-readme-index-missing-adr-0020` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `docs/adr/README.md` has no row for ADR 0020 (methodology-first productization), which is Accepted on main

## Context

Found while reviewing PR #598: `ArggonManager/docs/adr/README.md` has no row for ADR 0020 (Methodology-first productization with per-agent native adapters), which is Accepted on main. The index therefore disagrees with the ADR directory.

## Acceptance

- [x] README.md lists ADR 0020 with its title and status
- [x] Every ADR file in the directory has an index row (sweep the whole dir, not just 0020)
- [x] A test asserts index/directory parity so a new ADR cannot ship unindexed

## Notes

### 2026-10-02 @ses_f02ab5836ffeOAxmisboIwWE4x

Scope corrected by the reviewer of PR #598 (2026-10-02): the index is not missing only ADR 0020. Verified against the directory — `ArggonManager/docs/adr/` holds 0001–0020 plus README.md, and README.md indexes 0001–0004 and 0010–0019 only.

Missing rows: **0005, 0006, 0007, 0008, 0009, 0020** (six). The acceptance already says "sweep the whole dir, not just 0020" and requires an index/directory parity test, so this is a widening of scope, not a new problem — filing it as ADR-0020-only would have left five ADRs unindexed and the parity test would have failed anyway.


### 2026-10-02 @ses_f00f1670fffeKhTBf15mLOa4ks

Worker implementation notes.

**Statuses read from the files, not assumed.** The dispatch brief predicted
"several are `Proposed` rather than `Accepted`". Verified against every
`Status:` line: all six are `Accepted` (0008 and 0009 carry
`Accepted (2026-09-16 — adopted explicitly by product decision; …)` /
`(2026-09-17 — …)`; the index records the trimmed house form
`Accepted (adopted by product decision)`). The only `Proposed` ADR in the
directory is 0019, which was already indexed correctly. No row was written from
the brief's guess.

**Pre-existing index drift fixed in passing (3 rows).** `c0cdd60b` ("accept
ADRs 0002/0003/0004 retroactively", task-adr-status-housekeeping) edited the
three ADR files to `Accepted` and left the index claiming `Proposed`. The
files are authoritative, so the index was corrected: 0002 →
`Accepted (shipped as prototype)`, 0003 → `Accepted`, 0004 → `Accepted`. This
was required for the parity test's status rule to go green and is the same
file the item already owns.

**Drift found but NOT fixed (out of this item's scope — reported instead).**

- `ArggonManager/docs/engineering.md:230` still advertises ADR 0003 as
  "milestone field (Proposed)", stale since `c0cdd60b`.
- `ArggonManager/docs/specs/spec-opencode2-009.md:87` ("ADR 0010 Proposed")
  and `ArggonManager/docs/plans/plan-opencode2-009.md:24` ("ADR 0010
  (Proposed)") describe a historical merge gate, but ADR 0010 is now
  `Partially superseded by 0011`. Likely correct as history — a reviewer should
  confirm before touching.

**Deliberate non-assertion.** The parity test asserts membership, numbering,
row order and status _class_, but not the title cell: index titles are
editorial summaries, not copies of the headings (0018 adds
"(release pipeline, update channel, skew, tarballs)" to a bare H1; 0002/0003
are abbreviated). Asserting them would pin a convention the corpus does not
follow.

### 2026-10-03 @ses_f00f1670fffeKhTBf15mLOa4ks
PR #602 — https://github.com/Arggon/ArggonManager/pull/602

**Parity test: before/after.** `cli/src/adr-index-parity.test.ts` (new, 7 cases). The README was mutated three ways against the real corpus and restored after each; every mutation is caught:

```
BEFORE (drop the 0020 row — the reported bug)
  x indexes every ADR file exactly once (no ADR ships unindexed)
  + "0020-methodology-first-productization.md: 0 index row(s), expected exactly 1"

BEFORE (restore 0002 to the pre-c0cdd60b status)
  x mirrors each ADR's own status, qualifiers aside
  + "0002-board-viewer-v0.md: index says \"Proposed (shipped as prototype)\" (Proposed), file says \"Accepted\" (Accepted)"

BEFORE (row for an ADR that does not exist)
  x has no row pointing at a file the directory does not contain
  + "0021 -> ./0021-does-not-exist.md: no such file in docs/adr/"

AFTER
  Test Files  1 passed (1)
  Tests       7 passed (7)
```

The third mutation found a defect in my own first draft: a dangling row made two extra tests throw a raw ENOENT instead of failing cleanly. Fixed by filtering unresolvable rows out of the per-row checks (the dangling-row case is already diagnosed by its own test) and re-verified above.

**Statuses read from the files, not assumed.** The brief predicted "several are Proposed rather than Accepted"; verified against every `Status:` line, all six missing ADRs are `Accepted` (0008/0009 are `Accepted (2026-09-1x — adopted explicitly by product decision; …)`, indexed in the house's trimmed form `Accepted (adopted by product decision)`). 0019 is the only Proposed ADR and was already indexed correctly.

**Pre-existing drift corrected (3 rows, same file).** `c0cdd60b` accepted ADRs 0002/0003/0004 in the files but left the index claiming `Proposed`; the files are authoritative, so the index was corrected. Required for the status rule to pass.

**Gates.** `npm test` → 119 files / 2195 tests passed. `npm run build` ok with a byte-identical regenerated `opencode/plugins/arggon/index.bundle.ts`. `npm run lint` ok, `tsc -p tsconfig.json --noEmit` ok, `arggon validate` ok (0 warnings), `arggon spec validate` ok (32 docs), prettier clean on both files. Smoke exempt (docs + one test).

One environment gotcha worth knowing: a fresh worktree fails `headless-ci.test.ts` with "run `npm run build` first" until build artifacts exist — unrelated to this change, but it will fail the next agent who runs `npm test` before `npm run build`.

**Drift reported, not fixed (out of scope).** `docs/engineering.md:230` still calls ADR 0003 "Proposed" (stale since `c0cdd60b`); `specs/spec-opencode2-009.md:87` and `plans/plan-opencode2-009.md:24` call ADR 0010 Proposed, which is now Partially superseded by 0011 (probably correct as history — needs a reviewer's call).

Not flipping to done; leaving that to the coordinator.

### handoff 2026-10-03 @ses_f00f1670fffeKhTBf15mLOa4ks (session: ses_f00f1670fffeKhTBf15mLOa4ks) — next: Review and merge PR #602 (six index rows + adr-index-parity.test.ts); all gates green
- branch: feat/task-adr-readme-index-missing-adr-0020
- open questions: Should docs/engineering.md:230 ADR 0003 'Proposed' be corrected (stale since c0cdd60b)? Out of this item's scope

### 2026-10-03 @ses_f00dc2b15ffeoZxl09JJcV24Ye
verdict: approve (docs + one new test file; smoke exempt under engineering.md §Smoke — `docs-only PRs are exempt`)

Read-only review. No gate re-run, no file edited. Worktree read at `/Projects/ArggonManager-task-adr-readme-index-missing-adr-0020`, PR head `80c4e565` vs base `af9ca0f4`. CI: `cli`, `tasks-validate`, `ui-smoke` all SUCCESS. Claim was via `arggon start` (frontmatter records branch + worktree_path + claimed_at, and that worktree exists) — compliant with AGENTS.md.

## 1. Does the parity test actually prevent an unindexed ADR? Yes — all 7 cases have teeth

Mutation each case would catch, traced by reading (not executed):

| case | mutation it catches |
| --- | --- |
| `indexes every ADR file exactly once` (L147) | a new ADR shipping unindexed → `0021-….md: 0 index row(s), expected exactly 1`; a duplicated row → `2 index row(s)`; the whole table deleted → every file listed; an emptied directory → the `files.length > 0` vacuity guard (L149) |
| `has no row pointing at a file the directory does not contain` (L164) | the reverse direction: a row for a deleted/renamed ADR |
| `uses NNNN-short-title.md …` (L171) | a non-conforming filename; a gap/duplicate/renumbered corpus (position vs `String(at+1).padStart(4,"0")`); 3-digit numbers |
| `agrees with each ADR on its own number` (L193) | a row relabelled `0099` while linking `0005-…`; an ADR whose own `# NNNN` heading drifted from its filename |
| `mirrors each ADR's own status, qualifiers aside` (L210) | exactly the `c0cdd60b` class (index `Proposed (shipped as prototype)` vs file `Accepted`); and it fails explicitly on **either** side when a status is outside `STATUS_CLASSES` (L125), so the vocabulary cannot rot into a silent pass |
| `keeps rows in ascending ADR number` (L231) | a new row appended at the bottom of the table |
| `gives every row a title` (L236) | an empty title cell (content deliberately not asserted — see §2) |

Two properties I verified by reading rather than trusting the doc comment:

- The class match is **precedence-ordered longest-first** (L125-131), so `Partially superseded by 0011` is not read as `Superseded`, and ADR 0010's markdown-link status line reduces to the same class as the index's trimmed text. The flip that actually matters — index `Proposed`, file `Accepted` — cannot slip through, and neither can a status outside the vocabulary.
- The suite runs in the CI `cli` job (`npm run test`; `cli/**/*.test.ts` in `vitest.config.ts`). So the next agent who adds `0021-*.md` and forgets the row gets a **red lane naming the file**, not a silent drift. That is what makes "a new ADR cannot ship unindexed" true rather than aspirational, and it is why the index drift stops being a human-sweep problem.

## 2. The deliberate non-assertion on titles: correctly scoped out — with one honest caveat

I agree with the call. The three cited examples check out in the corpus: 0018's H1 is bare `Update delivery and distribution channel` and the index appends `(release pipeline, update channel, skew, tarballs)`; 0002's H1 is `Board viewer v0` and the index adds `(static + serve)`; 0003's H1 is `Milestone field for convention v3` while the index says `Milestone field (folded into v3)` — a rewrite, not an abbreviation. Asserting equality would pin a convention three rows do not follow, and a title assertion is not what the item's acceptance asks for. The asymmetry the worker gives is the right one: a misreported *status* misleads a reader who does not open the link; a weak title costs one click.

Caveat worth stating plainly, non-blocking: the corpus is **17/20 verbatim H1 copies**, so "the corpus does not follow" is true of three rows, not of the corpus — and the residual hole is real: a row could carry another ADR's title and stay green. If the coordinator wants that closed later, the cheap version is either normalizing 0002/0003/0018 and asserting equality, or asserting containment of the H1's leading phrase. Not worth holding this PR for it; the rationale is documented in the test header, which is the right place for it.

Also noted: `readRows()` (and the `expect` inside it) runs at `describe`-collection time (L140), so an unparsable row surfaces as a collection error for the whole file rather than a named test failure. The message survives intact, so this is readability only.

## 3. The six added rows are factually right — the worker's correction of my brief holds

Read every `Status:` line and every H1 in `ArggonManager/docs/adr/`:

- 0005, 0006, 0007, 0020 → `- Status: Accepted`. All four index rows say `Accepted`. Class agrees; titles are verbatim H1.
- 0008 → `Accepted (2026-09-16 — adopted explicitly by product decision; decision record below)`; 0009 → `Accepted (2026-09-17 — adopted explicitly by product decision; exploration priority-model-008)`. Both indexed as `Accepted (adopted by product decision)`.

So my "several are Proposed" prediction was wrong and the worker was right to read the files instead of writing rows from the brief. The trimming is not misleading: class preserved verbatim, the "adopted by product decision" substance preserved, only the date and the adverb `explicitly` dropped — consistent with the index's existing house form (`0002 Accepted (shipped as prototype)`), which has no date column. 0019 is the only `Proposed` ADR and was already indexed correctly.

One pre-existing note (not this PR's row, not asserted by the test): the 0010 cell says `Partially superseded by 0011` and drops the file's `…; layout superseded by [ADR 0012]`. Mild qualifier loss on a row nobody touched — flagging for the follow-up sweep, not here.

## 4. The scope widening to 0002/0003/0004: in scope, correctly argued, already disclosed

Right call. Three reasons, all verified:

- The index is its own file, and the item's acceptance is a **status-parity** rule over that file; the rule provably cannot pass while the index claims `Proposed`. The fix had to land somewhere, and the alternative (loosening the new test to tolerate the stale rows) would have gutted the deliverable.
- The files are authoritative by `docs/engineering.md` §ADR process: "Accepted when merged (or explicitly recorded) → Superseded by a later ADR, never silently rewritten". `c0cdd60b` recorded the acceptance in the files; the index was the surface that missed it.
- It is the same file this item already owns, so the diff stays on one surface.

No separate PR-body note is needed: the disclosure requirement is already met — the PR body's "What changed" bullet names the three corrected statuses and says why ("required for the status rule to pass, and the same file this item already owns"), and the item notes carry the `c0cdd60b` provenance.

## 5. The two reported drifts: filing instead of fixing was correct scope, and the filed item captures the judgment

`docs/engineering.md` is a methodology carrier and the spec/plan case is a judgment call, not a blind edit — neither belongs in a docs-index PR. `bug-engineering-doc-stale-adr-statuses` exists (`story-spec-pipeline`, todo) and its acceptance captures the call rather than assuming it:

- fix `engineering.md`'s ADR-status list (not just line 230 — I confirmed L230 still reads "milestone field (Proposed)"; ADR 0003's file says `Accepted` since `c0cdd60b`, so that one is genuinely stale, not history);
- **decide** the spec/plan 009 case explicitly, "either the dated record is correct as history … or the statements are current-tense claims";
- sweep the docs tree for ADR status claims; state the "update every surface" rule in the ADR process section.

That framing is better than I would have written it, and one detail supports it: ADR 0010's file **never flipped to Accepted** — it went `Proposed` → `Partially superseded by 0011`. So `spec-opencode2-009.md:87` ("W0 foundation: ADR 0010 Proposed") and `plan-opencode2-009.md:24` ("ADR 0010 (Proposed)") were accurate as written and record a merge gate that did happen. That is exactly the "dated record may be CORRECT" case the item refuses to auto-fix. Filed, not fixed — right.

## 6. Mutation evidence: the ENOENT fix is real, and the shipped failures read cleanly

I re-derived all three mutations against the shipped code; the quoted messages are byte-accurate reconstructions, not paraphrase:

- drop the 0020 row → L156 prints `0020-methodology-first-productization.md: 0 index row(s), expected exactly 1`;
- restore 0002 to the pre-`c0cdd60b` status → L224 prints exactly `0002-board-viewer-v0.md: index says "Proposed (shipped as prototype)" (Proposed), file says "Accepted" (Accepted)`;
- add a 0021 dangling row → L167 prints `0021 → ./0021-does-not-exist.md: no such file in docs/adr/`.

The fix is the `resolvable` filter (L142-145): unresolvable rows are excluded from the two per-row loops, so no loop reaches `readFileSync` on a missing file; the case is diagnosed by its own test. Residual secondary failure on that mutation is `expect(rows.length).toBe(files.length)` (21 vs 20) — coarse, but readable, and it points at the same row. So the tests now fail with readable messages rather than throwing ENOENT.

## Non-blocking nits (none of these should hold the merge)

1. `readRows()` asserts at collection time (see §2) — consider a plain Error or a `beforeAll` so a parse failure names a case.
2. `STATUS_CLASSES` precedence means a future compound `Accepted (partially superseded by NNNN)` would classify as Partially superseded and demand the same leading class from the index — a latent false positive, not present today (0010 leads with supersession). Worth a word in the vocabulary comment when it next grows.
3. `indexed` is built as `rows.map(row => rows.filter(...))` (L151-153) — O(n²) over rows, n=20. `engineering.md` §Scalability asks to declare complexity where inputs grow with the corpus; trivial at this size, but a Map/counter would make it O(n) and the declaration free.
4. CI never runs prettier (confirmed: no prettier step in any workflow), so "prettier clean" is review-time-only evidence.

## Bar items checked and cleared

- **Methodology impact class** — not owed, and I checked rather than assumed: `docs/agents.md` §462 scopes the impact class to the four carriers (`docs/agents.md`, `docs/engineering.md`, `docs/convention.md`, `skills/arggon-cli/**`). This PR touches `docs/adr/README.md` plus a repo self-check test; no carrier is touched, so no impact statement is required.
- **Adopter trees** — `templates/` scaffolds no `docs/adr/README.md` (`/arggon-adr` writes ADR files only), so there is no adopter-side index to drift; the product-repo scope of the parity test is complete for what exists.
- **Test posture precedent** — same shape as `cli/src/prose-format.test.ts`: a doc contract over the tracked markdown, not a fixture test. CI green is necessary; the mutation evidence above is what makes it sufficient.

## Probes needed

I did not execute any of these (reviewer role; no gate re-runs). Hand to `arggon-prover` in the named worktree `/Projects/ArggonManager-task-adr-readme-index-missing-adr-0020` (cwd for all three).

1. `npx vitest run cli/src/adr-index-parity.test.ts` — demonstrates the new file collects cleanly and 7/7 pass on the shipped corpus (the baseline the mutation probes perturb). A collection error instead of a pass would mean the collection-time expect in `readRows` is biting.
2. Three single-mutation probes, README restored after each — this is the discriminating evidence CI cannot provide, since CI only sees the unmutated corpus:
   - delete the `0020` row → expect `indexes every ADR file exactly once` to fail with `0020-methodology-first-productization.md: 0 index row(s), expected exactly 1`;
   - set the 0002 status cell back to `Proposed (shipped as prototype)` → expect `mirrors each ADR's own status, qualifiers aside` to fail with the `index says … (Proposed), file says "Accepted" (Accepted)` message;
   - append a row `| [0021](./0021-does-not-exist.md) | X | Accepted |` → expect `has no row pointing at a file the directory does not contain` to fail with `0021 → ./0021-does-not-exist.md: no such file in docs/adr/`, and **no ENOENT** from the other cases (this is the specific regression the worker claims to have fixed and re-verified).
   A green lane on any of the three would flip the verdict to request-changes: it would mean the suite does not discriminate on the two historical drift classes it was written for.
3. `npx prettier --check ArggonManager/docs/adr/README.md cli/src/adr-index-parity.test.ts` — demonstrates the re-padded table and the new test are formatter-clean. CI does not enforce this, so the PR body's claim is currently unverifiable in-lane; a failure is cosmetic and would not change the verdict.

Not needed: `npm test` / build / lint / tsc / validate / spec-validate are already covered by the green `cli` and `tasks-validate` CI jobs.

**Recommendation: merge.** The rows are bookkeeping and correct; the parity test is the deliverable and it discriminates on both historical drift classes with readable failures. The title non-assertion and the four nits are follow-up-grade, not merge blockers — if the coordinator wants the title hole closed, file it as a task against this story rather than reopening this PR. Item is `in_progress` with its acceptance ticked; the coordinator owns the `done` flip after merge.

### 2026-10-03 @ses_f00dc2b15ffeoZxl09JJcV24Ye
Correction to the review above (path typo, no change to the approve).

The worktree is **/home/arggon/Projects/ArggonManager-task-adr-readme-index-missing-adr-0020** — the two places that read `/Projects/ArggonManager-task-adr-readme-index-missing-adr-0020` dropped the `/home/arggon` prefix. Use that path as the cwd for the three probes in the §Probes needed block; everything else in the review stands as written.
