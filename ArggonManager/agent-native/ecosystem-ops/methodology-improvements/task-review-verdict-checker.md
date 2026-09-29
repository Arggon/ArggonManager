---
type: task
status: in_progress
id: task-review-verdict-checker
title: review-verdict-checker
assignee: Arggon
branch: feat/task-review-verdict-checker
parent: methodology-improvements
labels: []
priority: p2
created: "2026-09-29"
updated: "2026-09-29"
claimed_at: "2026-09-29T23:05:06.453Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-review-verdict-checker
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-review-verdict-checker.md
  Leaves live only under a story. id is the filename stem: task-review-verdict-checker.
  CLI `arggon create task review-verdict-checker` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# review-verdict-checker

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-29 @Arggon
### Context — C2 (exploration-methodology-improvements-014)

Verdicts are prose today: nothing distinguishes approve from request-changes and nothing checks verdict state; "only a passing review merges" is social. Scope here = **convention + report-only linter**; a blocking gate is explicitly out of scope until the linter proves low-noise.

Design:
- Convention doc in `docs/engineering.md` §Review bar: verdict comments on the item start with a bounded header line — `verdict: approve` or `verdict: request-changes` (optional scope after it) — followed by the evidence list. Human-written; documentation, not schema.
- Checker (report-only): extend `arggon sync` (the PR reconciliation surface) — for each item with an open PR, classify verdict state from the item's body comments: `approved` (latest verdict = approve), `changes-requested` (a request-changes newer than the last approve), `none`. Additive envelope fields (schemaVersion unchanged); no extra gh calls beyond what sync already makes. If a different seam is clearly better, implement it and record the rationale in the PR.

### Acceptance checklist
- [ ] `docs/engineering.md` verdict convention section (minimal + example).
- [ ] `sync --json` emits additive verdict classification per matched/pending PR; unit tests for the parser (approve / request-changes / none; ordering by comment timestamp).
- [ ] README + `ArggonManager/docs/json-output.md` updated (additive fields noted).
- [ ] Smoke: fixture item with request-changes newer than approve → `changes-requested`; approve-only → `approved`; no verdicts → `none` (expected vs observed).
- [ ] Full suite + lint/typecheck green; `arggon validate` ok.
