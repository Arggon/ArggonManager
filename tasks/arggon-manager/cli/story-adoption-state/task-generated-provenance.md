---
type: task
status: todo
id: task-generated-provenance
title: "x-generated provenance: checksums, markers, safe regenerate"
parent: story-adoption-state
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-generated-provenance.md
  Leaves live only under a story. id is the filename stem: task-generated-provenance.
  CLI `arggon create task generated-provenance` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# x-generated provenance: checksums, markers, safe regenerate

## Context

Provenance: generateDocs stamps every generated doc with a visible marker comment (first line: `<!-- arggon:generated template="AGENTS.md" -->`) and records in `x-generated:` the destination path -> { template, checksum (sha256 of the file as generated), arggonVersion, generatedAt }. State parsing follows the x-views/x-playbooks namespaced precedent (ignore-unknown for old tools). init re-run semantics: file hash == recorded checksum -> untouched -> regenerate from current template and refresh state (silent update, no backup); hash differs -> adopter-modified -> default skip + `modified[]` in --json; `--backup` moves the modified file to backup/<YYYY-MM-DD>/<dest> before regenerating. New docs (not in state, not on disk) -> generate as today. The skill bundle joins the state too. Marker added only at generation; adopter edits keep it (harmless) but the hash betrays the edit.

## Acceptance

- [ ] Markers + x-generated state written by generateDocs (including the skill bundle); validate accepts v3 trees with x-generated (namespaced, ignore-unknown)
- [ ] Re-run: untouched docs regenerate silently (state refreshed); modified docs skipped + `modified[]`; `--backup` archives to backup/<date>/ then regenerates
- [ ] Tests: untouched/modified/backup/first-run flows with fixed checksums; doctor counts
