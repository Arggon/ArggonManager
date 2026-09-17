---
type: task
status: in_progress
id: task-init-propose-acked-updates
title: "init --propose: side-file upgrade proposals for acked/modified docs"
assignee: Arggon
branch: feat/task-init-propose-acked-updates
parent: story-adoption-state
labels: [p1]
created: "2026-09-16"
updated: "2026-09-17"
claimed_at: "2026-09-17T01:35:47.262Z"
depends_on: [task-init-dry-run-plan]
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-init-propose-acked-updates.md
  Leaves live only under a story. id is the filename stem: task-init-propose-acked-updates.
  CLI `arggon create task init-propose-acked-updates` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init --propose: side-file upgrade proposals for acked/modified docs

## Context

Exploration adopter-upgrade-experience-007 (option C, propose-files variant — user decision 2026-09-16): acked docs are skipped by init forever ("it is yours"), so a fully-adopted repo (ArggonStores-am: 14/14 acked) receives zero template updates by mechanism; the methodology update of 2026-09-16 needed a manual 7-step port. This adds the safe channel: proposals land in side files, the adopting agent merges them as normal work, the ack is refreshed. Depends on task-init-dry-run-plan (shares the pure planner).

## Acceptance

- [ ] `arggon init <dir> --propose`: for every acked/modified destination whose CURRENT template render differs from disk, write the fresh render to `<dest>.proposed-<arggonVersion>` (side file, original byte-untouched — fs snapshot-verified); unchanged dests get no proposal; x-generated state NOT mutated
- [ ] Proposal side files are never auto-committed by init (untracked working files; `.gitignore` guidance documented) and carry a header comment pointing at the flow (diff -> merge as work item -> re-ack via `arggon adopt --ack`)
- [ ] `--json` additive: `proposals[]` (`{ dest, proposalPath, template, basedOnVersion }`) + counts; human output lists each proposal with its diff summary
- [ ] Idempotent: re-running --propose overwrites its own proposal file for the same version (never accumulates junk); a dest already matching upstream gets its stale proposal cleaned or reported as absorbed
- [ ] The full loop is documented in README (propose -> agent diffs/merges as a work item -> re-ack -> proposal file removed) and the pilot is named: ArggonStores-am's 14 acked docs
- [ ] Tests: acked doc with changed template -> proposal written + original intact; unchanged -> no proposal; modified doc -> proposal; idempotent re-run; existing init/adopt suites green

### 2026-09-17 @Arggon
REVIEW (coordinator) — APPROVED, merging PR #306.

Verified: full diff read (pure planProposals + applyProposals layered on the landed planner; header-comment proposals, header-less JSON dests documented; same-version overwrite / absorbed cleanup / stale-older-version reported-never-deleted; --dry-run --propose pure read; --backup/--force combos rejected with clear errors; additive proposals[] JSON + human listing with +/- line summaries). Gates mine: suite 1021/1021, lint/build clean, validate ok, doctor 0/0. Live probe on a fixture: hand-edited AGENTS.md -> proposal side file AGENTS.md.proposed-0.2.0 with the instruction header, original byte-intact, no state mutation; idempotent re-run overwrites (1 file); doc restored to render -> side file removed, reported absorbed; --dry-run --propose writes nothing.

Deviation noted, accepted: tests simulate upstream drift via hand-edit-after-ack (same render-vs-disk code path) instead of mutating bundled templates; a doctor-style templatesDir injection into planProposals is future hardening — not blocking. Next: the pilot this item names — run --propose on our own repo's outdated docs as the first merged proposals.
