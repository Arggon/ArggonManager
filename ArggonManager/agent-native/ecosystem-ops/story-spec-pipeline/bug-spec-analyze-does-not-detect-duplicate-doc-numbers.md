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

### 2026-10-03 @Arggon
Implementation complete — PR #603 (branch `fix/bug-spec-analyze-does-not-detect-duplicate-doc-numbers`, rebased on `origin/main` = bcc9baf3, no force-push). Item left `in_progress` for the coordinator to close after merge.

## Root cause confirmed (as the reviewer diagnosed)

`checkUniqueness` (`cli/src/spec.ts:280-297`) keys on `${kind}:${docId}` — the id **inside** the file. Two files with different slugs and the same number have different ids, so nothing fires; git then merges both. The shared thing is the numeric stem in the **filename**, so the check is now a whole-directory scan over `docs/{adr,explorations,specs,plans}`.

## Before/after on one fixture (`fixtures/spec-docs-invalid/duplicate-doc-number/`, 4 pairs + digit-slug controls)

| | expected | observed |
| --- | --- | --- |
| before `spec validate --json` | no rule exists → clean | `{"errors":[],"warnings":[]}`, exit 0 |
| before `spec analyze` | no rule exists → clean | `clean (3 spec(s) scanned)`, exit 0 |
| after `spec validate` | 1 warning per pair, exit 0 | 4 × `[DOC_NUMBER_COLLISION]`, each naming BOTH files; `arggon spec: ok (5 doc(s), 4 warning(s))`, exit 0 |
| after `spec analyze` | 1 finding per pair, exit 0 | 4 × `[duplicate-doc-number]`, same message text; `4 finding(s) across 3 spec(s) — report only, nothing was edited`, exit 0 |

Digits-in-slug guard, proven by the fixture: `plan-sync-2-003.md` is read as **003** and collides with `plan-deps-003.md`, while `spec-phase-2-009.md` (009, unique) and `0021-gamma.md` produce no finding. `adr/README.md`, the committed `*.json` baseline snapshot and unnumbered drafts match nothing.

## Three calls I made (the item said "at minimum" / "make the call")

1. **Both `spec analyze` and `spec validate`, not `arggon validate`.** `arggon validate` is the tracker-tree validator in `@arggondev/lib` and has never read `docs/`; a docs scan there would smuggle a package-surface + adopter-CI change into a bug fix. `spec validate` (docs-facing, CI-recipe in `docs/ci.md`) and `spec analyze` (report-only pipeline gate) share ONE rule and ONE message builder — code `DOC_NUMBER_COLLISION` vs finding kind `duplicate-doc-number`, so the two surfaces cannot drift in wording. Both corpus-mode only (a single `--file` cannot decide a collision); the analyze finding lives in the `consistency` bucket (corpus-wide cross-document property), leaving `decisions` scoped to the ADR-0017 decision flow.
2. **Report-only, no blocking gate** (exploration-014 C2's rule). It is *not* yet low-noise on this repo: the corpus has 5 live collisions (below), so a gate would fire on every commit until the tree is renumbered. If a gate is wanted, it should land after the renumbering — that is the coordinator's call, not mine.
3. **`spec new` now reads its next number through the same convention table**, so scaffolder and detector cannot drift (`nextDocNumber` previously guessed any `-NNN.md` suffix).

## Two things that ESCAPED this item — decisions needed

1. **5 live collisions in this repo's own corpus**, now reported by `arggon spec validate` (exit 0, warnings only): exploration `-001` ×2 (`exploration-cheap-path-to-prod-001` / `exploration-token-context-efficiency-001`), spec `-001` ×2 (`spec-deps-001` / `spec-sync-001`), spec `-015` ×2 (`spec-release-pipeline-015` / `spec-update-channel-015`), plan `-001` ×2 and plan `-015` ×2. Fixing them = renaming 10 files + every citation (ADR links, `spec_id`s, plan `spec:` pointers, item bodies). Deliberately NOT in PR #603 — a follow-up item needs filing (coordinator's call; I did not file one).
2. **Knock-on for `story-release-pipeline`:** the committed wave baseline `ArggonManager/docs/specs/spec-analyze-baseline-release-pipeline-015.json` now reads those 5 as NEW findings, so that story's next `--baseline` wave would exit 1. Remedies: `--no-fail-on-new` for the wave, or re-baseline after the renumbering. I left the file untouched on purpose — rewriting another story's baseline would hide real corpus drift from it.

## Gates (post-rebase, all green)

`npm run build` · `npm test` → 119 files / 2203 tests · `npm run lint` · `npm run arggon -- validate` → ok (0 warnings) · `npm run arggon -- spec validate` → ok, 5 warnings (the live collisions) · `npm run check:plugin` → clean. The bundle is built from `opencode/plugins/arggon/index.ts` + `lib/src/index.ts`, so the CLI-only `spec.ts` cannot drift it; I never hand-edited `index.bundle.ts`. `npm run skills:sync` → no-op (tree stayed clean), so `skills/arggon-cli/` ↔ `.agents/skills/arggon-cli/` remain byte-equal.

**Methodology impact: behavioral** (new report-only check + a rule agents must follow — pick the next FREE number), stated in the PR per `docs/agents.md` §Changing the methodology itself, with the ADR 0016 adopter-upgrade reference.

**Tracker-write hazard check:** every tracker write went through `npm run arggon -- …` with the worktree as cwd. The primary checkout (`/home/arggon/Projects/ArggonManager`) is on `main`, working tree clean, and carries neither of my commits — nothing escaped.

### handoff 2026-10-03 @Arggon — next: Review + merge PR #603 (branch fix/bug-spec-analyze-does-not-detect-duplicate-doc-numbers, rebased on origin/main bcc9baf3); then decide on the follow-up item for the 5 live doc-number collisions in …
- branch: fix/bug-spec-analyze-does-not-detect-duplicate-doc-numbers
- open questions: File a renumbering item for the 5 live collisions (exploration -001, spec -001/-015, plan -001/-015)?; story-release-pipeline baseline now sees 5 NEW findings — re-baseline or --no-fail-on-new?; bloc…
