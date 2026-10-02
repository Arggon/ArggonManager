---
type: task
status: todo
id: task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters
title: "init/adopt: report-only .arggon.env gitignore hint for adopters"
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: []
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters.md
  Leaves live only under a story. id is the filename stem: task-initadopt-report-only-arggonenv-gitignore-hint-for-adopters.
  CLI `arggon create task initadopt-report-only-arggonenv-gitignore-hint-for-adopters` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init/adopt: report-only .arggon.env gitignore hint for adopters

## Context

Decision recorded on bug-gitignore-missing-arggon-env (2026-10-02): `init`/`adopt`
must never silently rewrite an adopter's existing `.gitignore`, but a bare
documented hand-step proved insufficient -- this repo adopted before the
worktree-env-contract-016 template shipped and never gained the entry
(bug-gitignore-missing-arggon-env). The contract should tell adopters the
expected one-line append without touching their file.


## Acceptance

- [ ] `arggon init`, `arggon adopt`, and/or `arggon doctor` report (stdout +
      `--json` note) when the repo's tracked `.gitignore` lacks a `.arggon.env`
      ignore entry, naming the contract (spec worktree-env-contract-016) to explain.
- [ ] The report is strictly report-only: no file is written, modified, or staged.
- [ ] spec-worktree-env-contract-016 documents the adopter hand-step (the exact
      line to append) so existing repos know what to add.
- [ ] Test/fixture coverage for the report path (init/adopt test with an
      existing adopter `.gitignore` missing the entry).


## Notes
