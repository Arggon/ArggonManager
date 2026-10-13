---
type: bug
status: todo
id: bug-retired-agent-ids-in-doc-samples
title: "Retired agent ids survive in shipped doc samples (json-output.md plain doctor sample; ArggonManager/docs/** sits outside the family walk)"
parent: story-adapter-selection
labels: [docs, tests, adopters]
created: "2026-10-13"
updated: "2026-10-13"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/bug-retired-agent-ids-in-doc-samples.md
  Leaves live only under a story. id is the filename stem: bug-retired-agent-ids-in-doc-samples.
  CLI `arggon create bug retired-agent-ids-in-doc-samples` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Retired agent ids survive in shipped doc samples (json-output.md plain doctor sample; ArggonManager/docs/** sits outside the family walk)

## Context

PR #762 re-measured the `doctor --agents` sample block and its caption, but the plain (non-`--agents`) `doctor` sample at `ArggonManager/docs/json-output.md:857` still names retired seam ids (`arggon-coordinator|arggon-reviewer|arggon-worker`). The family walk added by `bug-adopter-engineering-template-software-locked` (PR #758) sweeps `templates/docs/**` only — `ArggonManager/docs/**` and the `smokes/agents.md` samples sit outside it, so a retired id can still ship green. The PR #762 verdict explicitly assigns this to its own item.

## Acceptance

- [ ] shipped doc samples name only shipped seam ids (json-output.md plain doctor sample + every other hit from a grep for retired ids across `ArggonManager/docs/**`)
- [ ] a guard covers the shipped docs samples (or the template-family walk is extended to `ArggonManager/docs/**`) so a retired id cannot ship green
- [ ] grep evidence in the item; `arggon validate` + affected suites green

## Notes
