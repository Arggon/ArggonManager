---
type: task
status: in_progress
id: task-adopt-corpus-fingerprints
title: "adopt/init inventory: CLI-native spec-corpus detection by fingerprints"
assignee: Arggon
parent: story-adoption-state
labels: [p3]
created: "2026-09-16"
updated: "2026-09-16"
claimed_at: "2026-09-16T19:58:26.221Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-adopt-corpus-fingerprints.md
  Leaves live only under a story. id is the filename stem: task-adopt-corpus-fingerprints.
  CLI `arggon create task adopt-corpus-fingerprints` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# adopt/init inventory: CLI-native spec-corpus detection by fingerprints

## Context

Rollout step beyond the text-first proposal (extends task-adopt-spec-corpus-phases): make the CLI ITSELF detect spec corpora at inventory time (adopt and init --dry-run). Fingerprints: openspec/config.yaml + specs/*/spec.md (OpenSpec); docs/specs/spec-*.md with arggon frontmatter (already migrated); ADR directories; RFC markdown. The inventory reports: format detected, file count, origin tool. With detection in the inventory, the adoption task template can reference the detected corpus specifically (task-adopt-spec-corpus-phases text covers the procedure).

## Acceptance

- [ ] adopt inventory (and init --dry-run) detects spec corpora by fingerprint and reports format/count/origin in the inventory output (--json additive)
- [ ] The detection feeds the adoption task body (the corpus section becomes specific: "detected OpenSpec corpus: N specs — follow the phased checklist")
- [ ] Tests per fingerprint (OpenSpec fixture, already-migrated fixture, no-corpus fixture); docs additive

## Notes
