---
type: task
status: done
id: task-verify-operational-core-extraction-review-corrections
title: Verify operational core extraction review corrections
assignee: arggon-superagent
branch: agent/methodology-operational-core-ac4110cc6356
parent: methodology-improvements
labels: []
created: "2026-11-04"
updated: "2026-11-04"
worktree_path: /home/arggon/.dsh/state/superagent/work/methodology-operational-core-ac4110cc6356
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/methodology-improvements/task-verify-operational-core-extraction-review-corrections.md
  Leaves live only under a story. id is the filename stem: task-verify-operational-core-extraction-review-corrections.
  CLI `arggon create task verify-operational-core-extraction-review-corrections` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Verify operational core extraction review corrections

## Context

Consolidated actionable findings from independent local standards review of task-cut-methodology-reading-to-an-operational-core (issue #868, https://github.com/Arggon/ArggonManager/issues/868): generated skills must not route adopters unconditionally to source-only files; canonical claim rules must preserve conflict and missing-lease semantics; moved agent sections need compatible anchors; MCP documentation guards must follow the moved runtime content. Corrections are kept in the same focused PR, not deferred; this item tracks their regression evidence. No change to kernel policy or adopter-owned templates is intended.

## Acceptance

- [x] A fresh generated skill routes adopters to installed project instructions and all its relative umbrella links resolve.
- [x] Convention states the conflict override constraints and reports missing claimed_at as stale; claim.md links to that canonical rule.
- [x] Existing moved agent heading anchors remain entry points and core/reference links resolve.
- [x] MCP enumeration, native pinned-tool and generic name guards cover the extracted runtime content; ADR guards cover all extracted references.

## Notes
