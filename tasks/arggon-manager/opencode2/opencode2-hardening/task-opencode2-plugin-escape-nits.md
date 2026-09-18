---
type: task
status: todo
id: task-opencode2-plugin-escape-nits
title: "Plugin escape-edge nits: escaped \\\\( in command position + unbalanced quoted paths correlate"
priority: p3
parent: opencode2-hardening
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-opencode2-plugin-escape-nits.md
  Leaves live only under a story. id is the filename stem: task-opencode2-plugin-escape-nits.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Plugin escape-edge nits: escaped `\\(` in command position + unbalanced quoted paths correlate

## Context

F3 (pre-existing, base == current) from the independent review of PR #356
(`task-opencode2-plugin-quote-spans`), filed per the repo rule.

- `\\(arggon show task-x)` correlates but bash exits 2 on the syntax error
  (nothing runs) — the escaped-`$(` fix did not cover a double-escaped paren.
- `'(/usr/local/bin/arggon' show task-x` correlates but bash 127 (the unmatched
  quote makes a command name that does not exist).
- (Both are contrived shell-syntax-error inputs; the parser never yields a
  wrong id for executed commands.)

## Acceptance

- [ ] Both forms render `undefined` (or the residual is explicitly documented
      as best-effort with rationale); tests added.
- [ ] No regression of the quote-span/word semantics or the true positives.
- [ ] Full suite + `smoke:opencode` green; small PR to `opencode2`.

## Notes

- Last known pre-existing parser edge class; everything else is covered by the
  #337/#345/#352/#356 fixes.
