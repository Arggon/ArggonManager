---
type: task
status: in_progress
id: task-priority-field-schema
title: "priority field: schema v4 on all item types (validate, flags, filter, migrate)"
assignee: Arggon
branch: feat/task-priority-field-schema
parent: story-deps-schema
labels: [p1]
created: "2026-09-17"
updated: "2026-09-17"
claimed_at: "2026-09-17T15:14:24.444Z"
---
<!--
  Placement (v0): tasks/agent-native/deps-graph/story-deps-schema/task-priority-field-schema.md
  Leaves live only under a story. id is the filename stem: task-priority-field-schema.
  CLI `arggon create task priority-field-schema` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# priority field: schema v4 on all item types (validate, flags, filter, migrate)

## Context

Exploration priority-model-008 (approved 2026-09-17, decision c): priorities exist today as a label convention (41 items carry pN labels) with no schema meaning, no validation, and no path into `next`'s ranking. This item first-classes a `priority` field on ALL five item types (initiative, epic, story, task, bug). Ranking changes are task-next-priority-ranking (depends on this one). Spec-first per methodology.

## Design decisions (approved)

- Field: `priority: p0|p1|p2|p3` — optional, absent = unprioritized, valid on all types. Additive-accepted on v3 trees (follow the v2/v3 precedent for how fields gate on tree version); convention.md gets the v4 section.
- Migrate: `arggon priority migrate [--dry-run]` moves existing `label: pN` values into the field and removes those labels (labels stay for non-priority uses). Idempotent; 41 items today.

## Acceptance

- [ ] Spec-first: docs/specs/spec-priority-field-008.md (spec new; numbering: next is 008) written + flipped implemented in the same PR; spec validate 0 errors
- [ ] Frontmatter: `priority` parses/serializes on all types; validate errors on unknown values (additive error code, documented); absent stays absent (no silent default written)
- [ ] `create --priority p1` and `update <id> --priority p2` (clear via empty value or documented absent-semantics); --json payloads additive on create/update/show/list
- [ ] Filter: new `priority:` field (exact pN; `priority:none` matches unset; negation works); FILTER_FIELDS + tests
- [ ] `arggon priority migrate [--dry-run] [--json]`: label pN -> field across all types, label removed, idempotent (second run no-op), dry-run writes nothing
- [ ] Board: priority chip additive in the static board render
- [ ] Docs: convention.md v4 section, json-output.md payloads, README; SKILL marker gains `priority migrate` + `npm run skills:sync` (new top-level command -> generated region + coverage invariant)
- [ ] Gates: validate ok, suite green, lint/build clean, doctor 0 modified / 0 drifted

### 2026-09-17 @Arggon
REVIEW (coordinator) — APPROVED, merging PR #316.

Provenance: dispatched subagent was cut twice by provider rate limits mid-flight; I recovered its substantial uncommitted work (spec-008, priority.ts kernel, 23-file wiring), completed the missing deliverables myself (convention.md v4 section, README, json-output payloads, migrate test suite 6 tests, convention-version-high fixture bump to version 9, test-expectation updates for conventionVersion 4 + priority:null contract field) and verified end to end.

Verified: full diff read (parse/serialize on all types; PRIORITY_INVALID validate rule; priority left the reserved-key set — official as of v4; create/update flags with clear semantics; priority filter incl. none + negation; migrate kernel highest-wins/kept-explicit-with-conflict/idempotent/dry-run/never-commits; board chip; SKILL generated region + sync). Gates mine: 1043/1043 (66 files), lint/build clean, validate + spec validate ok, doctor 0 modified / 0 drifted.
