---
type: task
status: todo
id: task-validate-refuses-placeholder-bodies
title: "validate refuses placeholder bodies on open items (blocking, decided A)"
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
depends_on: [task-author-methodology-improvements-bodies, task-author-parallel-worktree-bodies, task-author-tooling-env-bodies, task-author-ci-wall-clock-bodies, task-author-harness-transfer-bodies, task-author-spec-pipeline-body]
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-validate-refuses-placeholder-bodies.md
  Leaves live only under a story. id is the filename stem: task-validate-refuses-placeholder-bodies.
  CLI `arggon create task validate-refuses-placeholder-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# validate refuses placeholder bodies on open items (blocking, decided A)

## Context

Wave 2 of `decided: A` on `bug-template-only-bodies-ship-green` (depends on all six author-* tasks — the tree must be clean before the gate lands, or every lane goes red). The owner decided: a template-only body on an OPEN item must FAIL `validate`, not warn. Report-only (B) and split (C) were explicitly rejected: the delivery lead owns the backlog, so parking rot there is not an option.

Hard constraint from the wave-1 survey: the guard must match the SCAFFOLD MARKER (the `<!-- … -->` placeholder comment in a live section), never quoted prose — `bug-template-only-bodies-ship-green` itself quotes the placeholder strings in real content and must stay green.

## Acceptance

- [ ] `arggon validate` FAILS (non-zero, named error) on an open (`todo`/`in_progress`/`blocked`) item whose live `## Context` or `## Acceptance` still carries the scaffold placeholder marker
- [ ] Done/cancelled items excluded (history, not the contract) and the message says so
- [ ] The guard reads the item body (derives from source), not a restated marker copy in the test — with a negative control proving quoted placeholder prose stays green
- [ ] `ArggonManager/docs/convention.md` documents the refusal alongside the done gate; human-only waiver path stated (agents cannot waive)
- [ ] `npm test` green; prettier clean; PR opened

## Notes

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT
Lead note (wave-1b gate): the guard change stays staged-uncommitted on its branch until `task-wave1b-agent-native-bodies` + `task-wave1b-mixed-bodies` merge — committing earlier turns main red on the pre-commit hook (the guard correctly refuses its own commit while 24 placeholders remain). Those two tasks are the remaining depends_on in effect; frontmatter `depends_on` untouched deliberately (`bug-update-depends-on-multiline-rejected`: the serializer would rewrite it multiline-broken).
