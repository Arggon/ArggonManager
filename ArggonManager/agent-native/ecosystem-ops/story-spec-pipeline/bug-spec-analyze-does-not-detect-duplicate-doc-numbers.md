---
type: bug
status: in_progress
id: bug-spec-analyze-does-not-detect-duplicate-doc-numbers
title: "`arggon spec analyze` / `validate` cannot detect two documents sharing one number (ADR 0020 x2, exploration -018 x2, spec/plan -017 x2) — git merges them silently"
assignee: Arggon
branch: fix/bug-spec-analyze-does-not-detect-duplicate-doc-numbers
parent: story-spec-pipeline
labels: [spec-pipeline, adr]
created: "2026-10-02"
updated: "2026-10-02"
claimed_at: "2026-10-02T23:58:10.456Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-spec-analyze-does-not-detect-duplicate-doc-numbers
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

Root cause: `spec validate`'s only duplicate check (`checkUniqueness`, `spec.ts:280-297`) keys on `kind:docId` — the id **inside** each file. Two branches each create a doc numbered `018` under different slugs (`exploration-a-018.md`, `exploration-b-018.md`), their ids differ, both files merge cleanly, and no gate fires. The shared thing is the numeric stem in the **filename**, which only a whole-directory scan can see — so the check cannot live in the per-file pass.

Reproduction (fixture `fixtures/spec-docs-invalid/duplicate-doc-number/` — four colliding pairs, one per docs directory):

- before: `arggon spec validate --json` → `{"errors":[],"warnings":[]}`, exit 0; `arggon spec analyze` → `clean (3 spec(s) scanned)`, exit 0
- after: four warnings `[DOC_NUMBER_COLLISION]` / four findings `[duplicate-doc-number]`, each naming both files, exit 0 on both surfaces

Live on this repo's own corpus too: exploration `-001` ×2, spec `-001` ×2, spec/plan `-015` ×2 (`arggon spec validate` now reports all five — report-only, exit 0). Renumbering them is separate work, deliberately not in this PR.

## Acceptance

- [x] A number collision is detected: at minimum for ADR, exploration, spec and plan directories, given the same numeric stem under two different slugs
- [x] Report-only first (consistent with `spec analyze`'s contract): a clear finding naming both files, never an edit; a blocking gate only if it proves low-noise, same rule as C2 in exploration-014
- [x] The finding survives a merge — i.e. it is a whole-directory scan, not a per-file uniqueness check keyed on `kind:docId` (read `spec.ts:280-297` for the current approach and its limit)
- [x] A fixture with a duplicate-number pair asserts the finding (the repo convention is one failing fixture per layout rule)
- [x] `docs/agents.md` / the spec pipeline section documents the collision rule, so an author numbering a doc picks the next FREE number rather than assuming the last one is taken

## Notes
