---
type: story
status: todo
id: story-adoption-state
title: Installation state and generated-file provenance
parent: cli
labels: []
created: "2026-09-12"
updated: "2026-09-12"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/story-adoption-state.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Installation state and generated-file provenance

## Context

Existing repos cannot safely adopt (or upgrade) ArggonManager's generated documents: init never overwrites, so template improvements never land, and there is no way to tell "arggon-generated and untouched" apart from "edited by the adopter". Design (2026-09-12 research, Copier/Helm precedent): generated docs carry a provenance marker and the state lives in tasks/.convention.yml under the namespaced `x-generated:` section — path -> { template, checksum, arggonVersion, generatedAt }. Re-running init: checksum matches current file (untouched) -> regenerate in place silently; differs (adopter edited it) -> skip and report by default, `--backup` archives to backup/<date>/ before regenerating.

## Acceptance

- [ ] `arggon doctor` reports installation state; `x-generated` state + markers landed; init re-runs update untouched docs without backup and report modified ones
