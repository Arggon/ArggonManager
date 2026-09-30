---
type: bug
status: in_progress
id: bug-frontmatter-ambiguous-plain-scalar-loss
title: Frontmatter loses YAML-ambiguous plain scalars
assignee: Arggon
branch: fix/bug-frontmatter-ambiguous-plain-scalar-loss
parent: story-tracker-hygiene
labels: [testing, kernel, property-based]
priority: p2
created: "2026-09-29"
updated: "2026-09-30"
claimed_at: "2026-09-30T23:56:00.008Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-frontmatter-ambiguous-plain-scalar-loss
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-frontmatter-ambiguous-plain-scalar-loss.md
  Leaves live only under a story. id is the filename stem: bug-frontmatter-ambiguous-plain-scalar-loss.
  CLI `arggon create bug frontmatter-ambiguous-plain-scalar-loss` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Frontmatter loses YAML-ambiguous plain scalars

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-29 @Arggon
Found by the kernel property suite added in `task-fast-check-invariant-properties`
(`lib/src/frontmatter.property.test.ts`), not by an example: a plain YAML scalar
that resolves to a NON-STRING is written verbatim and read back as that type, so
a string that happens to look like a null or an integer loses its text on the very
first read, and the next write bakes the loss into the file.

## Reproduction (through the real product path)

```bash
arggon create task "0123" --parent <story>   # writes  title: 0123
arggon show <id>                              # title: "123"   <- already wrong
arggon update <id> --labels probe             # rewrites the file as  title: 123
```

Same loss, measured through the kernel (`runCreate` -> `runShow` -> `runUpdate`):

| written title          | first read                              | after the next write                              |
| ---------------------- | --------------------------------------- | ------------------------------------------------- |
| `0123`                 | `123`                                   | `title: 123`                                      |
| `007`                  | `7`                                     | `title: 7`                                        |
| `-007`                 | `-7`                                    | `title: -7`                                       |
| `-0`                   | `0`                                     | `title: 0`                                        |
| `9007199254740993`     | `9007199254740992` (2^53+1)             | `title: 9007199254740992`                         |
| `12345678901234567890` | `12345678901234567000`                  | `title: 12345678901234567000`                     |
| `null` / `~`           | field GONE (`stringField` -> undefined) | unchanged, and `arggon validate` reports no error |

The same loss reaches any value the convention already accepts: a numeric-only id
or label (`ID_PATTERN` / `LABEL_PATTERN` accept `06`), an `x-*` pass-through
extra, a `depends_on` element, a branch-name segment, a `worktree_path` segment.
`title: true` / `title: false` keep their text through `stringField` but change
type, which is visible in `extras` (`x-foo: "true"` parses as a boolean).

## Root cause

`formatScalar` (lib/src/frontmatter.ts) quotes a value when it contains a
character from `/[... : # { } [ ] , & * ? ! ' " \\]/`, has leading/trailing
whitespace, or is empty — but NOT when the value is itself a token the reader
resolves to a non-string. `parseValue` / `parseScalar` then decode
`null` and `~` -> null, `true` / `false` -> boolean, `/^-?\d+$/` -> `Number()`.
This is the same class as `bug-tracker-title-rescape` (which taught the writer to
quote backslashes and control characters): the writer has to quote anything the
reader would decode as a different type.

## Acceptance

- [ ] `stringifyFrontmatter` quotes every plain scalar that `parseValue` would
      decode to a non-string, so `parse(stringify(v))` returns the identical
      string. Minimal fix: extend the `formatScalar` force-quote predicate with
      `/^(?:~|null|true|false|-?\d+)$/`.
- [ ] Leading-zero, `-0` and > 2^53 integer strings, plus `null` and `~`, survive
      parse -> serialize -> parse byte-identically (an example-based test per
      concrete token, or the property canary below updated in the same change).
- [ ] `parseFrontmatter` keeps tolerating files already written with a bare token
      (no hard break for existing trees); the fix is writer-side only.
- [ ] The `isRotationWithOneDuplicate`-style canary in
      `lib/src/frontmatter.property.test.ts` ("frontmatter ambiguous scalar") is
      updated together with the fix — its pinned expectations encode today's loss.
- [ ] Decide explicitly whether `true` / `false` are quoted too: their text is
      preserved today, but the parsed value changes type, which matters for
      `x-*` pass-through extras.

## Property evidence

- Property "frontmatter round-trip" is asserted over a documented domain where
  every free-text carrier and id/label token contains at least one ASCII letter
  (so it can never be a bare YAML null/number token). It passed 20 000 runs.
- The excluded class is NOT hidden: the sibling property "frontmatter ambiguous
  scalar" pins today's exact mapping token by token, and the run log reports
  `frontmatter ambiguous scalar: 25 runs, seed 20260928`.
- Replay: `ARGGON_PROPERTY_SEED=20260928 ARGGON_PROPERTY_RUNS=25 npm run test:property`.
