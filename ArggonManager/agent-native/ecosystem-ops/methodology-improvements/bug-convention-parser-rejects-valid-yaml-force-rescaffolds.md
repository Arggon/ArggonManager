---
type: bug
status: todo
id: bug-convention-parser-rejects-valid-yaml-force-rescaffolds
title: "`parseConventionConfig`'s strict line-parser rejects valid YAML (`allow-steal: true # armed`, a `post-start: |` block scalar, a quoted top-level key), so `init --force` re-derives the file wholesale and discards the adopter's configuration — the loss is reported, but it should not happen"
parent: methodology-improvements
labels: [cli, convention, safety]
created: "2026-10-11"
updated: "2026-10-11"
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

- [ ] `parseConventionConfig` accepts a valid-YAML `.convention.yml` carrying an inline
      comment after a boolean value, a block scalar (`post-start: |`) and a quoted top-level
      key — or, where it deliberately refuses, the refusal names the construct
- [ ] `init --force` never re-derives a file a real YAML parse can read: the decision is made
      against a real parse (or the parser's tolerance is widened) so the wholesale-replace arm
      is reserved for genuinely unreadable files
- [ ] The worst case is pinned by a test: the armed block **survives** a forced re-init under
      each construct above (a negative test for the current behaviour, kept red until fixed)
- [ ] Each accepted construct gains a `readConventionConfig` round-trip case, so a future
      tightening cannot silently re-open the loss
- [ ] The legal syntax is documented where adopters read it (README /
      `ArggonManager/docs/convention.md`), with the inline-comment case named — it is the one
      an adopter writes naturally
- [ ] `npm test` green, `npm run build` ok, `arggon validate` ok

## Notes
