---
type: bug
status: in_progress
id: bug-init-leaves-docs-untracked-start-blocks-on-clean-tree
title: "init leaves docs untracked, start blocks on clean-tree"
assignee: Arggon
branch: fix/bug-init-leaves-docs-untracked-start-blocks-on-clean-tree
parent: story-start-worktree
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T15:49:40.592Z"
---
<!--
  Placement (v0): tasks/agent-native/agent-coordination/story-start-worktree/bug-init-leaves-docs-untracked-start-blocks-on-clean-tree.md
  Leaves live only under a story. id is the filename stem: bug-init-leaves-docs-untracked-start-blocks-on-clean-tree.
  CLI `arggon create bug init-leaves-docs-untracked-start-blocks-on-clean-tree` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init leaves docs untracked, start blocks on clean-tree

## Context

Found by the first adversarial audit run (2026-09-14, task-audit-protocol; throwaway temp tree). A fresh `arggon init` does not commit the docs it generates (no auto-commit in cli/src/init.ts), leaving ~20 untracked files. Any subsequent `arggon start` in that tree refuses:

```
$ arggon init --json   # ok:true, creates AGENTS.md, tasks/, docs/tracking.md, ...
$ arggon start <id> --worktree --assignee me --json
{"ok":false,"error":{"code":"START_FAILED","message":"working tree has changes that block start (commit or stash first):
untracked files: .agents/ .editorconfig/ .github/ .mcp.json AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md docs/ ..."}}
```

This collides with the tracker-hygiene promise in docs/agents.md §0: "`start`'s clean-tree precondition never blocks tool-generated state" — init output IS tool-generated state. The adoption flow (init → start first item) hits this on every fresh repo and forces a manual commit an agent must invent.

Possible resolutions (decide as design): (a) init auto-commits its generated docs (tracker-hygiene style, surgical paths); (b) start's precondition whitelists untracked x-generated files; (c) reword the promise to scope it to tracker mutations only.

## Systemic evidence (telemetry mining pass, same day)

The tracker-commit history of every live experiment repo shows a **manual first commit of init/adopt-generated docs** — the friction this bug predicts, in 5/5 repos:

- racha `915c5db` "chore: register arggon MCP server (.mcp.json via init) + provenance state"
- estanteria `0f3417a` "chore: arggon init --full (convention v3) — governing docs, tasks tree, MCP registration"
- guardian `b5f1187` "chore: arggon init --full (árbol de governance con templates placeholder)"
- suizo `b725b6a` "chore: adopt ArggonManager — governing docs, tasks/ tree, templates"
- cuentas-claras `f4958e4` "chore: adopt ArggonManager — tasks/ tree + governing docs (init --full)"

## Acceptance

- [x] The chosen design landed: fresh `init` → `start` succeeds without a manual commit, or the promise text is scoped so it no longer covers init output (option (a): init auto-commits exactly the files it wrote via commitTrackerMutation, new `generated` verb, `--no-commit`/`x-tracker.auto-commit` honored; test proves `git status --porcelain` is empty after fresh init)
- [x] Regression test covering the fresh init → start sequence (or doc-only change noted in the item) (cli/src/init.test.ts: clean tree + HEAD contents after fresh init; ok in non-git dir; HEAD untouched on no-op re-run)

## Notes
