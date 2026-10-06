---
type: bug
status: todo
id: bug-prettier-glues-split-inline-code-span
title: "prettier is non-idempotent on Markdown: a multi-word inline code span near the wrap boundary gets split and its continuation glued to column 0"
parent: story-adopter-feedback
labels: [docs, formatter]
priority: p3
created: "2026-10-02"
updated: "2026-10-02"
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

Not asserted: which component owns it (prettier's Markdown printer vs this repo's
config), nor whether `proseWrap: "always"` avoids it. Both are cheap to test and are
the first thing to establish.

## Acceptance

- [ ] Root cause identified: prettier's Markdown reflow of a code span containing
      spaces, or the interaction with an unset `proseWrap`
- [ ] A minimal fixture reproducing the oscillation is committed as a regression
      test, so the fix is pinned
- [ ] Consecutive `prettier --write` runs on the fixture are byte-identical
- [ ] `prettier --check` passes on a file `prettier --write` just produced, for this
      shape
- [ ] Rendered output keeps the code span intact (no newline inside the span) and the
      continuation at the list item's indent
- [ ] Decision recorded on `.prettierrc.json` (e.g. whether `proseWrap` is set),
      consistent with the repo's existing formatter decisions
      (`task-formatter-override-template`) and with
      `bug-formatter-glues-markdown-spaces`'s resolution if one applies

## Notes

P3: cosmetic and non-blocking — it corrupts a render and makes a `--check` gate
unreliable for the affected file, but it cannot lose work or corrupt the tracker.
Found incidentally while filing
[`task-explore-adopter-feedback-channel`](task-explore-adopter-feedback-channel.md);
not a blocker for that PR, whose text was reworded instead.
