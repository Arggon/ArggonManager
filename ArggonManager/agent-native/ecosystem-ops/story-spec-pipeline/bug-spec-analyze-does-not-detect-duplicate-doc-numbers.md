---
type: bug
status: todo
id: bug-spec-analyze-does-not-detect-duplicate-doc-numbers
title: "`arggon spec analyze` / `validate` cannot detect two documents sharing one number (ADR 0020 x2, exploration -018 x2, spec/plan -017 x2) — git merges them silently"
parent: story-spec-pipeline
labels: [spec-pipeline, adr]
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/story-spec-pipeline/bug-spec-analyze-does-not-detect-duplicate-doc-numbers.md
  Leaves live only under a story. id is the filename stem: bug-spec-analyze-does-not-detect-duplicate-doc-numbers.
  CLI `arggon create bug spec-analyze-does-not-detect-duplicate-doc-numbers` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `arggon spec analyze` / `validate` cannot detect two documents sharing one number (ADR 0020 x2, exploration -018 x2, spec/plan -017 x2) — git merges them silently

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

- [ ] A number collision is detected: at minimum for ADR, exploration, spec and plan directories, given the same numeric stem under two different slugs
- [ ] Report-only first (consistent with `spec analyze`'s contract): a clear finding naming both files, never an edit; a blocking gate only if it proves low-noise, same rule as C2 in exploration-014
- [ ] The finding survives a merge — i.e. it is a whole-directory scan, not a per-file uniqueness check keyed on `kind:docId` (read `spec.ts:280-297` for the current approach and its limit)
- [ ] A fixture with a duplicate-number pair asserts the finding (the repo convention is one failing fixture per layout rule)
- [ ] `docs/agents.md` / the spec pipeline section documents the collision rule, so an author numbering a doc picks the next FREE number rather than assuming the last one is taken

## Notes
