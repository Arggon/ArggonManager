---
type: task
status: done
id: task-opencode2-seam-nits
title: "Seam nits: anchor docstring scope + propose plan decision enumeration"
assignee: Arggon
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
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

- [x] Docstring and behavior agree for the anchor rule, with a test pinning the
      chosen semantics (string-value/later-comment shapes keep `present-skip`).
- [x] `docs/json-output.md` `plan` row cross-references the propose values.
- [x] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Both are wording/robustness nits; behavior is already safe.

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict MERGE; the two-line anchor still claims the generated shape (LF/CRLF), rejects the below-JSON comment (negative test fails against the old implementation at init-opencode.test.ts:269, verified in a scratch copy), keeps the updated[] positive path and the NIT-12 string-value present-skip; F2 plan↔proposals decision equality reproduced across section/whole-file modes and the doc row matches the init.ts emission; diff exactly 3 files +59/−6 plus tracker; 1192 tests + CI green; merged. Residual two-line-window case is safe-by-default and left as an optional future nit. Closing.
