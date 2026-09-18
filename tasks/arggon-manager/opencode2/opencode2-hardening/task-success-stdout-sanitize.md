---
type: task
status: in_progress
id: task-success-stdout-sanitize
title: "Success-path stdout: sanitize remaining dynamic values (update path/movedFrom/renamedFrom, command path lines)"
assignee: Arggon
branch: feat/task-success-stdout-sanitize
parent: opencode2-hardening
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T21:04:03.859Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-success-stdout-sanitize
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/opencode2-hardening/task-success-stdout-sanitize.md
  Leaves live only under a story. id is the filename stem: task-success-stdout-sanitize.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Success-path stdout: sanitize remaining dynamic values (update path/movedFrom/renamedFrom, command path lines)

## Context

Open note from PR #348 (`bug-validate-stdout-injection`): failure/finding
channels are sanitized, but **success-path** dynamic values are still raw on
human stdout — e.g. `arggon update` prints `result.path` / `movedFrom` /
`renamedFrom`, baseline paths are echoed (`--baseline`/`--save-baseline` argv),
and other commands print path/status lines built from repo-controlled values.
The sanitizer (`cli/src/sanitize.ts`) is already available.

## Acceptance

- [ ] Audit success-path human stdout for interpolated repo-controlled values
      (paths, ids, branch names) and sanitize where untrusted or explicitly
      document the boundary with rationale (argv values are operator-controlled;
      decide and record).
- [ ] Tests: hostile-named item through `update` (incl. a reparent/rename that
      exercises `movedFrom`/`renamedFrom`) renders inert; ordinary output
      byte-identical; `--json` raw.
- [ ] Full suite, lint, `validate`/`spec validate` green; small PR to
      `opencode2`.

## Notes

- Final channel of the human-output hygiene chain (doctor report → CLI errors →
  validate/spec stdout → success stdout).
