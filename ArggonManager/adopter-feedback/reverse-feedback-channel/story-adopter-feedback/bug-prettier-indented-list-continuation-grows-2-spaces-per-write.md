---
type: bug
status: in_progress
id: bug-prettier-indented-list-continuation-grows-2-spaces-per-write
title: "prettier is non-idempotent on Markdown a second way: an indented list-continuation paragraph grows 2 spaces on every `--write`, so a single `--check` cannot prove convergence"
assignee: arggon-delivery-lead
branch: fix/bug-prettier-indented-list-continuation-grows-2-spaces-per-write
parent: story-adopter-feedback
labels: [formatting]
created: "2026-10-03"
updated: "2026-10-11"
claimed_at: "2026-10-11T13:00:27.884Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-prettier-indented-list-continuation-grows-2-spaces-per-write
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/bug-prettier-indented-list-continuation-grows-2-spaces-per-write.md
  Leaves live only under a story. id is the filename stem: bug-prettier-indented-list-continuation-grows-2-spaces-per-write.
  CLI `arggon create bug prettier-indented-list-continuation-grows-2-spaces-per-write` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# prettier is non-idempotent on Markdown a second way: an indented list-continuation paragraph grows 2 spaces on every `--write`, so a single `--check` cannot prove convergence

## Context

A loose `- [ ]` **task-list item** whose continuation **paragraph** is physically
**wrapped** (an internal newline that `proseWrap: "preserve"` keeps). This is the
second, independent manifestation of the same prettier-3.9.6 markdown
non-idempotence class as `bug-prettier-glues-split-inline-code-span` (span
splitting); the two are disjoint shape families with a shared consequence.

**Mechanism.** Prettier's parser reads a task item's content at column 2, but its
printer emits the 6-wide `- [ ] ` checkbox marker. A continuation indented to the
content column is therefore 4 columns past what the parser expects, so it parses
as an indented (unfenced, multi-line) `code` block — and the printer re-emits
every WRAPPED continuation line two tabWidths (4 spaces) further RIGHT on EVERY
`--write`. The first continuation line stays anchored at 6; the wrapped line grows
`6 → 10 → 14 → 18 → …` and never settles (reproduced from the `INDENTED_CONT_DRIFT`
constant in `cli/src/prose-format.test.ts`):

```text
wrapped-continuation line indent per --write pass
  pass 0 (source): 6
  pass 1:          10
  pass 2:          14
  pass 3:          18   (unbounded — still moving on the third write)
```

A single `prettier --check` compares committed bytes against ONE `--write`, so it
passes on output the NEXT write still moves — the drift is silent and unbounded.

**What converges (safe forms) — none of them drift:** plain `-`/`*` bullets and
ordered items at the same indent (no marker/parser column gap), tight lists
(no blank before the continuation), single-physical-line continuations, and
FENCED code blocks (the fence pins the shape). Only the wrapped continuation
under a `- [ ]` item drifts. Measured over the corpus: 0 of the tracked prose
files and 0 of the 597 tracker item-tree `.md` files carry the shape.

**Decision (original acceptance #4).** The fix is the AUTHORING CONVENTION, not
config: `proseWrap: "preserve"` (already explicit from the span bug) does not stop
this drift, and `"always"` reflows 817/996 tracked files. The rule — write the
continuation as ONE physical line — is pinned by rule 6 + keycase in
`cli/src/prose-format.test.ts`, mirroring rules 4/5.

## Acceptance

- [x] The body's shape is idempotent under repeated `--write` after the fix — the drift repro above is fenced (no drift-trigger row), and this body double-writes to a fixed point (`pass1 === pass2`).
- [x] Rule + keycase are in `cli/src/prose-format.test.ts`, mutation-verified — rule 6 bans the trigger (a task item carrying an unfenced multi-line continuation) and double-writes the multi-line-code-in-list herd; the keycase pins the drift form (fires the detector, non-convergent under a second write) against the safe single-line form (write no-op). Mutation A (injecting `INDENTED_CONT_DRIFT` into `tools/ast-grep/README.md`) fired rule 6 (`README.md:315 indented continuation code block spans 2 lines under a task item`) and the convergence half (plus rule 4 as defense in depth); mutation B (asking the safe form for a trigger) failed `expected 0 to be greater than 0`; clean tree 7/7 green in the suite run.
- [x] The convergence-evidence generalization is recorded — a single `prettier --check` is not proof of convergence; the enforcement is the shared double-write shape (rule 4 for wrapping spans, rule 6 for list-continuation code). My shape is NOT covered by rule 4: its herd counts wrapping `inlineCode` spans, which a bare continuation paragraph never sets, so a file whose only non-convergence is a wrapped continuation is invisible to rule 4 — which is exactly why rule 6 needs its own detector (`listCodeReport`).
- [x] The tracker bodies my shape touches are repaired or deferred — a full sweep of the 597 tracker item-tree `.md` files found 0 carrying my shape; the 5 non-convergent bodies (`task-strict-attach-dead-owner-hatch`, `bug-formatter-glues-markdown-spaces`, `task-opencode-v2-plugin`, `task-mcp-full-surface`, `task-matrix-reaches-adopters`) are all SPAN-drift (a code-span continuation walking left by 2), so they are deferred to `task-code-span-repair-sweep` and are out of this item's scope.
- [x] Tracker-subtree convergence recorded — the tracker item tree stays excluded from `proseDocs()` (it quotes mangled formatter output as evidence); extending a convergence rule into it is blocked by the 5 span-drift bodies and must tolerate that quoted-mangled output, so it is a follow-up paired with `task-code-span-repair-sweep`, whose `listCodeReport` detector is ready to reuse.
- [x] Gates green — `npm run build`, `npm test` (139 files / 3031 tests after the branch's rebase onto current `origin/main`), `npm run check:plugin`, `npm run lint`, and `arggon validate` (0 warnings); commands + expected-vs-observed in the evidence comment.

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x

Found by the worker on PR #586 (task-explore-adopter-feedback-channel), 2026-10-03, while renumbering four documents and hitting it TWICE in one session.

**A second manifestation of the same non-idempotence class** as `bug-prettier-glues-split-inline-code-span` (also open): that one splits a multi-word inline code span near the wrap boundary and glues its continuation to column 0. This one **grows an indented list-continuation paragraph by 2 spaces on every `--write`**.

The consequence for the workflow is the important part, and it generalizes both bugs: **a single `prettier --check` is not evidence of convergence.** The worker had to run the formatter three consecutive times and verify the output stopped changing. Any gate or review step that checks "prettier is clean" once will pass on a file that will still change on the next write — so the drift is silent, and it accumulates exactly on the docs most likely to be edited (lists inside long decision records).

Note also what the worker chose to do about it: rewrote the affected content as single-line bullets rather than fighting the formatter, and kept the diff tight instead of filing this. Filing it now, with the reproduction, because "two independent encounters in one day" is the signal.

Acceptance:

- [x] Both manifestations (span splitting AND 2-space indent growth) are covered by one item's repro, so the class is tracked once
- [x] A convergence check exists — format twice and assert the second pass produces no diff — because a single `--check` provably cannot detect this
- [x] The repo's docs/prettier guidance states the rule an author needs (avoid indented list continuations and multi-word inline spans near the wrap boundary, or accept the format churn)
- [x] Decide whether the fix is prettier config (printWidth/proseWrap), a `.prettierignore` scope for the long decision records, or authoring convention — and record the decision rather than leaving the next author to rediscover it

### 2026-10-11 @Arggon

Gates (declared order): `npm run build` ok; `npm test` = 137 files / 3004 tests passed; `npm run check:plugin` exit 0 (regenerated plugin bundle byte-identical — my change is test-only); `npm run lint` exit 0; `arggon validate` ok (0 warnings, convention v5). Targeted `vitest run cli/src/prose-format.test.ts` = 7/7 green.

Rule 6 + keycase (cli/src/prose-format.test.ts, mirroring rules 4/5):

- detector `listCodeReport` fires ONLY on a task item (`listItem.checked != null`) carrying an UNFENCED multi-line `code` block (the wrapped continuation); fenced blocks, plain bullets/ordered lists, tight lists and single-line continuations stay silent because they have no marker/parser column gap and converge.
- Rule 6 bans the trigger over the prose corpus AND double-writes the multi-line-code-in-list herd (4 files today, all fenced/convergent) asserting `first === second`.
- Keycase: `INDENTED_CONT_DRIFT` → detector fires (`...:3 indented continuation code block spans 2 lines under a task item`) AND first `--write` != source AND second != first (non-convergent); `INDENTED_CONT_SAFE` (single physical continuation line) → write no-op and convergent.

Mutation verification (file-backed, reverted, clean tree 7/7 after):

- MUT A: appended `INDENTED_CONT_DRIFT` to tools/ast-grep/README.md → rule 6 RED twice: shape-ban "…/README.md:315 indented continuation code block spans 2 lines under a task item" AND convergence "tools/ast-grep/README.md: prettier is not convergent - a second --write changes it" (rule 4 also RED on the same file = defense in depth).
- MUT B: asked the SAFE form for a trigger → keycase RED (`expected 0 to be greater than 0`).

Drift repro (prettier 3.9.6, printWidth 100, proseWrap preserve): wrapped-continuation line indent per --write = 6 → 10 → 14 → 18 (+4 = two tabWidths, unbounded).

Generalization (2026-10-03 comment): a single `prettier --check` is not evidence of convergence. Enforced by the shared double-write shape — rule 4 (wrapping `inlineCode` spans) + rule 6 (list-continuation code). My shape is NOT in rule 4's herd (it counts wrapping spans; a bare continuation paragraph sets none), so a file whose only non-convergence is a wrapped continuation is invisible to rule 4 — that is why rule 6 needs its own detector.

Tracker-subtree sweep (data-driven): scanned all 597 tracker item-tree .md files — 0 carry my shape; 5 are non-convergent and ALL 5 are SPAN-drift (code-span continuation walking left by 2), deferred to task-code-span-repair-sweep: task-strict-attach-dead-owner-hatch, bug-formatter-glues-markdown-spaces, task-opencode-v2-plugin, task-mcp-full-surface, task-matrix-reaches-adopters. Nothing to repair for my shape.

Item body itself: prettier-idempotent (pass1 === pass2) and write-clean on the committed body; live `## Acceptance` all ticked; no unticked or fenced-box `- [ ]` anywhere in the body.

Decision (original acceptance #4): authoring convention, not config — `proseWrap: "preserve"` (explicit from the span bug) does not stop this drift and `"always"` reflows 817/996 files; the rule "write the continuation as one physical line" is pinned by rule 6 + keycase.

### handoff 2026-10-11 @Arggon — next: Delivery lead: review + merge PR (fix = rule 6 + keycase in prose-format.test.ts); flip done after merge. My shape touches 0 tracker bodies; the 5 non-convergent ones are span-drift for task-code-spa…

- branch: fix/bug-prettier-indented-list-continuation-grows-2-spaces-per-write
- open questions: tracker-subtree convergence rule stays deferred until task-code-span-repair-sweep repairs the 5 span-drift bodies (must tolerate quoted-mangled-evidence fences).

### 2026-10-11 @Arggon

Correction to the "write-clean" phrasing above: the item body is prettier-IDEMPOTENT (it converges to a fixed point, pass1 === pass2) — which is what acceptance #1 asks ("passes until convergence, then stable"). It is NOT byte-write-clean, but neither is ANY tracker item body: the only bytes prettier would rewrite are the post-frontmatter blank-line normalization the `arggon create` template omits on every item (verified on task-explore-adopter-feedback-channel and bug-prettier-glues-split-inline-code-span — both idempotent, both not write-clean). This is pre-existing and by design: the tracker item tree is excluded from proseDocs()/the prose-format guards, and `npm run format` over it is a known no-go. Nothing my edits introduced except the (convergent) Context/Acceptance fill.

### 2026-10-11 @ses_ed467de75ffekufDO5jLfnHPF6
Finishing maker session (previous session died on infra error; its work was verified fresh here, not trusted).

Independent drift repro (prettier 3.9.6, repo config): INDENTED_CONT_DRIFT written 4 times; wrapped continuation indent per pass = 6 -> 10 -> 14 -> 18 (two tabWidths right per --write, unbounded). A single --check after pass 1 still fails on pass 2 — the claim in the title holds.

Independent tracker sweep (all .md under ArggonManager/, this tree's 706 files): 0 carry my shape (task item + unfenced multi-line code block); 5 non-convergent under a 2nd --write, all 5 = SPAN-drift (span-wrap hits, zero list-continuation triggers): task-strict-attach-dead-owner-hatch, bug-formatter-glues-markdown-spaces, task-opencode-v2-plugin, task-mcp-full-surface, task-matrix-reaches-adopters — deferred to task-code-span-repair-sweep, nothing to repair for my shape. Count is 706 here vs 597 at filing (tree grew); conclusion identical.

Item body convergence: prettier pass1 === pass2 on the committed body file (verified with the repo config).

Mutations re-run this session (file-backed, reverted, clean tree after each):
- MUT A: appended INDENTED_CONT_DRIFT to tools/ast-grep/README.md -> rule 6 RED twice ("tools/ast-grep/README.md:314 indented continuation code block spans 2 lines under a task item" + "prettier is not convergent - a second --write changes it"); rule 4 RED on the same file (defense in depth).
- MUT B: keycase asked the SAFE form for a trigger -> RED ("expected false to be true" at the detector-fires assertion). Slight flavor difference from the earlier "expected 0 to be greater than 0" (different sed target); same conclusion — the keycase is not vacuous.

Gates (declared order, after rebasing the branch onto current origin/main — 15 commits, clean rebase, no file overlap with this diff): npm run build exit 0; npm test 139 files / 3031 tests passed; npm run check:plugin exit 0 (bundle byte-pinned); npm run lint exit 0; arggon validate ok (0 warnings). Targeted npx vitest run cli/src/prose-format.test.ts = 7/7.

Scope: 2 files vs main (cli/src/prose-format.test.ts +177; the item body). Sibling item's file untouched; no baseline JSONs, friction module, or done-gate kernel edits; prettier-on-save churn reverted (git status clean).

Convergence generalization: unchanged and covered — rule 4 does NOT see my shape (its herd counts wrapping inlineCode spans; a bare continuation paragraph sets none), which is why rule 6 carries its own detector (listCodeReport). Enforcement = the shared double-write shape + trigger ban, recorded in the test file's header comment and in the body's Acceptance #3.
