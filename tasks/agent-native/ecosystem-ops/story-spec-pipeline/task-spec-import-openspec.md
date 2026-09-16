---
type: task
status: todo
id: task-spec-import-openspec
title: "spec import openspec: mechanical migration with zero-loss check"
parent: story-spec-pipeline
labels: []
created: "2026-09-16"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/agent-native/ecosystem-ops/story-spec-pipeline/task-spec-import-openspec.md
  Leaves live only under a story. id is the filename stem: task-spec-import-openspec.
  CLI `arggon create task spec-import-openspec` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# spec import openspec: mechanical migration with zero-loss check

## Context

Rollout step 2 of the spec-corpus migration proposal. Evidence: the ArggonStores-am adoption (2026-09-15) migrated 138 OpenSpec capability specs with an AD-HOC script (spec new per capability + section mapping + zero-loss assertion) — repeatable but not reproducible by default. `spec import openspec` makes the most error-prone step mechanical. SPEC FIRST per the methodology.

Mapping (proven in production): OpenSpec `## Purpose` -> Purpose; `## Requirements` (with `### Requirement:` / `#### Scenario:` Given/When/Then) -> Acceptance criteria verbatim; add a `### Verification checklist` per requirement; provenance as an italic line (source file + migration date).

## Acceptance

- [ ] Spec-first: docs/specs/ spec for `spec import openspec <path>` (mapping table, zero-loss invariant, id sequencing, collisions), flipped implemented in the same PR
- [ ] `arggon spec import openspec <path> [--dry-run]`: for each openspec/specs/<capability>/spec.md — spec new + mapped content, sequential spec ids, zero-loss assertion per file (re-assembled content == source body, normalized) failing loudly with a per-file diff on mismatch
- [ ] --dry-run inventories (files, mapping preview) writing nothing
- [ ] Designed extensible: the format adapter is a separate module so future formats (other corpora) plug in — document the extension point
- [ ] Tests: golden OpenSpec fixture (multi-requirement, scenarios), zero-loss assert, dry-run, collision refusal (existing spec id), partial-failure rollback semantics (all-or-nothing per run documented)
- [ ] Docs: README + docs/agents.md (spec pipeline section) + docs/json-output.md (import payload additive)

## Notes
