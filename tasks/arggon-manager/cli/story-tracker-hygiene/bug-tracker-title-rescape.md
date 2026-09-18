---
type: bug
status: in_progress
id: bug-tracker-title-rescape
title: Tracker serializer doubles backslashes in quoted titles on every mutation
assignee: Arggon
branch: fix/bug-tracker-title-rescape
parent: story-tracker-hygiene
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T22:26:56.651Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-tracker-title-rescape
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/bug-tracker-title-rescape.md
  Leaves live only under a story. id is the filename stem: bug-tracker-title-rescape.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Tracker serializer doubles backslashes in quoted titles on every mutation

## Context

F4 from the PR #358 review. A YAML double-quoted `title` containing literal
backslashes is re-escaped on every CLI mutation: raw counts on
`task-opencode2-plugin-escape-nits.md` grew 4 → 32 (claim) → 64 (comment) →
128 (comment); `arggon show --json` reports 128; `arggon validate` stays clean,
so the corruption is silent and compounds. Repro: create an item whose title
contains `\\(` (or any literal backslash), then run `comment`/`update` twice and
count the raw backslashes in the frontmatter.

## Acceptance

- [ ] The serializer round-trips a double-quoted title byte-stably across
      `create`/`claim`/`comment`/`update` (no accumulation; idempotent rewrite).
- [ ] Regression test with a backslash-bearing title mutated several times.
- [ ] Restore the corrupted title on `task-opencode2-plugin-escape-nits` (and
      check other items for accidental backslash growth).
- [ ] Full suite, lint, `validate` green; small PR to `opencode2`.

## Notes

- Silent metadata corruption beats loud failures for severity; p2.
