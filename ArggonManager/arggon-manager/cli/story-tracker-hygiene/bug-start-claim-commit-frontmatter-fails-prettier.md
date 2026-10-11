---
type: bug
status: todo
id: bug-start-claim-commit-frontmatter-fails-prettier
title: "The `start` claim commit re-serializes an item's frontmatter so it fails `prettier --check` (double-quoted `title:` + a blank line after the closing `---`) — the same file `arggon create` wrote prettier-clean"
parent: story-tracker-hygiene
labels: [tracker-schema, cli, prettier]
created: "2026-10-11"
updated: "2026-10-11"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-start-claim-commit-frontmatter-fails-prettier.md
  Leaves live only under a story. id is the filename stem: bug-start-claim-commit-frontmatter-fails-prettier.
  CLI `arggon create bug start-claim-commit-frontmatter-fails-prettier` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The `start` claim commit re-serializes an item's frontmatter so it fails `prettier --check` (double-quoted `title:` + a blank line after the closing `---`) — the same file `arggon create` wrote prettier-clean

## Context

Observed 2026-10-11 while a maker reviewed the claim commit of
`bug-adr-status-drift-merged-adr-proposed`: the item file that `arggon create` wrote
prettier-clean (`15f61667` on `main` passes) fails `npx prettier --check` **at the claim
commit** (`0b634154`) with exactly two hunks — prettier's YAML printer wants the frontmatter
`title:` single-quoted rather than double-quoted, and a blank line after the closing `---`.

So the kernel's own claim mutation degrades the tree's format cleanliness, and the maker was
right not to reformat it: rewriting kernel-written frontmatter inside an item that does not
own that defect would re-break on the next `arggon update` / `comment`.

No gate can require it today: CI never runs prettier over the tracker tree and
`prose-format.test.ts` excludes it — which is precisely why this should be decided rather
than left to drift. It also blocks any future acceptance criterion of the form
"`prettier --check` clean on an item file".

## Acceptance

- [ ] A claim commit leaves the item file prettier-clean: `npx prettier --check <item file>`
      passes on the tree immediately after `start --worktree`, or
- [ ] the tracker tree is excluded from prettier's scope **on purpose** — recorded in
      `.prettierignore` (or equivalent) with the reason that item files are kernel-owned — and
      that exclusion is deliberate and tested, not an accident of CI never running it
- [ ] A test pins the outcome: the frontmatter writer that `start` uses produces bytes that
      satisfy whichever rule is chosen, so a new frontmatter field cannot regress it
- [ ] The two specific rules are named where the writer lives (`title:` quoting; blank line
      after the closing `---`), and the fix keeps `arggon validate` and the frontmatter tests
      green — quoting must not change frontmatter semantics
- [ ] `npm test` green, `npm run build` ok, prettier clean on files touched

## Notes
