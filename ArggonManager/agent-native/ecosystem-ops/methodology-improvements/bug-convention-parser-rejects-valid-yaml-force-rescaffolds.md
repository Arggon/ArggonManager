---
type: bug
status: in_progress
id: bug-convention-parser-rejects-valid-yaml-force-rescaffolds
title: "`parseConventionConfig`'s strict line-parser rejects valid YAML (`allow-steal: true # armed`, a `post-start: |` block scalar, a quoted top-level key), so `init --force` re-derives the file wholesale and discards the adopter's configuration — the loss is reported, but it should not happen"
assignee: arggon-delivery-lead
branch: fix/bug-convention-parser-rejects-valid-yaml-force-rescaffolds
parent: methodology-improvements
labels: [cli, convention, safety]
created: "2026-10-11"
updated: "2026-10-11"
claimed_at: "2026-10-11T09:06:02.964Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-convention-parser-rejects-valid-yaml-force-rescaffolds
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/bug-convention-parser-rejects-valid-yaml-force-rescaffolds.md
  Leaves live only under a story. id is the filename stem: bug-convention-parser-rejects-valid-yaml-force-rescaffolds.
  CLI `arggon create bug convention-parser-rejects-valid-yaml-force-rescaffolds` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `parseConventionConfig`'s strict line-parser rejects valid YAML (`allow-steal: true # armed`, a `post-start: |` block scalar, a quoted top-level key), so `init --force` re-derives the file wholesale and discards the adopter's configuration — the loss is reported, but it should not happen

## Context

Measured on PR #681's branch (2026-10-11), as the F2 follow-up that review recorded.

`parseConventionConfig` (`lib/src/convention.ts`) is a strict **line** parser: it throws on a
line without a colon and on inline-comment-tainted booleans, among others. A `.convention.yml`
that is perfectly valid YAML but rejected by that parser is classified by `init --force` as
"unreadable or unparseable" and **re-derived from the fixed scaffold** — the adopter's
configuration is discarded. Probed with `x-tracker:\n  allow-steal: true # armed`:

- `--force --dry-run --json` → `rescaffolded: true`, reason "existing .convention.yml
  unreadable or unparseable; re-derived from the scaffold"
- `--force` → the armed `x-tracker` block is gone, and the run says so

PR #681 made that loss **reported** (`rescaffolded: true` on both surfaces, with the wording
corrected to "this arggon cannot read"). What remains is that the loss happens at all: the
wholesale-replace arm should be reserved for files a real YAML parser cannot read either.

## Acceptance

- [x] `parseConventionConfig` accepts a valid-YAML `.convention.yml` carrying an inline
      comment after a boolean value, a block scalar (`post-start: |`) and a quoted top-level
      key — or, where it deliberately refuses, the refusal names the construct
- [x] `init --force` never re-derives a file a real YAML parse can read: the decision is made
      against a real parse (or the parser's tolerance is widened) so the wholesale-replace arm
      is reserved for genuinely unreadable files
- [x] The worst case is pinned by a test: the armed block **survives** a forced re-init under
      each construct above (a negative test for the current behaviour, kept red until fixed)
- [x] Each accepted construct gains a `readConventionConfig` round-trip case, so a future
      tightening cannot silently re-open the loss
- [x] The legal syntax is documented where adopters read it (README /
      `ArggonManager/docs/convention.md`), with the inline-comment case named — it is the one
      an adopter writes naturally
- [x] `npm test` green, `npm run build` ok, `arggon validate` ok

## Notes

### 2026-10-11 @ses_ed5c8dd3effeeiVxpj8Ufcbw4b
## Maker evidence — bug-convention-parser-rejects-valid-yaml-force-rescaffolds

Decision: **widen the line parser**, not add a YAML dependency. The repo ships
`commander` + `@arggondev/lib`; a new runtime dep needs justification per the
review bar's security/scalability rows, and the honest cheaper route is to read
the constructs a real YAML read handles without judgement. No new dependency.

### What `parseConventionConfig` (lib/src/convention.ts) now accepts

- **Inline comment after a boolean** — `allow-steal: true # armed` is the
  boolean `true`. `stripInlineComment` applies YAML's own rule: a `#` starts a
  comment at the start of a line or after whitespace, never inside a quoted
  scalar and never with no whitespace in front of it. Same for string values
  (`post-start: npm ci # install` → `npm ci`), and a comment straight after the
  colon comments out the value (`x-tracker: # hygiene` still opens a mapping).
- **Block scalar** — `post-start: |` / `>` with chomping (`-`/none/`+`) and an
  explicit indentation indicator in either order. The block's lines are
  consumed by the parser, so a `#` or a `:` inside them is content, never a
  comment or a nested key. The decoded text is LITERAL (never re-read as a
  quoted scalar). Block ends at the first line at or below the key's indent.
- **Quoted key** — `"x-tracker":` is `x-tracker`; decoded wherever a key is read,
  nested keys included (`'allow-steal':`, `"bug":`).

### What deliberately stays refused (and now names the construct)

Every boolean option still matches the **raw** token — comment stripped, still
quoted — so these remain parse errors: `allow-steal: "true"`, `'true'`,
`maybe`, `yes`, `on`, `1`, `"30"` (`max-age-days`), `acknowledged: "true"`.
Reading an arming flag out of a string is how an armed gate reads as unset, so
that strictness is a safety property, not a limitation. Flow style, anchors,
aliases and tags are valid YAML this reader does not handle; the refusal names
the construct (`this parser reads BLOCK style only — flow style { }, anchors
(&id), aliases (*id) and tags (!!tag) are not supported`).

### `init --force`

`conventionScaffoldBase` is unchanged: the decision is still "does
`parseConventionConfig` throw". With the parser widened, the three named
constructs no longer throw, so the wholesale-replace arm is now reserved for
files no line parser can read. `topLevelSections` decodes a quoted section name
so the report cannot under-promise about a section it really did keep.
PR #681's preservation behaviour is intact; `convention: { preserved, replaced,
rescaffolded }` still tells the truth.

### Gates (command / expected / observed / exit)

| Gate | Expected | Observed | Exit |
|---|---|---|---|
| `npm test` | green (baseline 134 files / 2866 tests) | **134 files / 2888 tests passed**, 94.8 s | 0 |
| `npm run build` | ok | ok (43 modules inlined → index.bundle.ts) | 0 |
| `npx prettier --check` on 6 touched files | clean | "All matched files use Prettier code style!" | 0 |
| `npm run lint` | silent, ok | silent | 0 |
| `npm run arggon -- validate` | ok | `arggon validate: ok (0 warning(s), convention v5)` | 0 |

### Negative-test evidence (kept red until fixed)

On the pre-fix kernel, the new suite was **19 failed / 91 passed**:
- 14 × `valid-YAML tolerance (bug-convention-parser-rejects-valid-yaml-force-rescaffolds)`
  in cli/src/convention.test.ts — each refused construct, plus the two
  red-kept cases for `still refuses what it cannot read` and
  `keeps every strictness that protects an arming flag`.
- 6 × `a forced re-init keeps the adopter's configuration under …` /
  `the CLI apply path preserves it too, under …` in cli/src/init.test.ts — the
  armed block was re-derived from the scaffold and GONE from disk.
The pre-fix characterization test that asserted `rescaffolded: true` for the
inline-comment file was replaced by a survival test, and its
`not a convention file` fixture (no colon anywhere — genuinely unreadable)
carries the wholesale-replace arm.

### Notes for the reviewer

- `opencode/plugins/arggon/index.bundle.ts` is regenerated (it inlines
  lib/src) — required by the `plugin-copy.test.ts` parity gate, no behavioural
  change to the native seam.
- A YAML 1.1 `yes`/`on` boolean is still refused on purpose (documented in
  convention.md): arming from it would read a flag out of a string.
- Known residual, NOT fixed (out of this item's scope, reported not fixed):
  an `x-*: {flow: style}` section is refused by name, and
  `branch_patterns: {bug: "fix/{id}"}` likewise; the adopter must use block
  style. Anything that throws is reported by `init --force` rather than
  silently dropped, which is the PR #681 contract.
