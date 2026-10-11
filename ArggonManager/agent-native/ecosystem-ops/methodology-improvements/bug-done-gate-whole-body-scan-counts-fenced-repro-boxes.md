---
type: bug
status: in_progress
id: bug-done-gate-whole-body-scan-counts-fenced-repro-boxes
title: "The done gate's box scan counts fenced repro content: a bug item whose repro legitimately contains `- [ ]` can never be flipped done, and the auto-flip wedge follows ADR 0025's \"dated comment blocks excluded\" only sometimes"
assignee: arggon-delivery-lead
branch: fix/bug-done-gate-whole-body-scan-counts-fenced-repro-boxes
parent: methodology-improvements
labels: [spec-pipeline, kernel]
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T13:00:31.335Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-done-gate-whole-body-scan-counts-fenced-repro-boxes
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-done-gate-whole-body-scan-counts-fenced-repro-boxes.md
  Leaves live only under a story. id is the filename stem: bug-done-gate-whole-body-scan-counts-fenced-repro-boxes.
  CLI `arggon create bug done-gate-whole-body-scan-counts-fenced-repro-boxes` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The done gate's box scan counts fenced repro content: a bug item whose repro legitimately contains `- [ ]` can never be flipped done, and the auto-flip wedge follows ADR 0025's "dated comment blocks excluded" only sometimes

## Context

See the delivery lead's dated comment below (the two observed sessions). The
short version: the gate's box scan counted `- [ ]` rows it must not read — rows
inside a fenced code block, and (before ADR 0025 landed) rows inside a dated
comment block — so a bug item whose own repro legitimately contains `- [ ]`
could never be flipped done.

**Root cause of the observed refusals, measured:** both sessions reproduce
verbatim against the repo-global `arggon@0.5.0` install
(`~/.local/share/mise/installs/node/.../bin/arggon`), which predates ADR 0025
and scans the whole body. Against this checkout's kernel the prettier item's
body already read `{gated: false}` before this change, because ADR 0025's
live-section scoping and comment-block stripping had landed on 2026-10-06.
What was still genuinely broken here — and is what this item fixes — is the
FENCE: the region extractor parsed every surviving line, so a fenced `- [ ]`
inside the live section counted as a criterion, and a fenced
`### <date> @author` line opened a comment block that deleted the live section
below it. Both directions are now fixed.

## Acceptance

- [x] The done gate's scan ignores `- [ ]`/`- [x]` inside fenced code blocks — the fence is content, never a criterion, and a fenced `## Acceptance` heading opens no section while a fenced `### <date> @author` heading opens no comment block (an unclosed fence runs to the end of the body, CommonMark)
- [x] ONE rule implemented and recorded: the gate reads the live `## Acceptance` section with dated comment blocks (`### <date> @author`, `### Waiver <date>`) AND fenced code blocks excluded; it refuses when that section publishes no criterion at all (ADR 0025 decision 2) OR when the section's own boxes are unticked (ADR 0015 decision 1). Nothing else in the body gates the flip. Recorded in ADR 0025's 2026-10-11 amendment, `convention.md`, `agents.md`, `json-output.md` and the bundled skill
- [x] Tests cover the two observed shapes and both refusals stay refused: a fenced repro outside the live section (3 literal `- [ ]` rows), a fenced repro INSIDE the live section between two real criteria, the real `bug-prettier-glues-split-inline-code-span` body end-to-end, a ticked live section with an unticked filing comment, an unticked live box (refused), a live section whose only boxes are fenced (refused as `no-live-contract`), plus the fence grammar (tildes, 4-run, info-string backtick, unclosed), the container-cascade split, and the MCP surface both ways
- [x] `bug-prettier-glues-split-inline-code-span` flips done without a waiver and without editing its repro — demonstrated on a scratch branch (`scratch/verify-done-gate-fence` off `origin/main`) with the item restored to its pre-flip state: the pre-fix CLI refuses, the fixed kernel flips, the body is byte-identical to `origin/main`, no `### Waiver` written, all three fenced repro rows intact (the real flip is the delivery lead's after merge)
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok — in the declared order

## Notes

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — context + acceptance

**Context (observed today, twice).** ADR 0025 says the done gate reads the item's LIVE `## Acceptance` section with dated comment blocks excluded, and refuses the flip when that section publishes no criterion. The kernel in this checkout behaves differently: it refuses any flip while the body file contains `- [ ]` anywhere.

Two sessions of evidence:
1. `task-spec-deps-022-no-error-path`: live Acceptance fully ticked, but my FILING COMMENT carried the same criteria unticked — flip refused ("still has unchecked boxes"). Ticking the comment boxes let it pass. So comment blocks are NOT excluded in practice.
2. `bug-prettier-glues-split-inline-code-span` (PR #707 merged, live Acceptance 6/6 ticked): the bug's own REPRO — a fenced markdown block demonstrating what prettier does to a `- [ ]` list item — contains three literal `- [ ]` lines. The flip is refused and the auto-flip wedge never fires. The fence is content, not criteria; without a gate fix this item can never reach done. (The checkbox is load-bearing for that repro: measured today, a plain `- ` bullet does not drift, so the repro cannot be simplified away.)

**Why it matters beyond hygiene:** the done gate is the repo's completion contract. A gate that reads fenced content as criteria will wedge exactly the items whose subject matter IS markdown-shaped — formatter bugs, tracker-shaped repros, docs items — i.e. the tracker eating its own dogfood in reverse.

Acceptance:
- [x] The done gate's scan ignores `- [ ]`/`- [x]` inside fenced code blocks (the ADR 0025 live-section read is the contract; fences are content)
- [x] The scan honors ADR 0025's "dated comment blocks excluded" — a `### <date> @author` block's boxes do not gate the flip (today they do, per evidence 1). Pick ONE rule and implement it; record which
- [x] Tests cover: fence-embedded boxes, comment-block boxes, ticked live section with unticked comment (today's exact two shapes)
- [x] `bug-prettier-glues-split-inline-code-span` flips done without a waiver and without editing its repro, once this lands (the item stays in_progress until then — honest state)
- [x] `npm test`, `npm run build`, `npm run check:plugin`, `npm run lint` green; `arggon validate` ok

### 2026-10-11 @arggon-maker
**Maker evidence — bug-done-gate-whole-body-scan-counts-fenced-repro-boxes** (branch `fix/bug-done-gate-whole-body-scan-counts-fenced-repro-boxes`).

## Root cause — measured, and it is NOT what the filing comment assumed

Both observed refusals reproduce **verbatim** against the repo-global `arggon@0.5.0`
install (`~/.local/share/mise/installs/node/26.7.0/bin/arggon`, the whole-body scan that
predates ADR 0025):

    $ arggon update bug-prettier-glues-split-inline-code-span --status done --json
    {"ok":false,...,"error":{"message":"cannot mark '...' done: the acceptance checklist in the item body still has unchecked boxes. Tick every box, or pass --waive \"<reason>\" ...","code":"UPDATE_FAILED"}}

and the same for `task-spec-deps-022-no-error-path`'s body at its pre-tick state
(`git show 46549ff1:...`). Against **this checkout's kernel**, the prettier item's body
already read `{gated: false}` before my change — ADR 0025's live-section scoping and
comment-block stripping landed on 2026-10-06 (commit 6d3bef0c). So "comment blocks are NOT
excluded in practice" is true of the *global install*, not of the kernel.

What was still genuinely broken is the FENCE, in both directions:

1. `liveAcceptanceRegion` parsed every surviving LINE, so a `- [ ]` row inside a fenced
   block counted as a criterion whenever the fence sat inside the live section.
2. `withoutCommentBlocks` was fence-blind, so a fenced `### <date> @author` line (a repro
   of what `arggon comment` writes) opened a comment block and deleted the live section
   that followed it — the same defect with the opposite sign (a false
   `no-live-contract` refusal).

## The ONE rule implemented (exact scan semantics)

    The gate reads the item's LIVE `## Acceptance` section. Dated comment blocks
    (`### <date> @author`, `### Waiver <date>`) and fenced code blocks are excluded
    from the scan. A flip is refused when that section publishes NO criterion at all
    (ADR 0025 decision 2) OR when the section's own boxes are unticked (ADR 0015
    decision 1). Nothing else in the body gates the flip.

Fence grammar (CommonMark subset): a run of 3+ backticks or tildes indented at most 3
spaces opens; a backtick fence's info string may not contain a backtick; the closer is the
same character, at least as long, with nothing but whitespace after it; an unclosed fence
runs to the end of the body. **The fence is consulted BEFORE the heading rules**, so a
fenced `## Acceptance` opens no section and a fenced comment heading opens no block.
`acceptanceRows`/`acceptanceComplete` stay fence-blind (renderers keep listing rows as
written; the container cascade keeps the whole-body question per ADR 0025 decision 6 —
widening it is `task-cascade-whole-body-acceptance-defers-this-defect`'s scope, not mine).

Recorded in: ADR 0025 (2026-10-11 amendment + decisions 1/2 pointers), ADR 0015's
amendment pointer, `convention.md` §Acceptance rows + §Done gate, `agents.md` §5,
`json-output.md`, and the bundled skill's methodology reference (with the
`.convention.yml` x-generated ledger checksum re-baselined through the kernel's own
`checksumOf`, so the provenance audit stays green).

## Change

- `lib/src/items.ts`: `withoutCommentBlocks` -> `liveAcceptanceLines` (comment blocks
  AND fences excluded, fence state first), `FENCE_LINE`/`opensFence`/`closesFence`;
  `liveAcceptanceRegion` fed by it; doc comments on `acceptanceRows`,
  `acceptanceGate` and `liveAcceptanceRegion` state the rule.
- `lib/src/update.ts`: the gate comment records the same rule.
- `cli/src/acceptance-parity.test.ts`: the independent live-region oracle states the
  fence rule too (step 2 before the heading rules); the fuzz alphabet gains 7 fence
  shapes and 200k bodies — kernel and oracle still agree.
- `cli/src/done-gate.test.ts`: 11 new tests (list below).
- `opencode/plugins/arggon/index.bundle.ts`: regenerated (`npm run build`).

## Tests (all new, in `cli/src/done-gate.test.ts`, describe "done gate: fenced repro boxes do not gate the flip" / "the two refusals still refuse around fences" / "done gate over MCP")

1. flips with a ticked live section and a fenced repro in another section — THE observed shape (3 literal `- [ ]` rows, whole-body predicate still refuses)
2. flips with the fenced repro INSIDE the live section, between two real criteria
3. flips the REAL `bug-prettier-glues-split-inline-code-span` body (read from the tree at test time), waiver-free, repro untouched
4. flips with a ticked live section and an unticked filing comment — the second observed shape
5. a fence wins over a comment heading: a fenced `### <date> @author` never strips the live section
6. a fenced `## Acceptance` heading is not a section; the real one below it is
7. an UNCLOSED fence runs to the end of the body
8. fence grammar: tildes, 4-run closers, and an info string carrying a backtick
9. (refusal) an unticked criterion in the LIVE section still refuses, fenced content or not
10. (refusal) a live section whose only boxes are fenced refuses as `no-live-contract`, then flips on transcription
11. (cascade) the container cascade keeps the whole-body question — a container whose repro fences carry unticked rows is still skipped `acceptance-incomplete`, while its leaf flips
12. (MCP) `updateOperation({agent:true})` allows the flip on a fence-heavy body, and still surfaces `UPDATE_FAILED` for the live section's unticked box

## Scratch-branch verification (`bug-prettier-glues-split-inline-code-span`)

Scratch branch `scratch/verify-done-gate-fence` off `origin/main`, item restored to its
PRE-flip state (`status: in_progress` + `claimed_at: "2026-10-11T11:00:48.832Z"`, exactly
`git show 0741b5b4`), tree clean:

    pre-fix  arggon@0.5.0 update ... --status done --json
      -> {"ok":false, ... "the acceptance checklist in the item body still has unchecked boxes"}
         item stays in_progress, tree clean
    fixed    node dist/cli.js update ... --status done --json
      -> {"ok":true, ... "status":"done", "autoCompleted":[],"cascadeSkipped":[{"id":"story-adopter-feedback","type":"story","reason":"subtree-open","sibling":"bug-prettier-indented-list-continuation-grows-2-spaces-per-write"}]}
    git diff origin/main -- <item>  -> EMPTY (the flip produced exactly origin/main's bytes)
    ### Waiver sections: 0
    fenced '- [ ] **Spec + plan written**' rows: 3 (repro untouched)
    body below the frontmatter: byte-identical to origin/main
    arggon validate on the scratch tree: ok (0 warnings)

The `cascadeSkipped` entry is the pre-existing sibling defect
(`bug-prettier-indented-list-continuation-grows-2-spaces-per-write` is still open), not
this item's. Scratch worktree removed; the real item file on my branch is untouched
(`git status` shows no change to it).

## MCP path check

`tools.arggon.update` -> `cli/src/mcp-server.ts` `arggon_update` -> `updateOperation({...,
agent: true})` -> `runUpdate` -> `acceptanceGate`. Same kernel code as the CLI, and the
MCP schema still carries NO `waive` property (grep: zero hits), so the refusal-only
contract is unchanged. Verified live over stdio JSON-RPC in a scratch tracker:
`arggon_update {id, status:"done"}` returns `{"ok":true,...}` on a fence-heavy body and
`{"ok":false,"error":{"code":"UPDATE_FAILED","message":"...the live '## Acceptance' section
still has unchecked boxes. Tick every box there, or pass --waive ..."}}` on an unticked live
box. Also pinned by test 12.

## Gates (declared order, this worktree)

    npm run build .......... ok (incl. build:plugin — 44 modules, 514375 bytes)
    npm test ............... 137 files / 3015 tests passed
    npm run check:plugin ... ok (re-verified AFTER the bundle commit — see below)
    npm run lint ........... ok (eslint, no findings)
    npm run test:structure . ok (ast-grep, 5 rule tests pass)
    arggon validate ........ ok (0 warnings, convention v5)

One gate-order note for the reviewer: `check:plugin` diffs the REGENERATED bundle against
the COMMITTED one, so it is only meaningful after `lib/src/items.ts` and the bundle are
committed together — I re-ran it post-commit and it is clean.

## Out of scope, reported (not filed, not fixed here)

- The container cascade still reads fenced `- [ ]` rows as obligations (`acceptanceComplete`
  is whole-body and fence-blind). Pinned by test 11 rather than changed: ADR 0025 decision 6
  defers it to `task-cascade-whole-body-acceptance-defers-this-defect`.
- The observed sessions' refusals came from the global `arggon@0.5.0` on PATH, which
  predates ADR 0025. Repo hygiene question for the delivery lead: should the global install
  be pinned to the repo's version (`npm i -g` / `mise`), or should the agent docs pin
  `npm run arggon --`? Filing that is a delivery-lead call.
- 5 non-convergent item bodies + 45 settled-column-0 spans remain the sibling prettier
  items' scope.

### handoff 2026-10-11 @arggon-maker (session: ses_ed4f1fdebffeAMUBMy1y1ZpQJp) — next: Review PR #713: one fence-aware line filter (liveAcceptanceLines) excludes dated comment blocks AND fenced code blocks from the live ## Acceptance scan; 11 new tests; scratch-branch flip of the real …
- branch: fix/bug-done-gate-whole-body-scan-counts-fenced-repro-boxes
- open questions: Should the repo-global arggon@0.5.0 on PATH be pinned to the repo version (it predates ADR 0025 and is what produced both observed refusals)?; does the delivery lead want the container cascade fenced…
