---
type: task
status: done
id: task-adopt-spec-corpus-phases
title: "adopt: spec-corpus detection + phased migration checklist in the adoption template"
assignee: Arggon
branch: feat/task-adopt-spec-corpus-phases
parent: story-adoption-state
labels: []
created: "2026-09-16"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-adopt-spec-corpus-phases.md
  Leaves live only under a story. id is the filename stem: task-adopt-spec-corpus-phases.
  CLI `arggon create task adopt-spec-corpus-phases` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# adopt: spec-corpus detection + phased migration checklist in the adoption template

## Context

Rollout step 1 ("barato y ya") of the spec-corpus migration proposal, motivated by the ArggonStores-am adoption (2026-09-15: OpenSpec -> ArggonManager, 14 PRs, 138->133 specs, zero-loss asserted): `adopt` does not know pre-existing spec corpora exist. An adopter arriving with OpenSpec (or any foreign spec corpus) gets an adoption task that only speaks of governance docs — the corpus migration, duplication audit, consolidation and contract refactor happen out-of-method, requiring senior judgment + ad-hoc scripts (repeatable but not reproducible by default). This task lands the METHOD as text in the adoption checklist template — no CLI changes (those are task-spec-import-openspec / task-adopt-corpus-fingerprints / task-spec-analyze-baseline / task-spec-audit).

## Acceptance

- [x] cli/src/adopt.ts ADOPT_TASK_BODY gains a spec-corpus section: detection fingerprints (openspec/config.yaml + specs/*/spec.md = OpenSpec; docs/specs/spec-*.md with arggon frontmatter = already migrated; ADR dirs, RFC markdown = other), and if a corpus is found, the phased procedure as checklist text: Fase 0 mapping table (OpenSpec: ## Purpose->Purpose; ## Requirements->Acceptance criteria verbatim GWT; ### Verification checklist per requirement; provenance as italic line), Fase 1 1:1 migration with zero-loss assertion (mechanical, no judgment), Fase 2 duplication audit (shingle-Jaccard + shared requirement/scenario titles -> DUPLICATE/MERGE/KEEP-SEPARATE with evidence), Fase 3 consolidation (strictest copy wins, absorbed ids with citation sweep, new shared-pattern spec), Fase 4 contract refactor in file-disjoint waves (real Synopsis, TBDs from code, error paths verified against implementation — inventing SHALLs forbidden; spec-code gaps -> tracker items)
- [x] Gates stated in the template: spec validate 0/0 per phase; spec analyze no NEW findings vs baseline (orphans reported and accepted, never cosmetically cited); consolidar antes de reescribir
- [x] Principles codified in the template text: zero loss (consolidation reconciles, never deletes normative text; file deletion only after verified absorption); one requirement one owner (reference by spec_id); implemented = verified against code; orphans honest
- [x] Evidence: the real ArggonStores-am case cited in the item (14 PRs, 138->133, analyze 224->113 warns)

## Notes
Evidence (ArggonStores-am, 2026-09-15): 14 PRs, 138->133 specs, zero-loss asserted, `spec analyze` 224 -> 113 warnings.


### 2026-09-16 @Arggon
Lead-architect review: APPROVED. The phased checklist (Fase 0-4 + gates + principles) landed in ADOPT_TASK_BODY with the ArggonStores-am evidence cited in Notes — the method stops being tribal and becomes the default adoption path for corpus adopters. The labs count bump (8->14) is the honest cost of a richer checklist. The duplicated count assertion across tests is noted as a micro-task candidate. Merge follows.
