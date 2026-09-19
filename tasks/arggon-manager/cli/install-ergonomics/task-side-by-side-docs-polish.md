---
type: task
status: todo
id: task-side-by-side-docs-polish
title: "Side-by-side docs polish: Option B rebuild wording + mise.local.toml ignore"
parent: install-ergonomics
labels: []
priority: p3
created: "2026-09-19"
updated: "2026-09-19"
---

<!--
  Placement (v0): tasks/arggon-manager/cli/install-ergonomics/task-side-by-side-docs-polish.md
  Leaves live only under a story. id is the filename stem: task-side-by-side-docs-polish.
  CLI `arggon create task side-by-side-docs-polish` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Side-by-side docs polish: Option B rebuild wording + mise.local.toml ignore

## Context

Non-blocking findings from the PR #365 review (`task-opencode2-side-by-side-installs`,
merged as `bc6291e`):

- **F1 (low)** — the "Dev checkout bootstrap" paragraph says "rebuild after
  every pull or branch switch — both shims execute `dist/`". True for Option A
  (the named shim executes the checkout's `dist/`), but the Option B
  `--install-links` copy is frozen: it needs reinstall/repack, not a rebuild.
  Split the sentence per option.
- **F2 (info/optional)** — `mise.local.toml` is not in the repo `.gitignore`
  (on this machine it lives in `.git/info/exclude`). Add it to `.gitignore` if
  the local-config pattern stays recommended; the docs already say "keep it out
  of git".
- **F3 (info)** — the `plugin.list` example output is simplified (real output
  includes ~80 builtin plugins). No action.

## Acceptance

- [ ] `docs/opencode2.md` distinguishes rebuild (Option A) vs reinstall/repack
      (Option B) in the dev bootstrap paragraph.
- [ ] `.gitignore` covers `mise.local.toml`, or the docs no longer imply it is
      an in-tree file.
- [ ] `arggon validate` green; docs-only diff.

## Notes

- Superseded if `task-native-capability-audit` drops the CLI install story
  (`opencode2-native` epic); cancel with a comment in that case.
