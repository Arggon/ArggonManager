---
type: bug
status: done
id: bug-prettier-glues-split-inline-code-span
title: "prettier is non-idempotent on Markdown: a multi-word inline code span near the wrap boundary gets split and its continuation glued to column 0"
assignee: arggon-delivery-lead
branch: fix/bug-prettier-glues-split-inline-code-span
parent: story-adopter-feedback
labels: [docs, formatter]
priority: p3
created: "2026-10-02"
updated: "2026-10-11"
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/bug-prettier-glues-split-inline-code-span.md
  Leaves live only under a story. id is the filename stem: bug-prettier-glues-split-inline-code-span.
  CLI `arggon create bug prettier-glues-split-inline-code-span` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# prettier is non-idempotent on Markdown: a multi-word inline code span near the wrap boundary gets split and its continuation glued to column 0

## Context

Found while authoring
[`exploration-adopter-feedback-channel-024`](../../../docs/explorations/exploration-adopter-feedback-channel-024.md)
(2026-10-02; repo has prettier 3.9.6, `.prettierrc.json` = `printWidth: 100`,
`proseWrap` unset). A **continuation list item** whose text contains a
multi-word inline code span near the wrap boundary makes prettier
**non-idempotent**: `--write` and `--check` disagree on consecutive runs, and the
code span ends up split across the newline with its continuation **glued to column 0**.

Literal repro — input:

```markdown
- [ ] **Spec + plan written** from the edge-case table, then `arggon spec analyze` reports no NEW findings — the gate that releases implementation tasks
```

What prettier produces (pass 1):

```markdown
- [ ] **Spec + plan written** from the edge-case table, then `arggon spec
analyze` reports no NEW findings — the gate that releases implementation
      tasks
```

Two visible defects in that output:

1. The inline code span `` `arggon spec analyze` `` is **broken across the line
   break**. A code span containing spaces is not splittable, so the render changes
   (the space becomes a literal newline inside the span) and the continuation lands
   at **column 0** instead of the list item's indent.
2. **`--check` then fails on the file prettier itself just wrote**, and a second
   `--write` changes it again. `git diff` after each pass shows the same line
   toggling, so a `--check` gate run after `--write` is unreliable for any file that
   trips this.

**Why this is filed rather than worked around silently.** The workaround (reword so
no multi-word code span sits near the boundary) was applied to unblock the
exploration PR, but the underlying non-determinism stays: any future author who
writes that shape — which is _every_ `arggon <subcommand>` reference at the end of a
long list item — silently gets a corrupted render plus a write/check disagreement.
`bug-formatter-glues-markdown-spaces` closed a sibling family of gluing/indent-loss
in docs; this is the same family reached through a different trigger (**line-width
reflow of a code span with internal spaces inside a continuation list item**), so it
plausibly regressed past that fix's scope.

**Resolved (2026-10-11).** The owner is prettier's Markdown printer, not this
repo's config — the drift reproduces under every markdown option (`--prose-wrap
preserve|always|never`, any `--print-width`). `proseWrap: "always"` does avoid it,
by reflowing every paragraph to `printWidth`; it is rejected because it rewrites
817 of the 996 tracked `.md` files against 615 for the shipped `preserve` — see
"## Root cause".

## Root cause

**Prettier 3.9.6 walks the continuation of an inline code span two spaces (one tabWidth) to the LEFT on every `--write`, and stops only when that continuation reaches column 0.** The trigger is a span whose delimiters sit on different lines AND whose continuation line is indented — a multi-word span straddling the wrap boundary inside a list item. Measured with the repo config (`.prettierrc.json`, `printWidth: 100`, `proseWrap` unset) on this item's own words:

- write 1 moves the continuation from 6 spaces to 4
- write 2 moves it to 2
- write 3 moves it to 0, and only then does the file stop moving

The settled bytes, which `--check` then accepts:

```markdown
- [ ] **Spec + plan written** from the edge-case table, then `arggon spec
analyze` reports no NEW findings — the gate that releases implementation tasks
```

So `--check` disagrees with `--write` on the two passes before that, and the shape it finally accepts is the "continuation glued to column 0" this item reports. The item body's original "pass 1" sample above is that settled state, not the first write.

**Two corrections to the original report, from the measurement:**

1. **The render is corrupted only in flight.** The span's parsed value keeps the line ending AND the continuation's surplus indentation — `arggon spec\n    analyze` at a 6-space continuation — which renders with extra spaces inside the span. The settled column-0 state renders correctly again (CommonMark folds the line ending to a space), so the corruption never shows in a render of the committed tree, which is why it reads as pure churn. A wrapped span is only render-clean at indent 2 for these `- [ ] ` bullets (prettier's parser is not GFM, so `[ ] ` is not a checkbox and the content column is 2).
2. **The trigger is not the unset `proseWrap`.** `preserve` is prettier's default and is what keeps a long single-line list item from being reflowed at all (the safe authoring form below). `proseWrap: "always"` avoids the straddle by re-wrapping; `never` drifts exactly like `preserve`; `--print-width` changes only how many writes the drift takes.

**Decision recorded on `.prettierrc.json`: no option repairs it, so the config now states the choice instead of inheriting it.** `"proseWrap": "preserve"` is explicit (behaviour-identical to the previous unset default — `npx prettier --check .` names exactly the same 651 files before and after), and the fix is the authoring rule pinned by `cli/src/prose-format.test.ts`: keep a multi-word span off the wrap boundary, i.e. write the bullet as one line and let prettier leave it alone. This follows `bug-formatter-glues-markdown-spaces`'s resolution (pin/config rejected with evidence, guard + source repair) and `task-formatter-override-template`'s precedent of recording a formatter decision where adopters can see it.

**Out of scope, reported:** five item bodies under the tracker tree are non-convergent today (`task-strict-attach-dead-owner-hatch`, `bug-formatter-glues-markdown-spaces`, `task-opencode-v2-plugin`, `task-mcp-full-surface`, `task-matrix-reaches-adopters`) and 45 spans in the prose corpus already sit at the settled column-0 state. The tracker-subtree convergence rule belongs to `bug-prettier-indented-list-continuation-grows-2-spaces-per-write`; the column-0 sweep is a `task-code-span-repair-sweep`-shaped follow-up.

## Acceptance

- [x] Root cause identified: prettier's Markdown reflow of a code span containing
      spaces, or the interaction with an unset `proseWrap` — the Markdown printer,
      not `proseWrap`; `preserve` keeps the safe form untouched.
- [x] A minimal fixture reproducing the oscillation is committed as a regression
      test, so the fix is pinned — `SPAN_NEAR_WRAP_SAFE` / `SPAN_SPLIT_AT_WRAP`
      plus the two corpus rules in `cli/src/prose-format.test.ts` (5/5 green).
- [x] Consecutive `prettier --write` runs on the fixture are byte-identical
      (asserted for the safe form in `prose-format.test.ts`; the drift shape now
      cannot be committed because rule 5 rejects it).
- [x] `prettier --check` passes on a file `prettier --write` just produced, for this
      shape — the safe form is a `prettier --write` no-op, so one `--check` is
      sufficient; the mutation probe proves the guard fires if that changes.
- [x] Rendered output keeps the code span intact (no newline inside the span) and the
      continuation at the list item's indent — the span now never wraps at all; and
      the record carries the correction that a wrapped span still renders as a
      space, so the original "corrupted render" claim was overstated.
- [x] Decision recorded on `.prettierrc.json` (e.g. whether `proseWrap` is set),
      consistent with the repo's existing formatter decisions
      (`task-formatter-override-template`) and with
      `bug-formatter-glues-markdown-spaces`'s resolution if one applies —
      `"proseWrap": "preserve"` pinned explicitly, authoring rule + guard instead
      of a proseWrap change.

## Notes

P3: cosmetic and non-blocking — it corrupts a render and makes a `--check` gate
unreliable for the affected file, but it cannot lose work or corrupt the tracker.
Found incidentally while filing
[`task-explore-adopter-feedback-channel`](task-explore-adopter-feedback-channel.md);
not a blocker for that PR, whose text was reworded instead.

### 2026-10-11 @ses_ed55fd9c6ffeLaCrnZUBxvBLuH
**Fix evidence — bug-prettier-glues-split-inline-code-span** (branch `fix/bug-prettier-glues-split-inline-code-span`, prettier 3.9.6, repo worktree).

### Root cause (measured, not asserted)

prettier 3.9.6's Markdown printer moves the continuation line of an inline code span **two spaces (one tabWidth) to the LEFT on every `--write`**, and stops only when that continuation reaches column 0. Trigger: a span whose delimiters sit on different lines **and** whose continuation line is indented.

Before (the shape, and what `prettier --write` does to it, with the repo config `printWidth: 100`):

- source continuation at 6 spaces → write 1 → 4 → write 2 → 2 → write 3 → 0 → then stable
- `prettier --check` fails after write 1 and write 2 (it passes only on the settled column-0 bytes)

The item body's original "pass 1" sample is that settled state. Two corrections to the original report: the render is corrupted only in flight (the parsed span value keeps the line ending plus the surplus indent, so the mid-drift states render with extra spaces inside the span; the settled column-0 state renders correctly), and the trigger is the printer, not the unset `proseWrap`.

### What changed

1. `.prettierrc.json`: `"proseWrap": "preserve"` made explicit. Rejection evidence for the alternative: `proseWrap: "always"` rewrites 817/996 tracked `.md` files vs 615 for `preserve`, so it avoids the straddle only by reflowing every paragraph. Verified reflow-free: `npx prettier --check .` names the **identical** file set before (651) and after (the only difference is my own untracked scratch files, since removed) — the repo's markdown was not prettier-clean before and is unchanged after; there is no prettier step in CI (`grep -rn prettier .github/workflows` → no matches).
2. `cli/src/prose-format.test.ts`: rules 4 and 5 added to the existing guard (the repo's only markdown formatter gate, run by `npm test`).
   - rule 4 — convergence where a span wraps: for every prose doc carrying a span that crosses a line break, `format(format(x)) === format(x)`. A single `--check` compares committed bytes against one pass, so it cannot see a file that still moves.
   - rule 5 — no span may straddle a wrap onto an **indented** continuation, i.e. the pre-drift shape cannot be written down at all.
   - keycase `SPAN_NEAR_WRAP_SAFE` / `SPAN_SPLIT_AT_WRAP` (the item's literal repro): safe form is a `--write` no-op, convergent, and its span survives as one `inlineCode` with value `arggon spec analyze`; the drift shape is detected by the rule-5 detector (so the rule is not vacuous).

### Mutation evidence (guard is not vacuous)

- injecting the drift shape into `ArggonManager/docs/playbooks/opencode.md` → rule 5 names `opencode.md:585 span "`arggon spec<NL>      analyze`" wraps onto a 6-space continuation (line 586)` and rule 4 names the file as non-convergent (file reverted after the probe).
- pointing the keycase's safe constant at the drift shape → keycase fails on the detector self-check.
- `npx vitest run cli/src/prose-format.test.ts` → 5/5 green.

### Gates (declared order, this worktree)

`npm run build` ok · `npm test` 136 files / 2969 tests pass · `npm run check:plugin` no drift · `npm run lint` clean · `arggon validate` ok (0 warnings, convention v5).

### Out of scope, reported to the delivery lead

Five item bodies under the tracker tree are non-convergent today — the drift is live there, and they are other items' files: `task-strict-attach-dead-owner-hatch`, `bug-formatter-glues-markdown-spaces`, `task-opencode-v2-plugin`, `task-mcp-full-surface`, `task-matrix-reaches-adopters`. A convergence rule for that subtree belongs to `bug-prettier-indented-list-continuation-grows-2-spaces-per-write` (its own acceptance already carries it). Separately, 45 spans in the prose corpus sit at the settled column-0 state (renders fine, source mangled) — a `task-code-span-repair-sweep`-shaped follow-up, not filed here. Nothing was filed: no tracker item was created by this worker.

### handoff 2026-10-11 @ses_ed55fd9c6ffeLaCrnZUBxvBLuH (session: ses_ed55fd9c6ffeLaCrnZUBxvBLuH) — next: Review PR: root cause pinned (prettier walks a straddling span's indented continuation left 2 spaces per --write to column 0); fix = explicit proseWrap:preserve + prose-format rules 4/5 + keycase; de…
- branch: fix/bug-prettier-glues-split-inline-code-span
- open questions: Who repairs the 5 non-convergent item bodies (sibling bug's scope)?; is a column-0 code-span repair sweep over 45 prose spans worth a follow-up item?; prose-format.test.ts heaviest tests are timeout-…

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — review verdict: APPROVED, merge when checks green (PR #707)

Reviewed against engineering.md §Review bar: the maker corrected the repro honestly (the literal single-line input is a no-op under the shipped config; what oscillates is the wrapped continuation, drifting one tabWidth left per --write until column 0) and located the owner (the markdown printer, not the unset proseWrap); the fix is the narrowest one that keeps idempotency with a recorded measurement (proseWrap: preserve names the identical file set before/after — 615/996 — while "always" would reflow 817/996); the regression mechanism is mutation-verified (injecting the drift shape fires both new rules naming file and line; pointing the keycase at the drift fails it); and the repo's absent markdown gate is named as the gap it is, with the exclusion of the tracker subtree documented. Gates green (cli check re-running at verdict time). The maker's follow-up findings (5 non-convergent tracker item bodies → belongs to the sibling prettier bug's acceptance; the 45-span settled-corpus sweep → filed as task-code-span-repair-sweep; the timeout-adjacent prose-format test → recorded against the named existing bug) are routed.
