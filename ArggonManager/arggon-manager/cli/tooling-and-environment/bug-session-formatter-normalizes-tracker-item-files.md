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

### 2026-10-18 @arggon-delivery-lead
evidence: live instance reproduced 2026-10-18 while closing `bug-update-depends-on-multiline-rejected` (PR #862)

Probe 5 (run by `arggon-verifier`, on the PR's worktree) reproduces this item's rewrite exactly:

```
cp <item>.md .probe/item-copy.md
npx prettier --write .probe/item-copy.md
diff <(git show 82f19eb2^2:<item>.md) .probe/item-copy.md
```

Observed, in one `prettier --write` on a tracked item file:

1. an inline example **inside a fenced ```yaml block** was reflowed — the fence documented a before/after pair, and the "before" single-line form was rewritten into the "after" wrapped form, destroying the very evidence the item existed to record;
2. a blank line was added after the closing `---`;
3. blank lines were added around the `### <date> @<author>` heading.

That churn is what landed in merge commit `82f19eb2` of PR #862 (the maker resolved the item-file conflict and prettier's formatting came along with it). The standards reviewer blocked on it (finding F1: "a maker must not mutate another writer's recorded note" — the note belonged to the delivery lead, 2026-10-15), and the delivery lead restored the note verbatim in `d825c9f2` — 0 deletions against the pre-merge copy.

Two things this adds to the item:

- the **comment-body** instance in the title is not the only surface: fenced examples inside a note are rewritten too, which is worse, because their content is evidence;
- the trigger is not exotic — any `npx prettier --write <item.md>` on an in-repo path does it. Same probe found prettier skips paths under `/tmp` only because this repo's `.gitignore` line 62 is `/tmp/` and prettier's default `ignorePath` is `[".gitignore", ".prettierignore"]` — not because frontmatter is exempt there. Related: `task-session-formatter-bypasses-prettierignore`.

Evidence for the sibling item `bug-prettier-reflow-breaks-item-frontmatter` (cancelled as a duplicate of `bug-update-depends-on-multiline-rejected`, now fixed parser-side) is in the same probe table on that item.
