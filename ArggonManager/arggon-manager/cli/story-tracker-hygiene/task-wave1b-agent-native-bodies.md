---
type: task
status: in_progress
id: task-wave1b-agent-native-bodies
title: "Wave-1b bodies: 12 agent-native placeholder bugs (worktree, MI, spec-pipeline)"
assignee: arggon-delivery-lead
branch: feat/task-wave1b-agent-native-bodies
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
claimed_at: "2026-10-12T03:27:54.878Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-wave1b-agent-native-bodies
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/task-wave1b-agent-native-bodies.md
  Leaves live only under a story. id is the filename stem: task-wave1b-agent-native-bodies.
  CLI `arggon create task wave1b-agent-native-bodies` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Wave-1b bodies: 12 agent-native placeholder bugs (worktree, MI, spec-pipeline)

## Context

Wave-1b of `decided: A`: the blocking guard (`task-validate-refuses-placeholder-bodies`, built, staged, uncommittable) refuses its own commit while these placeholders remain — their merge gates the guard's commit. Scope is ONLY files under `ArggonManager/agent-native/`: parallel-worktree-runtime-isolation-ports-state-services: bug-force-push-gate-blocks-the-rebase-path-the-lead-must-use, bug-fresh-worktree-refusal-prose-drops-prep-step-truncation, bug-gatebin-budget-reserved-block-can-exceed-clip, bug-mcp-server-binds-session-cwd-tracker-root, bug-prover-agent-has-no-x-generated-entry, bug-self-decided-false-positive-owner-assigned, bug-task-permissions-enforcement-not-observed; methodology-improvements: bug-context-report-baseline-date-mismatch, bug-mcp-budget-contradicted-across-docs, bug-wave-probe-file-check-model-dependent; story-spec-pipeline: bug-parity-suite-cannot-catch-wrong-input-at-call-sites, bug-zero-byte-item-files-committed-by-comment-autocommit. Three of these have ZERO dated Notes and need domain judgment grounded in named authorities, not invention: bug-context-report-baseline-date-mismatch, bug-mcp-budget-contradicted-across-docs, bug-release-needs-auth-self-describing. All others: transcribe Notes/comments. Bugs get Context + checkable boxes; the two tasks likewise.

## Acceptance

- [ ] Every listed file carries a real `## Context` (no scaffold marker)
- [ ] Every listed file carries checkable `## Acceptance` boxes
- [ ] No file outside the listed set touched; frontmatter untouched
- [ ] Prettier clean (modulo a disclosed single-line depends_on exception); `arggon validate` green; PR opened

## Notes

### handoff 2026-10-12 @Arggon — next: Lead reviews the 12 bodies, opens the PR and merges to unblock the guard commit
- branch: feat/task-wave1b-agent-native-bodies
- open questions: whether the 2 formatter-made title requotes count as frontmatter touch for the guard; self-decided-файл had zero Notes too (3rd zero-Notes file, not 2)
