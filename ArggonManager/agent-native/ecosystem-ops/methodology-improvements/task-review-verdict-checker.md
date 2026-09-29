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
- [x] `docs/engineering.md` verdict convention section (minimal + example).
- [x] `sync --json` emits additive verdict classification per matched/pending PR; unit tests for the parser (approve / request-changes / none; ordering by comment timestamp).
- [x] README + `ArggonManager/docs/json-output.md` updated (additive fields noted).
- [x] Smoke: fixture item with request-changes newer than approve → `changes-requested`; approve-only → `approved`; no verdicts → `none` (expected vs observed).
- [x] Full suite + lint/typecheck green; `arggon validate` ok.

### 2026-09-29 @Arggon
Implementation + evidence (branch feat/task-review-verdict-checker, PR #440).

- Convention: docs/engineering.md §Review bar → Review verdicts (bounded header line + evidence list; human prose, not schema).
- Checker: lib/src/verdict.ts (parseVerdicts/classifyVerdicts) wired into runSync — additive 'verdicts' field in the sync envelope (matched/fillable/pending/ambiguous items only; never no_pr). No extra gh calls (bodies already loaded); matching/exit_code untouched; schemaVersion stays 1.
- Tests: cli/src/verdict.test.ts (12: ordering by date then body order, case-insensitivity, scope capture, near-miss tokens, prose-only → none, first-line-per-comment) + 2 sync envelope integration tests.
- Gates: npm test 1734/1734 green, npm run lint clean, npm run build ok, arggon validate ok:true.
- Smoke (fixture /tmp/fixture-c2, fake gh on PATH — same technique as cli/src/sync-smoke.test.ts):
  - approve 2026-09-28 → request-changes 2026-09-29 ⇒ changes-requested (expected) / changes-requested (observed)
  - request-changes 2026-09-28 → approve 2026-09-29 ⇒ approved / approved
  - newer approve 2026-09-30 appended after a request-changes ⇒ flip to approved / approved
  - matched item without verdict comments ⇒ none / none
  - branch+no-PR item ⇒ absent from verdicts / absent
  - schemaVersion 1, exit_code 0 throughout.

### handoff 2026-09-29 @Arggon — next: Coordinator review of PR #440 against the review bar; merge after acceptance checklist tick
- branch: feat/task-review-verdict-checker
- open questions: None blocking; blocking merge gate deliberately out of scope per exploration-014 C2
