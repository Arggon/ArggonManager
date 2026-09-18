---
type: task
status: todo
id: task-opencode2-plugin-nits
title: "Plugin parsing nits: wrapper-prefixed invocations + playbook W3 bullet"
priority: p3
parent: opencode2-hardening
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-opencode2-plugin-nits.md
  Leaves live only under a story. id is the filename stem: task-opencode2-plugin-nits.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin parsing nits: wrapper-prefixed invocations + playbook W3 bullet

## Context

Non-blocking findings from the independent review of PR #337
(`task-opencode-v2-plugin-hardening`), filed per the repo rule.

- **F1 — over-anchoring drops realistic invocations.** The command-position
  parser misses `npx/bunx/sudo/env/command/time arggon …`, `x=$(arggon …)`,
  subshells, and newline-separated commands (the old parser caught most).
  Impact is one-sided (a missed observation, never a wrong id) and the dominant
  forms remain covered; extend `argCommandIndex` (skip wrapper prefixes, add
  runners, split on `\n`) **or** widen the best-effort docstring, with tests.
- **F2 — quoted separators still correlate.** Splitting on `;&|` happens before
  quote stripping, so `echo "&& arggon show task-x"` yields an id (contrived,
  pre-existing). Eliminate or document.
- **F4 — playbook W3 bullet incomplete (not false).** Add the anchoring,
  best-effort `arggon_*` regex, bounded/project-scoped caches, and the smoke
  `block=` independent measurement to `docs/playbooks/opencode.md`.

## Acceptance

- [ ] Wrapper-prefixed / `$()` / newline-separated invocations correlate again
      (tests), or the docstring documents exactly which forms are best-effort.
- [ ] Quoted-separator case eliminated or documented; the "quoted-string false
      positives eliminated" claim is precise.
- [ ] Playbook W3 bullet updated with anchoring, cache bounds, and smoke
      measurement.
- [ ] Full suite + `smoke:opencode` green; small PR to `opencode2`.

## Notes

- None of these block; the merged parser is conservative by design.
