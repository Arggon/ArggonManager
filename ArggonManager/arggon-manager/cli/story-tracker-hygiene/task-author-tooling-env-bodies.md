---
type: task
status: todo
id: task-author-tooling-env-bodies
title: Author bodies for the 3 placeholder tasks under tooling-and-environment
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-author-tooling-env-bodies.md
  Leaves live only under a story. id is the filename stem: task-author-tooling-env-bodies.
  CLI `arggon create task author-tooling-env-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Author bodies for the 3 placeholder tasks under tooling-and-environment

## Context

Wave 1 of `decided: A` on `bug-template-only-bodies-ship-green`: the blocking guard cannot land while open items carry placeholders, so bodies come first. Scope is ONLY the files under `tooling-and-environment`: task-file-smoke-opencode-red-on-main, task-mcp-parity-branch-fails-pr610-spawnlane, task-validate-missing-frontmatter-command-surface-assertions. Many of these items already carry real material in Notes/comments — transcribe it into the live sections, do not invent direction. Tasks get checkable Acceptance boxes; the story files get Context plus prose-or-checkable Acceptance per container rules. Frontmatter untouched; prettier clean; `arggon validate` green.

## Acceptance

- [ ] Every listed file carries a real `## Context` (no scaffold marker)
- [ ] Every listed task carries checkable `## Acceptance` boxes; the story file(s) carry prose-or-checkable Acceptance
- [ ] No file outside the listed set touched; frontmatter untouched
- [ ] Prettier clean; `arggon validate` green; PR opened

## Notes
