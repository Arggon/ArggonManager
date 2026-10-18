---
type: bug
status: todo
id: bug-frontmatter-scalar-field-accepts-list
title: "Frontmatter fields are not type-checked: a list in a scalar field (title, status, id, parent, assignee, branch) is silently comma-joined"
parent: story-tracker-hygiene
labels: [tracker-schema, cli]
created: "2026-10-18"
updated: "2026-10-18"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-frontmatter-scalar-field-accepts-list.md
  Leaves live only under a story. id is the filename stem: bug-frontmatter-scalar-field-accepts-list.
  CLI `arggon create bug frontmatter-scalar-field-accepts-list` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Frontmatter fields are not type-checked: a list in a scalar field (title, status, id, parent, assignee, branch) is silently comma-joined

## Context

Filed by the delivery lead from the standards review of PR #862
(`bug-update-depends-on-multiline-rejected`, finding F2 — explicitly
non-blocking; a pre-existing class that PR only extended by one shape).

The frontmatter reader is **key-agnostic**: it decides a value is a list by
shape, never by which field it is. A list in a scalar field therefore loads as
an array, and `stringField` (`lib/src/items.ts:277`) silently coerces it with
`String([...])` → `"a,b"`, with **no** `arggon validate` error. This is not
introduced by PR #862: `title: [a, b]` on a single line already produced
`"a,b"` on `main`; the PR only extended the same gap to one more shape (an
indented block list after a scalar key).

Consequence: a malformed item silently acquires a wrong field value instead of a
loud refusal, and nothing in the gate chain catches it — the item simply reads
with a corrupted `title`/`assignee`/`branch`.

## Acceptance

- [ ] Frontmatter shape checks are per-field: a list value in a scalar field (`title`, `status`, `id`, `parent`, `assignee`, `branch`, `claimed_at`, `worktree_path`, dates) refuses loudly with an actionable error naming the file and the field
- [ ] `stringField`'s silent array coercion is removed or guarded; a test pins that `title: [a, b]` (single-line) and its wrapped/block variant both refuse rather than silently becoming `"a,b"`
- [ ] The list fields themselves (`labels`, `depends_on`) keep working for every accepted shape (inline, wrapped flow, block) — a regression test pins them so the type check does not break the list grammar
- [ ] `arggon validate` green on the repo tree itself; `npm test` green; PR opened

## Notes
