---
type: story
status: done
id: start-worktree-ergonomics
title: Worktree start ergonomics
parent: cli
labels: []
created: "2026-09-18"
updated: "2026-09-18"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/start-worktree-ergonomics/start-worktree-ergonomics.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Worktree start ergonomics

## Context

`arggon start <id> --worktree` is the one-flow claim → branch → worktree →
commit → push primitive. In repos that wire the documented pre-commit gate
(`npm run arggon -- validate`), the flow fails inside the **fresh** worktree
because the gate needs the project's dependencies, the worktree has no
`node_modules`, and the failure rolls the whole worktree back — so the
documented "start, then symlink" order cannot work and every worker must
pre-create the worktree manually.

Surfaced by two OpenCode2 program workers on 2026-09-18 (evidence in
`bug-start-worktree-node-modules`).

## Acceptance

- [x] The failure mode is reproduced on a fixture and the chosen behavior is
      decided and recorded (link the ADR if the fix is cross-cutting): the
      candidate space is (a) prepare the worktree so the project gate can run
      (e.g. link the primary checkout's `node_modules` when present — the
      convention already documented for this repo), (b) do not roll back the
      worktree on a hook failure and surface an actionable remediation, or
      (c) document the manual sequence as the supported path.
- [x] Implementation + regression test: `start --worktree` on a hook-enabled
      repo fixture behaves per the decision, with expected-vs-observed evidence.
- [x] Guidance updated (`docs/agents.md` worktree section, the `arggon-cli`
      skill, and any `start` help text) so agents need no manual workaround.
- [x] No shortcuts: the pre-commit gate keeps running where the project wired
      it; the fix must not silently bypass hooks.

## Notes

- This story owns the affected area; the bug under it
  (`bug-start-worktree-node-modules`) carries the repro and the worker
  impact.
