---
type: task
status: in_progress
id: task-author-parallel-worktree-bodies
title: Author bodies for the parallel-worktree story and its 4 placeholder tasks
assignee: arggon-delivery-lead
branch: feat/task-author-parallel-worktree-bodies
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T01:42:28.636Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-author-parallel-worktree-bodies
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-parallel-worktree-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-parallel-worktree-bodies.
  CLI `arggon create task author-parallel-worktree-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author bodies for the parallel-worktree story and its 4 placeholder tasks

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `parallel-worktree-runtime-isolation-ports-state-services (story file + 4 tasks)`: task-arm-strict-worktree-writes, task-clip-class-sweep-remaining-sites, task-cli-surface-never-carries-steps-truncated, task-foreign-writes-char-clip-truncated. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [ ] Every listed file carries a real `## Context` (no scaffold marker)
- [ ] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [ ] No file outside the listed set touched; frontmatter untouched
- [ ] Prettier clean; `arggon validate` green; PR opened

## Notes

### 2026-10-12 @ses_ed2393607ffecx8se4gXgm2m1y
Maker evidence (standards reviewer): 5/5 files under ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/ verified scaffold placeholders first (live sections held only the template comments), then given real Context + unticked checkable Acceptance. 4 tasks transcribed from Notes verbatim (arm: both 10-02 audit and 10-07 ADR-0026 routing notes, 4 boxes; clip-class: both 10-03 notes incl. round-2 corrections, 6 boxes reconciled with done sibling rounds 1-3; cli-surface: premise-correction note, 5 boxes; foreign-writes: #579 note, 3 boxes). Noteless story grounded in named authorities (epic agent-coordination.md, ADR 0019 decisions 1-4, exploration-worktree-env-isolation-017, spec/plan-016, done siblings #566/#568), 5 boxes. 23 new boxes total, all unticked; no file outside the 5 touched.

Gates observed: arggon validate ok (0 warnings, convention v5, expected); prettier --check clean on 4/5 files (expected); clip-class has ONE documented exception line (see below). No scaffold markers remain (grep proof); frontmatter byte-identical on all 5 (incl. single-line depends_on); no ticked boxes added/removed.

Editor auto-format disclosure (pre-existing HEAD dirt, same class as wave-1 PR #731): the editor inserted blank lines after frontmatter/### headings and flipped *-emphasis to _-emphasis inside Notes history. Proof of no content change: normalized old-vs-new diff (blanks stripped, emphasis unified) shows the ONLY removed lines are the 10 scaffold placeholder comments. Two further normalizations were caught and repaired, not kept: the editor reflowed depends_on to two lines (reverted to single-line: the kernel parser is strictly single-line, multiline fails validate BROKEN_YAML per bug-update-depends-on-multiline-rejected) and dropped 2 significant spaces in clip-class Context (restored byte-exact via shell). Two sentences in that Context were reworded meaning-identically (exact-fix string kept verbatim in parens) to dodge a prettier space-eating quirk in loose-list context; all other prose is transcription.

Prettier exception (needs reviewer accept): clip-class depends_on is 110 chars single-line (validate-mandated) and trips prettier --check, which wants the split that validate rejects. There is no serialization satisfying both (same conflict as bug-update-depends-on-multiline-rejected). Validate wins; everything else in the file is prettier-clean.

Work commit 1ae8bb2f; push of feat/task-author-parallel-worktree-bodies succeeded with upstream tracking set.
