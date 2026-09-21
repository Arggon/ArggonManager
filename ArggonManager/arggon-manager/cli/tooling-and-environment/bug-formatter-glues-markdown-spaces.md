---
type: bug
status: in_progress
id: bug-formatter-glues-markdown-spaces
title: Formatter glues markdown spaces around inline code (prettier 3.9.6)
assignee: Arggon
branch: fix/bug-formatter-glues-markdown-spaces
parent: tooling-and-environment
labels: []
priority: p3
created: "2026-09-21"
updated: "2026-09-21"
claimed_at: "2026-09-21T22:40:49.883Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-formatter-glues-markdown-spaces
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-formatter-glues-markdown-spaces.md
  Leaves live only under a story. id is the filename stem: bug-formatter-glues-markdown-spaces.
  CLI `arggon create bug formatter-glues-markdown-spaces` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Formatter glues markdown spaces around inline code (prettier 3.9.6)

## Context

Found in the PR #384 review (`task-native-lib-hygiene`, finding F1): with the
repo's `formatter: true`, prettier 3.9.6 **removes the spaces around inline
code spans** in `ArggonManager/docs/json-output.md` (reproduced on the intact
base: `prettier --write` over `origin/opencode2:docs/json-output.md` produces
the four glued tokens, and `prettier --check` already warns at base). The file
cannot be prose-correct and prettier-clean at the same time; CI does not run
prettier, so the corruption went unnoticed until a review token-diff. The fix
restored the spaces, leaving `prettier --check` warning only on that file.

## Acceptance

- [ ] Decide the guard: pin/configure prettier so it stops gluing inline-code
      spacing, exclude markdown prose from `npm run format`, or add a prose
      token-diff check.
- [ ] `npm run format` no longer corrupts `docs/json-output.md` (or the
      exclusion is documented).
- [ ] Any existing glued tokens elsewhere in docs are repaired (token-diff).
- [ ] `arggon validate` green; CI green.

## Notes

- Filed per the review-findings rule; cosmetic but recurring (the auto-formatter
  runs on every edit in this repo).
