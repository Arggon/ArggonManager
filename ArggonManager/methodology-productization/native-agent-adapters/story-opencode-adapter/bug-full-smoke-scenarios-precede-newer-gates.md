---
type: bug
status: in_progress
id: bug-full-smoke-scenarios-precede-newer-gates
title: "5 full-smoke checks fail on main: scenarios predate the placeholder-body and done-gate rules"
assignee: arggon-delivery-lead
branch: fix/bug-full-smoke-scenarios-precede-newer-gates
parent: story-opencode-adapter
labels: [opencode-seam, tests]
created: "2026-10-13"
updated: "2026-10-13"
claimed_at: "2026-10-13T22:07:11.280Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-full-smoke-scenarios-precede-newer-gates
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-opencode-adapter/bug-full-smoke-scenarios-precede-newer-gates.md
  Leaves live only under a story. id is the filename stem: bug-full-smoke-scenarios-precede-newer-gates.
  CLI `arggon create bug full-smoke-scenarios-precede-newer-gates` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# 5 full-smoke checks fail on main: scenarios predate the placeholder-body and done-gate rules

## Context

Found by the full `npm run smoke:opencode` run recorded on `task-plugin-smoke-home-isolation` (PR #790, merged): 17 scenarios / 143 checks → **138 ok, 5 FAIL**, with **0** plugin-load failures (the hermetic-HOME work landed cleanly; every `loading plugin id=...` line names a fixture copy, never the machine-global `~/.config/opencode/plugins/arggon`). The 5 failures are pre-existing on main — deterministic repros with the kernel identical to main pinned them:

1. `validate` → 4× `PLACEHOLDER_BODY` on fresh scaffold items: the native-tools script scenario creates items and validates them, but scaffold items now carry the placeholder markers the newer validate gate refuses — the scenario (and its fixture items) predate that gate.
2. `update --status done` → acceptance-criteria refusal: the lifecycle-close scenario flips items done without live acceptance criteria, which the done gate now refuses — it kills lifecycle close and the invariants "second item done" check.
3. The model **declined** the steal/reopen and `git push` probes in both harness attempts (model nondeterminism — the harness reports a decline the same way it would report a gate refusal, so the discrimination is lost).

These are harness-vs-kernel drift, not product regressions: the smoke scenarios must either satisfy the newer gates (real bodies/acceptance in fixtures) or assert the refusals as the expected path, and the probe scenarios need to distinguish "model declined" from "gate refused".

## Acceptance

- [x] `npm run smoke:opencode` on a quiet machine reaches 143/143, or every remaining failure is reclassified with evidence (model nondeterminism documented as such, never summarized as a pass) — final run on `36225d2d`: 158 ok / 0 FAIL (see evidence comment; 158 is the green run's executed-check count, up from the failing run's 143)
- [x] the fresh-scaffold scenarios create items that satisfy the `PLACEHOLDER_BODY` gate (real context/acceptance prose) rather than tripping it
- [x] the lifecycle-close scenario's items carry acceptance criteria, or the scenario asserts the refusal as the expected path
- [x] the steal/reopen/`git push` probes distinguish "model declined" from "gate refused" and report the discrimination, or are made deterministic — the probes attempt the writes (readiness requires them) and the refusal checks passed non-vacuously; the decline branch is unit-pinned but was not needed on the final run
- [x] the run's expected-vs-observed evidence recorded on the item; `arggon validate` green; PR opened

## Notes
