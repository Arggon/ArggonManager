---
type: task
status: done
id: task-spec-audit
title: "spec audit: duplication detection command (pairwise Jaccard + shared titles)"
assignee: Arggon
branch: feat/task-spec-audit
parent: story-spec-pipeline
labels: [p3]
created: "2026-09-16"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-spec-pipeline/task-spec-audit.md
  Leaves live only under a story. id is the filename stem: task-spec-audit.
  CLI `arggon create task spec-audit` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec audit: duplication detection command (pairwise Jaccard + shared titles)

## Context

Rollout step 3 of the spec-corpus migration proposal: during the ArggonStores-am migration, duplication detection required an AD-HOC script — 9,453 pairwise comparisons (shingle-Jaccard similarity + shared verbatim requirement/scenario titles) + manual reading of candidates, finding 1 diverging duplicate, 6 consolidations, ~130 healthy. `spec audit` makes that detection a first-class command. Effort M.

## Acceptance

- [ ] `arggon spec audit [--json]`: pairwise similarity over docs/specs/*.md (shingle-Jaccard on normalized text + shared requirement/scenario title extraction verbatim), threshold configurable, output classified (DUPLICATE / MERGE / KEEP-SEPARATE candidates) with evidence (shared titles, similarity score, file pairs)
- [ ] Report-only (never edits); --json envelope additive; thresholds documented
- [ ] Tests: golden fixtures (true duplicate, diverging duplicate, healthy corpus), threshold boundaries; validated against the ArggonStores-am known results (1 duplicate + 6 consolidations) if the corpus is available, else synthetic fixtures
- [ ] Docs: README spec section + docs/agents.md spec pipeline mention

## Notes

### 2026-09-16 @Arggon
REVIEW (coordinator) — APPROVED, merging PR #294.

Verified: full diff read (pure-function module, single-word command, validated threshold flags, sorted deterministic findings); suite 993/993 green, lint/build clean, spec validate 0 errors, doctor 0 modified / 0 drifted, SKILL marker + sync done (cross-check test green). Independent reproduction of the real-corpus validation: ran the built audit against ArggonStores-am (133 specs / 8,778 pairs, read-only synthetic repo) -> 0 duplicate, 0 merge, 8 keep-separate, 8,770 below floor — consistent with the post-consolidation expected state (the known 1 duplicate + 6 consolidations were already applied; the 8 keep-separate include the exact pairs the manual audit verified, e.g. 037<->039). Report-only invariant proven by md5 snapshot of the foreign corpus: byte-identical before/after.

Notes accepted: SPEC_FAILED reuse for audit failures (documented); k=3 shingles + the shared-titles MERGE path as the diverging-duplicate detector (corpus max text-Jaccard 0.174 confirms prose similarity alone would miss requirement-level duplication — the dual signal is the right design).
