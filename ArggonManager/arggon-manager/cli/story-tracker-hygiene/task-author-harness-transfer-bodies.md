---
type: task
status: done
id: task-author-harness-transfer-bodies
title: Author bodies for the 3 placeholder tasks under harness-research-transfer and external-harness-evaluation
assignee: arggon-delivery-lead
branch: feat/task-author-harness-transfer-bodies
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
worktree_path: /home/arggon/Projects/ArggonManager-task-author-harness-transfer-bodies
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-harness-transfer-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-harness-transfer-bodies.
  CLI `arggon create task author-harness-transfer-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author bodies for the 3 placeholder tasks under harness-research-transfer and external-harness-evaluation

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `harness-research-transfer + external-harness-evaluation`: task-adopt-compaction-three-questions, task-state-exploration-stopping-rule, task-spike-cross-run-lesson-store. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [x] Every listed file carries a real `## Context` (no scaffold marker)
- [x] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [x] No file outside the listed set touched; frontmatter untouched
- [x] Prettier clean; `arggon validate` green; PR opened

## Notes

### 2026-10-12 @ses_ed21b490fffe7LSRofj4qdDEjC

Maker evidence (arggon-maker, worktree session):

- Claim confirmed after session_move: show(meta) = in_progress + assignee arggon-delivery-lead + branch feat/task-author-harness-transfer-bodies + recorded worktree_path. Never re-claimed.
- All 3 target files were still scaffold placeholders in live sections (## Context = <!-- Why this task exists. -->, ## Acceptance = <!-- The real acceptance criteria ... -->), each with transcribable 2026-10-05 Notes. None already had content; nothing invented — live sections transcribe Notes verbatim (emphasis markers normalized, see below).
- One faithful fix in a LIVE section only: task-state-exploration-stopping-rule live Context uses ../../../docs/adr/0017-greenfield-exploration-gate.md per the file's own correction comment; Notes keep the original wrong link + correction untouched. Authorities verified present: exploration-harness-research-transfer-021.md F6 (L197-205) / F8 (L218-225) / F9 (L227-237) / rec. items 2-3 (L264-269); ADR 0022 Decision items 3+5 (L73-88) + bar (L92-96); exploration-autoharness-autocontext-autocompact-020.md F6 (L167-178); ADR 0017 phases 3-4 + hard gate (L53-77).
- Gates: `npm run arggon -- validate` ok (0 warnings, convention v5) before commit (also ran as pre-commit hook on 8d07381f); `npx prettier --check` clean on all 4 touched files (3 targets + own item file). Baseline pre-check was dirty on all 4 (pre-existing dirt, same class as PRs #731-#734).
- Non-content normalizations disclosed (editor/prettier applied on save + --write): (1) blank line inserted after frontmatter closing --- in all 4 files; (2) blank line after each ### date header + before second ### header in Notes; (3) single-emphasis _x_ -> _x_ (content-identical, prettier style); (4) markdown-table column padding realignment in task-state-exploration-stopping-rule (Notes + transcribed live table). No depends_on field in any touched file, so no printWidth exception needed.
- Proof no words/values/checkbox-states changed outside new live sections: git diff shows only scaffold-comment removals, section-header repositioning, the normalizations above, and added live content; `grep -E frontmatter fields` on the diff is empty (frontmatter untouched); `grep [x]` over all 4 files is empty — all live boxes unticked (6 / 8 / 10 boxes = Notes counts 6 / 8 / 10); numbers (95+-2, 51/40/81/37, +9.2%/+5.0%, 15000, 90-day) appear as unchanged context lines.
- Staged explicit paths only (4 files, no -A); commit 8d07381f; `git push -u origin feat/task-author-harness-transfer-bodies` -> new remote branch created, upstream tracking set (no failure). Touched nothing outside the 3 targets + own item file. Did NOT tick own Acceptance boxes, did NOT flip done, filed no tracker items.

### handoff 2026-10-12 @ses_ed21b490fffe7LSRofj4qdDEjC (session: ses_ed21b490fffe7LSRofj4qdDEjC) — next: Open PR from feat/task-author-harness-transfer-bodies referencing the item id; review then merge

- branch: feat/task-author-harness-transfer-bodies
- open questions: none

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT

verdict: approve (3 harness-transfer bodies, docs-only, smoke-exempt)

- Read the worktree diff (3 files + own item file) — nothing else; scope stays on the item
- Standards-reviewer: approve, no blocking findings (machine-checked transcription: 2 files zero delta, stopping-rule one specified delta — the corrected ADR 0017 link, wrong filename confined to untouched Notes; link resolves; 24 new boxes checkable; own boxes unticked)
- Verifier: validate ok; prettier red ONLY on the author's own item file (targets clean) → lead fixed with prettier --write (blank lines only), re-ran all-4 green + validate green in the worktree
- Recommendation: merge PR #735 (merge, not squash) on green CI; lead ticks Acceptance after merge and flips done
