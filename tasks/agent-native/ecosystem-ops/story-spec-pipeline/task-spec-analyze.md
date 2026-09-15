---
type: task
status: done
id: task-spec-analyze
title: "spec analyze: ambiguity scan + spec-tasks consistency check"
assignee: Arggon
parent: story-spec-pipeline
labels: [p2]
created: "2026-09-15"
updated: "2026-09-15"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-spec-pipeline/task-spec-analyze.md
  Leaves live only under a story. id is the filename stem: task-spec-analyze.
  CLI `arggon create task spec-analyze` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec analyze: ambiguity scan + spec-tasks consistency check

## Context

Candidate #3 of [product discovery](docs/explorations/exploration-product-discovery-002.md): specs pass structural validation yet stay ambiguous — agents implement guesses. Spec Kit's `/clarify` + `/analyze` loop (github.com/github/spec-kit, 2026-09-15) proved checklist-driven ambiguity scanning + plan/spec consistency checks valuable. Effort M; principle: architecture-first. SPEC FIRST per the methodology (this item IS spec tooling — dogfood the pipeline).

## Acceptance

- [x] Spec for `arggon spec analyze` filed (arggon spec new) and flipped to implemented in the same PR
- [x] Ambiguity scan: checklist-driven pass over docs/specs/*.md (unspecified error paths, missing invariants, vague quantifiers) — report, never auto-edit
- [x] Consistency check: spec ↔ tasks/plans cross-reference (tasks cite specs; specs marked implemented have landed items)
- [x] Tests + docs (README + json-output if --json)

## Notes

### 2026-09-15 @Arggon
Lead-architect review: APPROVED. Dogfooding the pipeline on the spec tooling itself (spec-analyze-004 proposed->implemented in-PR) is exactly how this item should have been built. Report-only invariant proven byte-identical, the ambiguity checklist catches what structural validation cannot (your own corpus flagged two real cases), and the consistency check already paid for itself by finding the orphaned show-item spec. Exit-0-with-findings respects the report charter. The two corpus findings are being handled. Merge follows.
