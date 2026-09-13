---
type: task
status: done
id: task-comment-stdin-file
title: comment --file/stdin to end shell-quoting bugs
assignee: Arggon
branch: feat/task-comment-stdin-file
parent: story-item-comments
labels: []
created: "2026-09-13"
updated: "2026-09-13"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-item-comments/task-comment-stdin-file.md
  Leaves live only under a story. id is the filename stem: task-comment-stdin-file.
  CLI `arggon create task comment-stdin-file` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# comment --file/stdin to end shell-quoting bugs

## Context

cuentas-claras feedback: a comment containing backticks was mangled by shell command substitution — the tool accepted the mangled text without complaint. Fix class: accept the text outside the shell.

## Acceptance

- [x] `arggon comment <id> --file <path>` and `--file -` (stdin) read the comment text; positional text stays supported
- [x] Test: backticks/quotes/$ in file content land byte-identical in the body

### 2026-09-13 @Arggon
Done on `feat/task-comment-stdin-file`: `comment <id> --file <path>` (and `--file -` for stdin) reads the text verbatim outside the shell; both-text-and-file, missing-file and empty-file all fail actionable. 6 kernel/CLI tests added (639 green).
