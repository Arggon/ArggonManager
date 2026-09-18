---
type: bug
status: in_progress
id: bug-convention-config-scalar-unescape
title: Convention config scalar parsing leaves backslashes raw (x-generated.projectName doubles on rewrite)
assignee: Arggon
branch: fix/bug-convention-config-scalar-unescape
parent: story-tracker-hygiene
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T22:49:57.652Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-convention-config-scalar-unescape
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tracker-hygiene/bug-convention-config-scalar-unescape.md
  Leaves live only under a story. id is the filename stem: bug-convention-config-scalar-unescape.
  CLI `arggon create bug convention-config-scalar-unescape` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Convention config scalar parsing leaves backslashes raw (x-generated.projectName doubles on rewrite)

## Context

Same class as `bug-tracker-title-rescape`, found while fixing it (2026-09-18)
and deliberately NOT fixed there (different file ownership).

`cli/src/convention.ts` mirrors the hand-rolled YAML handling of the tracker:
`yamlQuote` (line ~527) writes `"..."` with backslash escaping, but
`stripQuotes` (line ~164) returns the inner text verbatim — no unescape. So a
`x-generated.projectName` (or any quoted `.convention.yml` scalar) containing a
literal backslash is re-escaped on every init/upgrade rewrite: 2 raw -> 4 -> 8
-> 16, silently. Today project names rarely contain `\`, so this is latent
severity, but it is the same silent-compounding corruption and the same
one-line root cause.

Repro sketch: write `x-generated:\n  projectName: "a\\\\b"` into
`tasks/.convention.yml`, run `arggon init` twice, count raw backslashes in the
projectName line; each run doubles them.

## Acceptance

- [ ] `stripQuotes` decodes double-quoted YAML escapes (share the
      `frontmatter.ts` unescape helper if it is exported, or mirror it) and
      single-quoted `''`.
- [ ] `yamlQuote`/`stripQuotes` round-trip a backslash-bearing project name
      byte-stably across repeated init/upgrade serializations; regression test
      with raw-file assertions.
- [ ] Suite, lint, validate green; small PR to `opencode2`.

## Notes

- Follow-up from the F4 fix PR (`bug-tracker-title-rescape`); the tracker
  frontmatter path (`cli/src/frontmatter.ts`) is fixed there.
- Audit on 2026-09-18 found no live `.convention.yml` value with backslashes;
  nothing to restore, only the latent writer/parser asymmetry.
