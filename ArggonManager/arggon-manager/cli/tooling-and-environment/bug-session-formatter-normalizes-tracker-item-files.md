---
type: bug
status: todo
id: bug-session-formatter-normalizes-tracker-item-files
title: "The session's git-root-anchored prettier formatter rewrites tracked markdown, so an item-file edit silently reformats a reviewer's verdict comment (blank lines + `*x*`→`_x_`) and the tracker carries bytes the author never wrote"
parent: tooling-and-environment
labels: [formatter, tracker-schema, tooling]
created: "2026-10-11"
updated: "2026-10-11"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-session-formatter-normalizes-tracker-item-files.md
  Leaves live only under a story. id is the filename stem: bug-session-formatter-normalizes-tracker-item-files.
  CLI `arggon create bug session-formatter-normalizes-tracker-item-files` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The session's git-root-anchored prettier formatter rewrites tracked markdown, so an item-file edit silently reformats a reviewer's verdict comment (blank lines + `*x*`→`_x_`) and the tracker carries bytes the author never wrote

## Context

Observed 2026-10-11 while a maker ticked one checkbox in an item body shortly after the
delivery lead had posted a verdict comment on that same file: the edit also normalised six
blank lines and rewrote `*x*` → `_x_` **inside the lead's comment**, so the tracker carried
bytes the comment's author never wrote.

The maker caught it, proved the mechanism (the same edit on a gitignored copy changed only the
touched line) and rebuilt the commit so the item file's diff was the single checkbox
(`git diff 712844c8 HEAD`). That is the right recovery, but the defect is upstream of it.

Likely cause: this repo's git-root-anchored prettier formatter override — shipped by
`cli/src/init.ts` and pinned by `cli/src/init-opencode.test.ts` — runs on **every** file edit,
including tracker item files under `ArggonManager/**.md`. It was introduced so sibling
worktrees keep their own `.prettierignore`; the side effect on the tracker tree was never
measured. The harm is specific: a review verdict, a decision brief and a dated correction are
all prose whose bytes are the record, and a silently normalised one is no longer the record
its author wrote.

## Acceptance

- [ ] Reproduce it: post an `arggon comment` to an item, then make an unrelated edit to the
      same item file, and show the comment's bytes changing
- [ ] The session formatter leaves tracker item files alone (an ignore for the tracker tree, or
      a carve-out for `ArggonManager/**`), or tracker writes bypass the session formatter
      entirely — pick one and record why
- [ ] The chosen route is proven by a test: a comment's bytes survive a later item-file edit
- [ ] If the fix touches the generated `opencode.jsonc` formatter override,
      `task-formatter-override-template`'s contract and `cli/src/init-opencode.test.ts` are
      updated in the same change, and the methodology impact class (advisory vs behavioral per
      ADR 0016) is stated
- [ ] The git-root anchoring is preserved — it exists so a sibling worktree's files keep their
      own `.prettierignore`, and the fix must not break that
- [ ] `npm test` green, prettier clean, `npm run build` ok

## Notes
