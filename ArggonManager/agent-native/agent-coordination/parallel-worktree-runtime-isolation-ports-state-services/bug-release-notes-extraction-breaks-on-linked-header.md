---
type: bug
status: done
id: bug-release-notes-extraction-breaks-on-linked-header
title: "release.yml's CHANGELOG notes extraction cannot match release-please's linked header, stranding the release after the tag"
assignee: Arggon
branch: fix/bug-release-notes-extraction-breaks-on-linked-header
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [release, ci]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
worktree_path: /home/arggon/Projects/ArggonManager-bug-release-notes-extraction-breaks-on-linked-header
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/bug-release-notes-extraction-breaks-on-linked-header.md
  Leaves live only under a story. id is the filename stem: bug-release-notes-extraction-breaks-on-linked-header.
  CLI `arggon create bug release-notes-extraction-breaks-on-linked-header` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# release.yml's CHANGELOG notes extraction cannot match release-please's linked header, stranding the release after the tag

## Context

<!-- What went wrong / how to reproduce. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator — the first fully-automated release, stranded after the tag
`v0.5.0` (PR #556, squash `13d72f5f`) failed in `release.yml` at the "GitHub Release … notes" step:

```
CHANGELOG.md has no '## [0.5.0]' section - the merged release section is the notes source; refusing to create an empty release
```

Root cause: the step builds `pattern="^## \\[${VERSION//./\\.}\\]"` and matches it with `awk '$0 ~ pat'`. The merged header is release-please's LINKED form — `## [0.5.0](https://github.com/…/compare/arggon-manager-v0.4.1...arggon-manager-v0.5.0) (2026-10-02)` — and the pattern anchors to the closing `]` with nothing allowed after it, so a linked header never matches. The published 0.4.1 section used the plain `## [0.4.1] - 2026-10-01` form, and 0.4.1 shipped through the retired MANUAL path, so this awk had never run against a release-please header before. Fails CLOSED (good) but after the tag step, which is the expensive place to fail.

State right now: the annotated tag `v0.5.0` exists and peels to the release commit (the guard's rule-1 path completed the tag + lockstep agreement); no GitHub Release object, nothing published to npm (`npm view arggon-manager@0.5.0` → 404). The re-run path cannot fix it: a re-run uses the workflow definition at the run's own commit (the broken one), and the guard has no rule that re-enters a release for a commit whose version is unchanged (rule 0) or whose tag already names it (rule 2) — so the remaining steps need the documented operator exception, which I am running now (release object with the curated notes, then pack/inspect/publish lib → CLI, tarballs attached, build-info stamped for `13d72f5f`).

## Acceptance
- [x] Replace the inline awk with a testable extractor that matches the section by its `## [V]` prefix regardless of what follows (linked or plain), and call it from the workflow; unit tests cover the linked header, the plain header, a missing section (still fails loudly, no empty release) and the stop-at-the-next-`## `-heading rule. Evidence: `cli/src/release-notes.ts` (exports `extractReleaseSection` / `resolveVersion`, `--check` / `--write` / `--version`); `release.yml` now calls it (`npx tsx cli/src/release-notes.ts`) instead of the awk. `cli/src/release-notes.test.ts` — 7 cases: release-please's LINKED header (the exact shape that broke 0.5.0), the plain `## [V] - date` header, stop-at-next-`## `-heading with nested `###` kept and the FOLLOWING release still extractable, fail-closed on missing/empty/absent (`null`), the `0.4.10` vs `0.4.1` prefix trap, version resolution from the root package, and the repository CHANGELOG itself (every released header must yield a non-empty section). Live: `--check` on this repo reports `0.5.0 section ok (106 lines)`; `--version 9.9.9` fails closed and lists the headers it did find.
- [x] Order: extract + validate the notes BEFORE the tag step, so a notes problem can never strand a published tag again (the fail-closed behavior stays; only its position moves). Evidence: a new `Validate the CHANGELOG section for V BEFORE tagging` step sits between the guard and `Create the annotated tag` (release.yml), gated on the same `steps.guard.outputs.release == 'true'`, running `--check` (reads, writes nothing, exits non-zero on a missing/empty section). `actionlint` clean on the edited workflow.
- [x] Record the manual completion of 0.5.0 in release.md as the first entry under the operator's exceptions, with the exact commands, so the next operator has the path. Evidence: `release.md` §"Exception: the release run dies after the tag (worked example: 0.5.0)" — the guard's rule-0/rule-2 reasoning (why the automation cannot re-enter), then the five steps exactly as performed: extract notes with the new module (`npx tsx cli/src/release-notes.ts --write …`), `gh release create` with the notes file, build in a detached worktree AT THE TAG so `build-info` names `13d72f5f`, pack both (mkdir first) + `inspect-tarballs.mjs`, publish kernel-then-CLI with the propagation poll (never re-publish), attach both tarballs, remove the worktree. Also records what actually happened on 2026-10-02 and that the fix lives in the same PR.

### 2026-10-02 @Coordinator
### 2026-10-02 @Coordinator
verdict: approve — the fix does the three things the item asked for, and the third one is what actually protects the next release. (1) The extraction is a tested module (`cli/src/release-notes.ts`, 7 cases) matching the section by its `## [V]` PREFIX, so release-please's linked header (the exact shape that broke v0.5.0) and the plain `## [0.4.1] - 2026-10-01` form both work; the `0.4.10` vs `0.4.1` prefix trap is pinned too, since prefix matching invites exactly that mistake. (2) `Validate the CHANGELOG section for V BEFORE tagging` now runs between the guard and `Create the annotated tag` — a notes problem can no longer strand a published tag, which is the actual cost of the incident (tag pushed, no release object, nothing on npm, and the guard unable to re-enter: rule 0 version unchanged, rule 2 needs a re-run of the same push i.e. the same broken workflow file). (3) release.md carries the operator path as a worked 0.5.0 example, including the detail that matters: build in a detached worktree AT THE TAG so `dist/build-info.json` names `13d72f5f` rather than main's head.

Implementation note for the record: the module is TypeScript under `cli/src/` (not a standalone `.mjs`) so the repo's typecheck covers it and the workflow invokes it through `tsx` like the repo's other scripts — the first cut as `cli/release-notes.mjs` failed the typecheck gate exactly as intended. Gates: 2154 green / 118 files, lint, build, check:plugin exit 0, actionlint clean on the edited workflow, prettier clean, validate ok (0 warnings), CI green. Live: `--check` reports `0.5.0 section ok (106 lines)`, `--version 9.9.9` exits non-zero and lists the headers it did find.

Merged: PR #585 squash -> main. Item done. The next automated release can complete end-to-end through the pipeline.
