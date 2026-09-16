---
type: bug
status: in_progress
id: bug-torture-contention-flake3
title: "labs/torture auto-commit contention flakes in CI for the THIRD time (post-#214 hardening)"
assignee: Arggon
parent: story-self-improvement
labels: []
created: "2026-09-15"
updated: "2026-09-16"
claimed_at: "2026-09-16T11:42:40.109Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/bug-torture-contention-flake3.md
  Leaves live only under a story. id is the filename stem: bug-torture-contention-flake3.
  CLI `arggon create bug torture-contention-flake3` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# labs/torture auto-commit contention flakes in CI for the THIRD time (post-#214 hardening)

## Context

THIRD CI occurrence of the labs/torture scenario-2 contention flake (family: bug-autocommit-silent-skip -> flake2 -> this). This time in PR #260's first CI run (2026-09-15): dirty `task-f.md` after the run, passing on rerun and locally — PERSISTING despite (a) the 10s wall-clock retry budget (#168) and (b) the test-level retry of reported skips (#214) and (c) the residue-probe reporting (#241). The incremental-hardening approach is not converging: each fix addresses the last observed interleave, and CI load produces a new one.

## Acceptance

- [ ] Root-cause pass with fresh eyes: collect ALL observed interleaves (flake, flake2, this) and identify what the retry-at-observation-level still misses (e.g. a skip flavor whose retry re-enters contention, or a window between the residue probe and collection)
- [ ] Structural fix landed: either real isolation (per-fixture GIT_DIR/TMPDIR so the 6 workers race only each other, not system git state) or an explicit CI-load-aware strategy — with the clean-tree contract PRESERVED (no assertion weakening)
- [ ] Evidence: green across repeated runs AND a stress reproduction (documented method), not a single lucky pass

## Notes
