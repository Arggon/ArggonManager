---
type: bug
status: in_progress
id: bug-doctor-human-output-injection
title: "doctor human output: sanitize remaining untrusted channels (git remote URL, C1 controls)"
assignee: Arggon
branch: fix/bug-doctor-human-output-injection
parent: opencode2-hardening
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T15:39:32.655Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-doctor-human-output-injection
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/bug-doctor-human-output-injection.md
  Leaves live only under a story. id is the filename stem: bug-doctor-human-output-injection.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# doctor human output: sanitize remaining untrusted channels (git remote URL, C1 controls)

## Context

F2/F3 from the independent review of PR #336 (`task-opencode-v2-doctor-polish`),
which fixed the `opencode` hint channel. Two residual channels remain:

- **F2 — `git.remote` is interpolated raw.** `formatGitLine` puts the remote URL
  straight into the human `git:` line: a remote containing a newline fabricates
  a column-0 line (`spoof: fake hint.git`), and an ESC passes through
  (repro in the review: `git remote add origin "$(printf 'https://example.com/evil\nspoof: fake hint.git')"`).
  Pre-existing (`bug-init-git-doctor-blindspot`), same class as the fixed hint.
- **F3 — sanitizer fallback leaves C1/DEL/U+2028-29 raw.**
  `sanitizeHumanValue`'s `JSON.stringify` fallback escapes C0 but not
  `U+007F`–`U+009F` (8-bit CSI/OSC are terminal-dependent vectors) nor
  `U+2028/29`; the rendered key length is also uncapped (single-line but long).

## Acceptance

- [ ] `git.remote` (and other interpolated repo values such as the root path)
      run through the same sanitizer; a test with a newline+ESC remote renders
      one inert line.
- [ ] The sanitizer fallback also escapes `U+007F`–`U+009F` and `U+2028/29`
      (or the boundary is explicitly documented with rationale); tests both
      directions.
- [ ] Untrusted rendered values get a bounded length (or the decision to keep
      them uncapped is recorded).
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Report-only command; no data risk — this is terminal-output hygiene.

### 2026-09-18 @Arggon
Evidence — F2/F3 implementation (PR #341, draft; no merge, no status flip)

**F2 — git.remote + root path sanitized** (`cli/src/doctor.ts`):
- `formatGitLine` -> `sanitizeHumanText(git.remote)`; report header -> `sanitizeHumanText(root)`; `budgetError` line sanitized too. Escape-in-place keeps clean output byte-identical (no JSON quoting of ordinary paths/URLs).
- Fixture remote `https://example.com/evil\nspoof: fake hint.git\u001b[31m`:
  - BEFORE human: fabricated column-0 `spoof: fake hint.git` line + raw ESC (`^[[31m`).
  - AFTER human (5 lines): `  git: repo, dirty, remote https://example.com/evil\nspoof: fake hint.git\u001b[31m` — literal `\n` / `\u001b`, no raw ESC, no fabricated line.
  - JSON before == after: `{"isRepo":true,"dirty":true,"remote":"https://example.com/evil\nspoof: fake hint.git\u001b[31m"}`; CLI `--json` round trip pinned by test.
- Hostile root path (ESC + newline + NEL + U+2028 in the directory name) renders inert on the header line; `result.root` stays raw.

**F3 — sanitizer fallback extended** (shared C0/DEL/C1/U+2028/29 escape pass):
- Key carrying U+009B/U+009D/U+0085/U+007F/U+2028/U+2029 renders as `"mcp.csi\u009bosc\u009dnel\u0085del\u007fls\u2028ps\u2029end"` (no raw DEL/C1/LS/PS in the report); `doctor --json` keeps the raw key bytes.
- Bidi/zero-width boundary documented (code comment + `docs/json-output.md`).

**Bounded length — DECISION: cap** at `MAX_HUMAN_VALUE_CHARS = 200` + `…`, applied before escaping (escapes add <= 6x); JSON stays raw/uncapped. Long remote: human `git:` line 228 chars ending in `…`, JSON 620 chars; long config keys capped the same way.

**Gates**: `npm test` 70 files / 1162 tests passed; `npm run lint` clean; `npm run build` clean; `arggon validate --json` ok (0 warnings); `arggon spec validate --json` ok; pre-commit `arggon validate` ok.

Files: `cli/src/doctor.ts`, `cli/src/doctor.test.ts`, `docs/json-output.md`. PR: https://github.com/Arggon/ArggonManager/pull/341

### handoff 2026-09-18 @Arggon (session: ses_f4ad40e77fferCmzyNYYkx3bNI) — next: Review draft PR #341 against opencode2; address any review findings as follow-up items; coordinator/reviewer merges and flips status (worker does not merge or flip).
- branch: fix/bug-doctor-human-output-injection
- open questions: None — bounded-length decision recorded: cap 200 chars + ellipsis (MAX_HUMAN_VALUE_CHARS), JSON raw/uncapped
