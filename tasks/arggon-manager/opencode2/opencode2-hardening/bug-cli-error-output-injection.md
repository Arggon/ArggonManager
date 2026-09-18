---
type: bug
status: in_progress
id: bug-cli-error-output-injection
title: "CLI error output injection: raw err.message on stderr (C1/DEL/LS-PS) + doctor sanitizer polish"
assignee: Arggon
branch: fix/bug-cli-error-output-injection
parent: opencode2-hardening
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T16:15:13.413Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-cli-error-output-injection
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/bug-cli-error-output-injection.md
  Leaves live only under a story. id is the filename stem: bug-cli-error-output-injection.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# CLI error output injection: raw err.message on stderr (C1/DEL/LS-PS) + doctor sanitizer polish

## Context

Findings from the independent review of PR #341
(`bug-doctor-human-output-injection`), which sanitized the doctor report body.

- **F-1 — error-path channel (pre-existing).** `cli/src/cli.ts:291` prints the
  raw `err.message` for doctor failures; messages embed repo-controlled values
  (root path, item file paths, `JSON.stringify`'d lines) and `JSON.stringify`
  escapes C0 but **not** C1/DEL/LS/PS. Repro: an item file named
  `bad\nspoof: fake item<ESC>[31m.md` with `status: bogus` → stderr fabricates a
  column-0 line and leaks the raw ESC (exit 1). Same threat class as the fixed
  report channels. Fix: sanitize error text on human stderr (reuse/extract the
  doctor sanitizer), audit the main catch paths that print messages embedding
  repo values; the `--json` error envelope stays as-is.
- **F-2 — docs cap wording.** `docs/json-output.md` says the rendered value is
  capped at 200 chars; the cap is applied before escaping, so a rendered value
  can reach ~1206 chars (each unsafe unit → ≤6). Fix the wording.
- **F-3 — test gaps.** `budgetError` sanitization has no test; no positive test
  that an ordinary remote/root renders byte-identical in human output.

## Acceptance

- [ ] Doctor's stderr failure line (and the audited catch paths) sanitize
      repo-controlled values; the hostile-item-name repro renders inert; JSON
      error output unchanged.
- [ ] `docs/json-output.md` cap wording distinguishes raw cap vs rendered bound.
- [ ] Tests: `budgetError` sanitization + ordinary remote/root byte-identity.
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Human-output hygiene only; `--json` consumers are machines and keep raw
  values (valid JSON).
