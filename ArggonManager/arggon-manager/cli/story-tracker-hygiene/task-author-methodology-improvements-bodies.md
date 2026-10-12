---
type: task
status: todo
id: task-author-methodology-improvements-bodies
title: Author bodies for the 12 placeholder tasks under methodology-improvements
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
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

- [ ] Every listed file carries a real `## Context` (no scaffold marker)
- [ ] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [ ] No file outside the listed set touched; frontmatter untouched
- [ ] Prettier clean; `arggon validate` green; PR opened

## Notes
