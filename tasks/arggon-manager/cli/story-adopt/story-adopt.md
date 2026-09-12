---
type: story
status: done
id: story-adopt
title: Agent-assisted adoption for existing repos
assignee: Arggon
branch: feat/story-adopt-impl
parent: cli
labels: []
created: "2026-09-12"
updated: "2026-09-12"
claimed_at: "2026-09-12T23:04:33.287Z"
depends_on: [story-adoption-state]
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adopt/story-adopt.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Agent-assisted adoption for existing repos

## Context

Adoption flow for existing repos (the user-visible half): `arggon adopt` turns "start using ArggonManager here" into a tracked, agent-executable migration. Depends on story-adoption-state (doctor + provenance).

## Acceptance

- [x] `arggon adopt` landed (task generator + dry-run report); agent playbook documented so any agent can execute the migration task end-to-end
