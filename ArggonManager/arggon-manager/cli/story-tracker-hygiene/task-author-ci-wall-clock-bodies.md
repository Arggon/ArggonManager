---
type: task
status: done
id: task-author-ci-wall-clock-bodies
title: Author bodies for the ci-wall-clock story and its 2 placeholder tasks
assignee: arggon-delivery-lead
branch: feat/task-author-ci-wall-clock-bodies
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
worktree_path: /home/arggon/Projects/ArggonManager-task-author-ci-wall-clock-bodies
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-ci-wall-clock-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-ci-wall-clock-bodies.
  CLI `arggon create task author-ci-wall-clock-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author bodies for the ci-wall-clock story and its 2 placeholder tasks

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `story-ci-wall-clock (story file + 2 tasks)`: task-ci-concurrency-cancel, task-ci-shard-wall-measure. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [x] Every listed file carries a real `## Context` (no scaffold marker)
- [x] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [x] No file outside the listed set touched; frontmatter untouched
- [x] Prettier clean; `arggon validate` green; PR opened

## Notes

### 2026-10-12 @ses_ed22024a4ffe8UUDQDGBJjYTv3

Maker evidence (bodies authored, commit 9ad90acc, pushed to origin/feat/task-author-ci-wall-clock-bodies).

- All 3 files under ArggonManager/agent-native/ecosystem-ops/story-ci-wall-clock/ were still scaffold placeholders in live ## Context / ## Acceptance (verified before touching); all carried real dated 2026-10-05 Notes material, so every live section is transcription, not invention. No file was noteless; ADR 0023 line pins added as grounding (Context L21-42, Decision L44-66 incl. step 1 L48-52 / step 2 L54-59, consequences L68-82, alternatives L84-104, as read at HEAD).
- Story: live Context = Notes prose + exploration/ADR links + pointer to standing Notes for rejected options; live Acceptance = the 5 Notes boxes verbatim, all unticked. Tasks: live Context + Acceptance transcribed verbatim from Notes (only addition: ADR Decision line-pin in the opening line), all boxes unticked.
- Frontmatter untouched on all 3 (diff shows zero frontmatter lines changed; no depends_on/labels touched).
- Gates: tools.arggon.validate ok:true, 0 errors, 0 warnings; npx prettier --check clean on all 3 touched files (all 3 were prettier-dirty at HEAD).
- Pre-existing prettier normalizations disclosed (2 blank lines per file, nothing else): blank line after the --- frontmatter close, and blank line after the dated ### 2026-10-05 @ses_... heading. Proof of no out-of-scope change: git diff removed-lines audit shows exactly the 6 scaffold placeholder lines (2 per file) and nothing else — no words/values/checkbox-states changed outside the new live sections.
- depends_on exception not needed: none of the 3 files carries depends_on.
- Tooling note: the story edit call returned a spurious oldString-mismatch error yet wrote the content (verified byte-identical via cat -A + git diff); the other two edits returned success. No content impact.
- Staged explicit paths only (never git add -A); committed 9ad90acc; push exit 0, branch tracks origin/feat/task-author-ci-wall-clock-bodies. No PR opened (delivery lead owns PR/merge/done). Own Acceptance boxes NOT ticked, status left in_progress.

### handoff 2026-10-12 @ses_ed22024a4ffe8UUDQDGBJjYTv3 (session: ses_ed22024a4ffe8UUDQDGBJjYTv3) — next: Review diff 9ad90acc, open PR from feat/task-author-ci-wall-clock-bodies, verify, merge, flip done

- branch: feat/task-author-ci-wall-clock-bodies
- open questions: None; all 3 files had Notes so zero direction invented

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT

verdict: approve (ci-wall-clock story + 2 tasks, docs-only, smoke-exempt)

- Read the worktree diff (3 files + own item file) — nothing else; scope stays on the item
- Standards-reviewer: approve, no blocking findings (frontmatter identical; Notes→live transcription verbatim incl. box sets; ADR 0023 pins resolve at HEAD; boxes checkable; own boxes unticked)
- Verifier: validate ok; prettier red ONLY on the author's own item file (targets clean) → lead fixed with prettier --write (blank lines only, 3 insertions), re-ran probe green + validate green in the worktree
- Recommendation: merge PR #734 (merge, not squash) on green CI; lead ticks Acceptance after merge and flips done
