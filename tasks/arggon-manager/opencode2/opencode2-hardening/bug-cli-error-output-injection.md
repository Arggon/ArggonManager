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

### 2026-09-18 @Arggon
### 2026-09-18 @Arggon
Evidence — F-1/F-2/F-3 implementation (PR #343, draft; no merge, no status flip)

**F-1 — error-channel sanitization** (`cli/src/cli.ts` + new `cli/src/sanitize.ts`)
- Shared module: the doctor sanitizer moved to `cli/src/sanitize.ts` (`sanitizeHumanText`, `sanitizeHumanValue`, plus the new `sanitizeHumanError`); `doctor.ts` imports it and re-exports `MAX_HUMAN_VALUE_CHARS` (doctor report behavior unchanged, cap 200).
- `cli.ts` routes every dynamic human failure line through one `printHumanError(label, message)` helper -> `sanitizeHumanError(message)` (escapes C0/DEL/C1/LS/PS as inert text; raw cap `MAX_HUMAN_ERROR_CHARS` = 2000 + `…`).
- Sanitized catch paths (37): init, doctor, adopt, create, list, next, show, report (x4, incl. the report/trend `fail` helper), update, priority migrate, comment, handoff, import-issues, validate, spec, spec analyze, spec audit, spec new, spec import openspec, stack explore, playbook new, playbook status (x3), playbook refresh, branch, start (x2), cleanup, board (x2, incl. the `jsonFailed` helper), sync, instructions.
- Also sanitized (dynamic failure output outside catch blocks): cleanup `failed:` lines (`action.error` + leftover branch) and `failures[]`, sync `errors:` line, `spec import <format>` unsupported-format line, board `jsonFailed` validation lines.
- Deliberately left raw: the 3 `arggon: warning:` stderr lines in `printInitDryRun`/`printInitHuman` — `result.warning` is the static `NOT_A_REPO_WARNING` contract string (no repo-controlled content). Success stdout is out of scope for this item. `--json` envelopes are untouched by design (raw `error.message`).
- Latent footgun found and removed while extracting: a positional `maxChars` parameter made `keys.map(sanitizeHumanValue)` pass the array index as the cap (two pre-existing doctor tests went red: `"…"`, `"m…"`). `sanitizeHumanValue`/`sanitizeHumanText` now take exactly one parameter; the error channel is a named `sanitizeHumanError`, not a positional cap.

**Repro evidence (F-1)** — item file `bad\nspoof: fake item<ESC>[31m<U+0085><DEL><U+2028><U+2029>.md` with `status: bogus`, run `arggon doctor`:
- BEFORE stderr (cat -v): 2 real lines — `arggon doctor: .../bad` / `spoof: fake item^[[31mM-BM-^E^?M-bM-^@-(M-bM-^@-).md: unknown status 'bogus'`; raw ESC/DEL/C1/LS/PS; exit 1; stdout empty.
- AFTER stderr (cat -v): 1 inert line — `arggon doctor: .../bad\nspoof: fake item\u001b[31m\u0085\u007f\u2028\u2029.md: unknown status 'bogus'`; exit 1; stdout empty.
- AFTER `doctor --json`: single valid JSON object, `error.code: DOCTOR_FAILED`; parsed `error.message` keeps the real newline and real ESC bytes — JSON contract unchanged.

**F-2** — `docs/json-output.md`: the doctor section now says the cap applies to the raw value BEFORE escaping (`MAX_HUMAN_VALUE_CHARS` = 200, `…` appended after the cut) and the rendered bound is `6 × (200 + 1)` = 1206; the Failures section documents human stderr sanitization + `MAX_HUMAN_ERROR_CHARS` (2000) and that `error.message` stays raw.

**F-3 tests** — new `cli/src/sanitize.test.ts` (10 tests: byte-identity positives incl. ordinary paths/URLs, C0/ESC/tab/NUL, DEL/C1/LS/PS, repro inert, raw cap + rendered bound, surrogate safety, larger error cap, token quoting/cap). New `doctor.test.ts` tests (3): hostile `budgetError` renders inert + JSON keeps raw; ordinary root/remote byte-identity (`  git: repo, dirty, remote git@github.com:example/example.git` exact); CLI hostile-item-name repro (stderr one inert line, `--json` raw).

**Gates** — `npm test` 71 files / 1175 tests green; `npm run lint` clean; `npm run build` clean; `arggon validate --json` ok (0/0); `arggon spec validate --json` ok. One intermediate full-suite run failed only the known cross-checkout `/tmp/arggon-budget-*` hygiene race in `measure.test.ts` (already documented in `task-opencode2-seam-polish`); a serial rerun is 1175/1175 green.

Files: `cli/src/sanitize.ts` (new), `cli/src/sanitize.test.ts` (new), `cli/src/cli.ts` (failure output only), `cli/src/doctor.ts` (import swap + re-export), `cli/src/doctor.test.ts`, `docs/json-output.md`. PR: https://github.com/Arggon/ArggonManager/pull/343

### handoff 2026-09-18 @Arggon — next: Review draft PR #343 against opencode2; file any findings as follow-up items; coordinator/reviewer merges and flips status (worker does not merge or flip).
- branch: fix/bug-cli-error-output-injection
- open questions: None — error-channel cap decision recorded (MAX_HUMAN_ERROR_CHARS = 2000 raw; JSON error.message stays raw/uncapped).
