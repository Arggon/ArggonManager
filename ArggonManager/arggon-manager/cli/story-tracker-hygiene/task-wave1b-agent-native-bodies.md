---
type: task
status: todo
id: task-wave1b-agent-native-bodies
title: "Wave-1b bodies: 12 agent-native placeholder bugs (worktree, MI, spec-pipeline)"
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-12"
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

### 2026-10-12 @ses_ed2ed434cffdHsqB0EV526IjUT
verdict: approve (12 agent-native bodies, docs-only, smoke-exempt)
- Read the worktree diff (12 bug files + own item file) — nothing else; scope stays on the item
- Standards-reviewer: approve, no blocking findings (frontmatter values identical incl. YAML-identical requotes; 3 transcriptions spot-checked; 3 zero-Notes files grounded with all pins resolving at HEAD; normalizations value-equivalent; handoff typo accepted as harmless)
- Verifier: prettier clean on all 12, validate ok, no scaffold markers, no ticked boxes
- Recommendation: merge PR #737 (merge, not squash) on green CI; lead ticks Acceptance after merge and flips done
