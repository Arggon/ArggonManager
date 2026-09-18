---
type: task
status: in_progress
id: task-opencode2-seam-nits
title: "Seam nits: anchor docstring scope + propose plan decision enumeration"
assignee: Arggon
branch: feat/task-opencode2-seam-nits
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T16:42:45.387Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode2-seam-nits
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-opencode2-seam-nits.md
  Leaves live only under a story. id is the filename stem: task-opencode2-seam-nits.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Seam nits: anchor docstring scope + propose plan decision enumeration

## Context

Two non-blocking findings from the independent review of PR #332
(`task-opencode2-seam-polish`).

- **F1 — anchor docstring overstates.** `isArggonGeneratedConfig` uses the
  first `//` comment line *anywhere* in the file; the docstring says such a
  config "must not be claimed". A config whose only comment appears after JSON
  content and contains the phrase is still claimed (repro in the review;
  failure is in the safe direction — skip, never clobber). Fix the wording or
  tighten the anchor (e.g. first two lines), with a test for the chosen shape.
- **F2 — propose plan enumeration.** `docs/json-output.md`'s `plan` row does not
  cross-reference the `--propose` decision values
  (`proposed|absorbed|stale|informational`) that `init --dry-run --propose
  --json` can emit; the `proposals` row documents them. Add a one-clause
  cross-reference so "every `plan[].decision`" is literally true.

## Acceptance

- [ ] Docstring and behavior agree for the anchor rule, with a test pinning the
      chosen semantics (string-value/later-comment shapes keep `present-skip`).
- [ ] `docs/json-output.md` `plan` row cross-references the propose values.
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Both are wording/robustness nits; behavior is already safe.
