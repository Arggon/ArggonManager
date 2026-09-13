---
type: bug
status: done
id: bug-playbook-age-rollover
title: "Playbook status tests are date-sensitive: hardcoded age breaks after UTC midnight"
assignee: Arggon
branch: docs/skill-030
parent: story-tech-playbooks
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-tech-playbooks/bug-playbook-age-rollover.md
  Leaves live only under a story. id is the filename stem: bug-playbook-age-rollover.
  CLI `arggon create bug playbook-age-rollover` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Playbook status tests are date-sensitive: hardcoded age breaks after UTC midnight

## Context

CI on PR #114 failed (docs-only change): `playbooks.test.ts` CLI-level tests compute playbook age against the REAL clock with hardcoded expectations (researched 2026-06-01 = "103 days"). The assertions rolled over after UTC midnight (2026-09-12 -> 2026-09-13): local run (UTC-3) passed, CI (UTC) failed. Kernel `runPlaybookStatus` already accepts an injectable `now` — the CLI surface doesn't expose it.

## Acceptance

- [x] `playbook status --now <date>` (hidden, parseable ISO date, invalid -> PLAYBOOK_FAILED) threads an injectable clock through the CLI for deterministic runs
- [x] The two date-sensitive CLI tests pin `--now` and no longer depend on the real clock; suite green (proven flaky->fixed)

## Notes

Found while landing PR #114 (docs-only); the failure was unrelated to its change.
