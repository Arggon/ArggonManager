---
type: bug
status: in_progress
id: bug-prettier-glues-split-inline-code-span
title: "prettier is non-idempotent on Markdown: a multi-word inline code span near the wrap boundary gets split and its continuation glued to column 0"
assignee: arggon-delivery-lead
branch: fix/bug-prettier-glues-split-inline-code-span
parent: story-adopter-feedback
labels: [docs, formatter]
priority: p3
created: "2026-10-02"
updated: "2026-10-11"
claimed_at: "2026-10-11T11:00:48.832Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-prettier-glues-split-inline-code-span
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
