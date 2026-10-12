---
type: task
status: done
id: task-author-methodology-improvements-bodies
title: Author bodies for the 12 placeholder tasks under methodology-improvements
assignee: arggon-delivery-lead
branch: feat/task-author-methodology-improvements-bodies
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
worktree_path: /home/arggon/Projects/ArggonManager-task-author-methodology-improvements-bodies
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-methodology-improvements-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-methodology-improvements-bodies.
  CLI `arggon create task author-methodology-improvements-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author bodies for the 12 placeholder tasks under methodology-improvements

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `methodology-improvements`: task-adr-index-parity-status-classes-line-ref-stale, task-adr-index-title-rule-unwritten-in-engineering-md, task-cascade-whole-body-acceptance-defers-this-defect, task-create-needs-a-body-flag-to-author-a-live-contract, task-dated-correction-not-self-verifying, task-decide-adr-0021-index-title-editorial-vs-verbatim, task-engineering-doc-restates-more-drifted-facts, task-mcp-doc-contract-scan-surface-widened, task-migrate-7-leaves-with-no-live-acceptance-contract, task-opencode2-claimcommit-subfields-documented, task-opencode2-doc-builtworkspaces-bound-unstated, task-opencode2-doc-contract-pins-optionality. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [x] Every listed file carries a real `## Context` (no scaffold marker)
- [x] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [x] No file outside the listed set touched; frontmatter untouched
- [x] Prettier clean; `arggon validate` green; PR opened

## Notes

### handoff 2026-10-12 @ses_ed2570971ffeDcOy6iRnDSFG5M (session: ses_ed2570971ffeDcOy6iRnDSFG5M) — next: Delivery lead: review 12 bodies, open PR from pushed branch 808e7f6f, send to standards review

- branch: feat/task-author-methodology-improvements-bodies
- open questions: Accept prettier-mandated cosmetic normalization of Notes history + 3 YAML titles?; all 12 were placeholders, none pre-authored

### 2026-10-12 @ses_ed2570971ffeDcOy6iRnDSFG5M

Maker evidence (standards reviewer): 12/12 files under ArggonManager/agent-native/ecosystem-ops/methodology-improvements/ verified scaffold placeholders first, then given real Context + unticked checkable Acceptance; 10 transcribed from Notes verbatim, 2 noteless items grounded in authorities (mcp-doc-contract CORPUS_FILES/DIRS 5+5 in cli/src/mcp-doc-contract.test.ts; MAX_NATIVE_PREPARATION_NAMES=32 in opencode/plugins/arggon/index.ts:195 with Bound column at docs/opencode2.md:131,146-147). Gates observed: npx prettier --check clean on all 12 (expected); tools.arggon.validate ok, 0 warnings (expected); pre-commit hook validate ok (observed). No scaffold markers remain; no boxes ticked; no depends_on/labels/status values changed. Known cosmetic side-effect: repo prettier --write also normalized pre-existing style debt (blank lines, 3 YAML title quote styles, *-to-_ emphasis and table padding in Notes) — render- and YAML-equivalent only. Work commit 808e7f6f; push of feat/task-author-methodology-improvements-bodies succeeded with upstream tracking set.

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT

verdict: approve (12 MI task bodies, docs-only, smoke-exempt)

- Read the worktree diff (12 task files + own item file) — nothing else; scope stays on the item
- Standards-reviewer: approve, no blocking findings (frontmatter values untouched — 3 title quote flips render-equivalent; prettier-rewrite shapes disclosed and verified; transcription spot-checked against Notes; 2 noteless items grounded in authorities; 59 new boxes all checkable, all unticked)
- Verifier: prettier clean on all 12, validate ok (0 warnings)
- Recommendation: merge PR #731 (merge, not squash) on green CI; lead ticks Acceptance after merge and flips done
