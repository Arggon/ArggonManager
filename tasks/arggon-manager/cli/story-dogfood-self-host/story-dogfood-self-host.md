---
type: story
status: done
id: story-dogfood-self-host
title: "Eat your own dogfood: self-host the full arggon stack in this repo"
assignee: Arggon
branch: feat/story-dogfood-self-host-impl
parent: cli
labels: []
created: "2026-09-13"
updated: "2026-09-13"
claimed_at: "2026-09-13T15:45:32.858Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-dogfood-self-host/story-dogfood-self-host.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Eat your own dogfood: self-host the full arggon stack in this repo

## Context

2026-09-13 audit: the repo distributes init --full (document set + skill bundle), convention v3 and playbooks to adopters — but doctor reports docs.managed: 0, tasks/.convention.yml is version 0 with no x-* extensions, .agents/ doesn't exist, playbooks are absent, and there is no pre-commit hook. The repo self-hosts the tracker but not the configuration and governance layer it sells. This story applies the full stack to ArggonManager itself.

## Acceptance

- [x] Convention v3 declared, x-tracker.auto-commit active, pre-commit hook installed, skill bundled at .agents/, missing init docs generated, 3 base playbooks created with researched versions, doctor reports a healthy self-hosted state
