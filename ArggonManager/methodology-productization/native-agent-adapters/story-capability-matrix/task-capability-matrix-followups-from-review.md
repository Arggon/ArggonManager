---
type: task
status: todo
id: task-capability-matrix-followups-from-review
title: "Capability matrix review follow-ups: ADR-0020 characterization line, stale \"docs + CLAUDE.md\" ADR statement, `gap` criterion wording, lint-scope comment, README pointer spec S1 owes"
parent: story-capability-matrix
labels: [docs]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-capability-matrix/task-capability-matrix-followups-from-review.md
  Leaves live only under a story. id is the filename stem: task-capability-matrix-followups-from-review.
  CLI `arggon create task capability-matrix-followups-from-review` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Capability matrix review follow-ups: ADR-0020 characterization line, stale "docs + CLAUDE.md" ADR statement, `gap` criterion wording, lint-scope comment, README pointer spec S1 owes

## Context

Five non-blocking findings from the reviewer of PR #600 (task-capability-matrix), all verified-cleared-in-spirit but needing a home of their own:
1. The matrix's `derivation` sentence characterizes ADR 0020 slightly unfairly (it credits the collision/stale-seam problem to the ADR rather than to the transcription step) — decide and correct the wording.
2. ADR 0020's "docs + CLAUDE.md" line is now stale — tracked separately as `task-adr0020-claude-seam-statement-stale`.
3. Tighten the `gap` criterion wording so the zcode MANIFEST cannot be misused later as a per-client gate (the matrix distinguishes `package: zcode` from `docs + CLI floor:`; the criterion text should not blur them).
4. A code comment noting the false-absence lint's TRUE scope (it scans the gap clause only, so the "what still enforces it" half is intentionally not flagged — that clause-scoped split is load-bearing and someone will otherwise "fix" it into a false positive).
5. `README.md` needs its pointer to the capability matrix — spec §S1 owes it and the matrix work did not land it.

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes
