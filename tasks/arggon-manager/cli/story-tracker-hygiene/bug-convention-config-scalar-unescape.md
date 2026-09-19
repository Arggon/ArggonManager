---
type: bug
status: done
id: bug-convention-config-scalar-unescape
title: Convention config scalar parsing leaves backslashes raw (x-generated.projectName doubles on rewrite)
assignee: Arggon
branch: fix/bug-convention-config-scalar-unescape
parent: story-tracker-hygiene
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-19"
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

- [x] `stripQuotes` decodes double-quoted YAML escapes (share the
      `frontmatter.ts` unescape helper if it is exported, or mirror it) and
      single-quoted `''`.
- [x] `yamlQuote`/`stripQuotes` round-trip a backslash-bearing project name
      byte-stably across repeated init/upgrade serializations; regression test
      with raw-file assertions.
- [x] Suite, lint, validate green; small PR to `opencode2`.

## Notes

- Follow-up from the F4 fix PR (`bug-tracker-title-rescape`); the tracker
  frontmatter path (`cli/src/frontmatter.ts`) is fixed there.
- Audit on 2026-09-18 found no live `.convention.yml` value with backslashes;
  nothing to restore, only the latent writer/parser asymmetry.

### 2026-09-18 @Arggon
Worker evidence — fix implemented, gates green, draft PR next.

**Root cause (confirmed):** `stripQuotes` returned the inner text of quoted `.convention.yml` scalars verbatim while `yamlQuote` re-escaped backslashes/quotes on every write, so any quoted scalar with a backslash doubled on each init/upgrade rewrite.

**Fix (`cli/src/convention.ts`):** reads decode the YAML 1.2 double-quoted escape set (mirrored from the private `frontmatter.ts` helper — it is not exported and that file is out of scope; unknown escapes and a trailing lone backslash are preserved, never throw) and un-double single-quoted `''`. `yamlQuote` now uses `JSON.stringify` plus explicit YAML escapes for DEL/U+2028/U+2029, so control characters (e.g. a decoded `\n`) can no longer split the line-oriented section.

**Before → after (raw backslash counts in the `projectName:` line, repro script):**

| case                                                                  | before                                                      | after                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| writer emits `a\b` (1 literal backslash), then init read/write cycles | 2 -> 4 -> 8 (doubles each cycle; parse returned 2 literals) | 2 -> 2 -> 2 (parse returns 1 literal)            |
| rewrite of an already-doubled file (4 raw backslashes)                | 4 -> 8 -> 16                                                | 4 -> 4 (decodes to 2 literals)                   |
| value containing a literal newline                                    | file corrupt (raw newline inside quotes; re-parse throws)   | writes `\n`, parses back to newline, byte-stable |

**Latent-only note:** audit confirms no live `.convention.yml` scalar carries backslashes (this repo records `projectName: "ArggonManager"`); nothing to restore, only the writer/parser asymmetry.

**Tests (`cli/src/convention.test.ts`, +7):** full escape set including `\\`, `\"`, `\n`, `\x`/`\u`, unknown escapes, trailing lone backslash, single-quote `''`; decoding for branch_patterns/x-views/x-worktree/x-import scalars; writer raw-file round-trip; already-corrupted value no-growth; repeated init rewrite byte-stable with raw-file assertions.

**Gates:** full suite 76 files / 1285 tests passed (private TMPDIR); eslint clean; tsc build clean; `arggon validate` ok (no errors/warnings); `arggon spec validate` ok (16 docs, 0 warnings).

### 2026-09-18 @Arggon
Draft PR open for review: https://github.com/Arggon/ArggonManager/pull/364 (base `opencode2`, draft, not merged). Gates green on merged HEAD; no status flip by the worker.

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; the decoder is textually and behaviorally identical to the merged frontmatter reference (437-case parity fuzz, 0 mismatches), ASCII rewrites are byte-identical across all 38 in-repo configs (parse/writer/idempotency diffs 0), the latent-only claim verified, and all 8 new tests fail against the pre-fix implementation; gates 1285 + CI pass; merged. Counts corrected (+8 tests, 1285). Closing.
