---
type: task
status: done
id: task-adopt-corpus-body-injection
title: "adopt task body: inject detected spec corpus at creation"
assignee: Arggon
branch: feat/task-adopt-corpus-body-injection
parent: story-adoption-state
labels: []
created: "2026-09-16"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-adopt-corpus-body-injection.md
  Leaves live only under a story. id is the filename stem: task-adopt-corpus-body-injection.
  CLI `arggon create task adopt-corpus-body-injection` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# adopt task body: inject detected spec corpus at creation

## Context

Follow-up from task-adopt-corpus-fingerprints (PR #286, review round): detectSpecCorpora reports detected corpora in the adopt INVENTORY, but the adoption task body is a STATIC template (ADOPT_TASK_BODY) — the detected corpus (format, count, origin) is not injected into the created task's body, so the adopting agent must re-derive it from the inventory line.

## Acceptance

- [ ] adopt composes the adoption task body with a corpus-specific section when detection finds corpora (format, count, pointer to the phased checklist)
- [ ] No corpora -> template unchanged; tests both ways

## Notes

### 2026-09-16 @Arggon
REVIEW (coordinator) — APPROVED, merging PR #296.

Verified: full diff read (generic section extracted as ADOPT_CORPUS_SECTION_GENERIC interpolated into ADOPT_TASK_BODY — byte-identity of the no-corpus template pinned by a toBe test; pure composer; call site reuses inventory.corpora, no re-detection; no envelope/JSON/skills changes). Suite 999/999 green, lint/build/validate clean, doctor 0 modified / 0 drifted. E2E probe by coordinator on two fresh fixture repos (init + adopt): without corpus the created task keeps the generic 'No corpus: skip this section.' primer byte-for-byte; with an openspec fixture the created task carries '## Spec corpus — detected' with format, file count, origin, and the explicit Fase 0-4 + gates pointer, checklist items 9-14 intact.
