---
type: task
status: in_progress
id: task-spec-import-openspec
title: "spec import openspec: mechanical migration with zero-loss check"
assignee: Arggon
branch: feat/task-spec-import-openspec
parent: story-spec-pipeline
labels: [p2]
created: "2026-09-16"
updated: "2026-09-16"
claimed_at: "2026-09-16T20:45:01.930Z"
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

### 2026-09-16 @Arggon
REVIEW (coordinator) — round 1: findings; round 2: APPROVED after in-PR fix, merging PR #290.

Round 1 findings (P1, fixed in a7f45ff):
1. CLI miswired: .command("import openspec") made commander bind the literal 'openspec' to the handler's first positional and silently ignore the real <path> (resolved <cwd>/openspec). Unit tests passed because they call runSpecImport directly — no e2e coverage of the wiring. Fixed: flat spec import <format> <path> (keeps documented invocation, adds explicit format dispatch with SPEC_IMPORT_FAILED for unknown formats, no introspection changes needed). Added 5 e2e CLI tests via spawnSync; strengthened zero-loss tests to exercise the real diff path (preamble prose dropped by mapping) instead of the parse-rejection path the original mutation hit.
2. Minor (accepted as-is): dry-run JSON success envelope used successEnvelope() with default conventionVersion instead of readConventionVersion(root) — behaviorally identical (both v3); not blocking.

Verified by coordinator: full diff read; suite 967/967 green, lint/build/validate/spec-validate clean, doctor 0 modified / 0 drifted; live CLI probe on a synthetic corpus (dry-run inventory, real run with global numbering 006/007, unknown-format refusal exit 1, parse failure loud with failures[] + exit 1, zero-written on failure). Spec-first satisfied (spec-import-openspec-005 flipped implemented in-PR); adapter extension point documented.
