---
type: bug
status: todo
id: bug-doctor-human-output-injection
title: "doctor human output: sanitize remaining untrusted channels (git remote URL, C1 controls)"
priority: p2
parent: opencode2-hardening
labels: []
created: "2026-09-18"
updated: "2026-09-18"
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
