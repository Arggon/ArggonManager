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

- [x] The serializer round-trips a double-quoted title byte-stably across
      `create`/`claim`/`comment`/`update` (no accumulation; idempotent rewrite).
- [x] Regression test with a backslash-bearing title mutated several times.
- [x] Restore the corrupted title on `task-opencode2-plugin-escape-nits` (and
      check other items for accidental backslash growth).
- [x] Full suite, lint, `validate` green; small PR to `opencode2`.

## Notes

- Silent metadata corruption beats loud failures for severity; p2.

### 2026-09-18 @Arggon

### Root cause

`parseScalar` returned the inner bytes of a double-quoted YAML scalar verbatim while `formatScalar` serializes with `JSON.stringify`. Every full-file write (create/claim/comment/update all call `stringifyFrontmatter`) re-escaped the existing backslashes, so the raw count doubled per mutation. `validate` parsed through the same path, so it stayed clean while the value drifted silently.

### Fix

- `parseScalar` now decodes the YAML 1.2 double-quoted escape set (a superset of JSON; unknown escapes and a trailing lone backslash are preserved, never throw) and single-quoted `''`.
- `formatScalar` now quotes backslash-bearing values too, so a double-quoted input stays double-quoted and byte-identical instead of silently degrading to a plain scalar.

### Evidence (raw `title:` backslashes)

- Serializer, 4 consecutive rewrites of a quoted `\\(` title: OLD 2 -> 4 -> 8 -> 16 -> 32; NEW 2 -> 2 -> 2 -> 2 -> 2.
- Scratch adopter tree through the CLI (create / claim / comment / comment / update): 4 -> 4 -> 4 -> 4 -> 4.
- Real item `task-opencode2-plugin-escape-nits` git history: 4 (create, 0a88214) -> 32 (claim) -> 64 -> 128 -> 512 (done flip). Restored to the create-commit title (`escaped \\( in command position + unbalanced quoted paths correlate`) with `arggon update --title`: 512 -> 4, restore commit c539c83.

### Scan

Parsed all 246 tracker `*.md` files with the fixed parser: exactly one backslash-corrupted value, the `task-opencode2-plugin-escape-nits` title (256 decoded backslashes), now restored. No other item shows accidental growth.

### Regression tests

`cli/src/frontmatter.test.ts` (6 tests): quoted-scalar decode, full YAML escape set, single-quote `''`, byte-stable rewrite, an already-corrupted value no longer grows, and a kernel create/claim/comment/comment/update regression with raw-frontmatter assertions + validate green.

### Follow-up finding

`cli/src/convention.ts` has the same write-escapes/read-raw asymmetry for `.convention.yml` scalars (`yamlQuote` vs `stripQuotes`); filed as `bug-convention-config-scalar-unescape` (no live value affected, latent only). Not fixed here: different file ownership.

### Gates

Full suite 76 files / 1268 tests green (private TMPDIR), `lint`, `build`, `arggon validate` (0 warnings), `arggon spec validate` (16 docs, 0 warnings) all green.
