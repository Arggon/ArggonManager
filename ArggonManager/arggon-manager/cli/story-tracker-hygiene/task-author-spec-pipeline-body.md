---
type: task
status: done
id: task-author-spec-pipeline-body
title: Author body for the placeholder task under story-spec-pipeline
assignee: arggon-delivery-lead
branch: feat/task-author-spec-pipeline-body
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
worktree_path: /home/arggon/Projects/ArggonManager-task-author-spec-pipeline-body
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-spec-pipeline-body.md
  Leaves live only under a story. id is the filename stem: task-author-spec-pipeline-body.
  CLI `arggon create task author-spec-pipeline-body` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author body for the placeholder task under story-spec-pipeline

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `story-spec-pipeline`: task-spec-analyze-naming-and-skill-mirror. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [x] Every listed file carries a real `## Context` (no scaffold marker)
- [x] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [x] No file outside the listed set touched; frontmatter untouched
- [x] Prettier clean; `arggon validate` green; PR opened

## Notes

### handoff 2026-10-12 @ses_ed215aaf0ffepJU57aC7vB5qAh (session: ses_ed215aaf0ffepJU57aC7vB5qAh) — next: Open PR from feat/task-author-spec-pipeline-body referencing the item id; review then merge

- branch: feat/task-author-spec-pipeline-body
- open questions: none

### 2026-10-12 @ses_ed215aaf0ffepJU57aC7vB5qAh

Maker evidence (arggon-maker, worktree session):

- Claim confirmed after session_move: show(meta) = in_progress + assignee arggon-delivery-lead + branch feat/task-author-spec-pipeline-body + recorded worktree_path. Never re-claimed, never took the stamp.
- Target file was still a scaffold placeholder in live sections (## Context = <!-- Why this task exists. -->, ## Acceptance = <!-- The real acceptance criteria ... -->), with transcribable 2026-10-03 Notes. NOT already-had-content; nothing invented — live sections transcribe Notes verbatim (4 Acceptance boxes, unticked, matching Notes count 4).
- Authorities verified present: cli/src/spec.ts:334-338 DOC_NUMBER_SOURCES; :346-362 docNumberFromFileName undefined on non-match; :377 docNumberCollisions skip (if hit undefined continue); :1555-1564 nextDocNumber same table; skills/arggon-cli/references/methodology.md:60-65 Pipeline references; ArggonManager/docs/agents.md Changing-the-methodology Behavioral + byte-equal + ADR 0016; cli/src/skill-copy.test.ts parity pin; PR #603 / bug-spec-analyze-does-not-detect-duplicate-doc-numbers dependency in frontmatter.
- Gates: `npm run arggon -- validate` ok (0 warnings, convention v5) before commit (also ran as pre-commit hook); `npx prettier --check` clean on both touched files (target + own item file). Baseline pre-check was dirty on both (pre-existing dirt, same class as PRs #731-735).
- Non-content normalizations disclosed (editor applied on save): (1) blank line after frontmatter closing --- in both files; (2) blank line after dated Notes heading + before Notes Acceptance list in target. No words/values/checkbox-states changed outside new live sections.
- Proof: git diff shows only scaffold-comment removals, added live content, and the blank lines above; grep of frontmatter value keys over the diff is empty (frontmatter untouched); grep [x] over target is empty — all 4 live boxes unticked; staged explicit paths only (2 files, no -A); commit 613a9c4c; `git push -u origin feat/task-author-spec-pipeline-body` -> new remote branch created, upstream tracking set (no failure). Touched nothing outside the target + own item file. Did NOT tick own Acceptance boxes, did NOT flip done, filed no tracker items.

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT

verdict: approve (spec-pipeline task body, docs-only, smoke-exempt)

- Read the worktree diff (1 task file + own item file) — nothing else; scope stays on the item
- Standards-reviewer: approve, no blocking findings (frontmatter identical incl. depends_on kept; Notes→live faithful; all spec.ts/methodology.md/agents.md pins resolve at HEAD; 4 checkable boxes matching Notes; no markers; no ticks; own boxes unticked)
- Verifier: validate ok, prettier clean on both files (maker's own-file style commit held)
- Recommendation: merge PR #736 (merge, not squash) on green CI; lead ticks Acceptance after merge and flips done
