---
type: task
status: in_progress
id: task-spec-analyze-decision-gaps
title: spec-analyze-decision-gaps
assignee: Arggon
branch: feat/task-spec-analyze-decision-gaps
parent: methodology-improvements
labels: []
priority: p1
created: "2026-09-29"
updated: "2026-09-29"
claimed_at: "2026-09-29T23:07:50.237Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-spec-analyze-decision-gaps
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-spec-analyze-decision-gaps.md
  Leaves live only under a story. id is the filename stem: task-spec-analyze-decision-gaps.
  CLI `arggon create task spec-analyze-decision-gaps` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec-analyze-decision-gaps

## Context

<!-- Why this task exists. -->

## Acceptance

- [ ] 

## Notes

### 2026-09-29 @Arggon
### Context — C3 (exploration-methodology-improvements-014)

Extend the **report-only** `arggon spec analyze` with decision-pipeline gap findings. Same contract as existing analyze findings: never edits, exit 0 with findings.

Findings to add:
- **DECISION-PENDING-EXPLORATION** — exploration in `ArggonManager/docs/explorations/` whose `## Decision` section contains no link to `docs/adr/*.md` (template placeholder or bare comment) and whose `created` date is older than a documented staleness threshold.
- **STALE-PROPOSED-ADR** — ADR in `ArggonManager/docs/adr/` whose `- Status:` line is `Proposed` and whose Date is older than a documented threshold.
- **SPEC-STATUS-DRIFT** — spec with `status: proposed` whose linked plan (plan frontmatter `spec:` matching the spec id) has `status: implemented`.

Thresholds as documented constants (pick sensible defaults, e.g. 30d explorations / 90d ADRs; no new flags unless trivial). Verification before opening the PR: the scanner run against **this repo** must flag exploration-007's pending decision and ADRs 0002/0003/0004 (findings only — do not fix them in this PR).

### Acceptance checklist
- [ ] Spec first: scaffold `docs/specs/spec-analyze-decision-gaps-*.md` (`arggon spec new analyze-decision-gaps --plan`), purpose/finding taxonomy/thresholds/invariants (report-only, exit 0)/acceptance criteria; flip spec+plan status to `implemented` in this PR.
- [ ] `spec analyze --json` emits the three finding types (file + reason), additive to the envelope (schemaVersion unchanged unless breaking).
- [ ] Unit tests: ADR status-line parser, exploration Decision-link parser, plan↔spec drift; positive+negative fixture per finding type.
- [ ] Human output lists findings; docs updated: README spec-analyze section, `ArggonManager/docs/json-output.md`, `ArggonManager/docs/agents.md` §Specs and plans mention.
- [ ] Smoke evidence: `spec analyze` on a fixture seeded with all three gap types (expected vs observed) + on this repo (findings above present).
- [ ] Full suite + lint/typecheck green; `arggon validate` ok.
- [ ] Note: `task-done-gate-acceptance-waiver` also touches README + json-output.md — rebase on main before opening the PR if it merged first.
