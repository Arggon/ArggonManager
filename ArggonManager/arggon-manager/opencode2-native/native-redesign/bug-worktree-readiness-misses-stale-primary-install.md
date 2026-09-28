---
type: bug
status: todo
id: bug-worktree-readiness-misses-stale-primary-install
title: "Worktree dependency prep reports ready: true while a declared devDependency is missing from the linked primary install"
parent: native-redesign
labels: [opencode-seam, worktree, install]
priority: p2
created: "2026-09-28"
updated: "2026-09-28"
---

<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-worktree-readiness-misses-stale-primary-install.md
  Leaves live only under a story. id is the filename stem: bug-worktree-readiness-misses-stale-primary-install.
  CLI `arggon create bug worktree-readiness-misses-stale-primary-install` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Worktree dependency prep reports ready: true while a declared devDependency is missing from the linked primary install

## Context

`tools.arggon.start` prepares a fresh worktree with `prepareWorktreeDependencies`
(`lib/src/worktree.ts`), which links the **primary's** `node_modules` as a per-worktree link
farm and reports a receipt. On this machine the receipt says the worktree is ready while a
declared devDependency is not installed anywhere it can be resolved from:

- `package.json` declares `@ast-grep/cli` at exactly `0.45.3` (merged with PR #418).
- `node_modules/@ast-grep` is **absent** in the primary checkout.
- `tools.arggon.start` still returned `{ "ready": true, "install": "linked", "linkedNodeModules": true, "builtWorkspaces": ["@arggondev/lib"], "linkedWorkspaces": [] }`.

So `ready: true` currently means "a linked `node_modules` exists and no workspace package
resolves into the primary" — it says nothing about whether the install actually satisfies
`package.json`. Two workers on 2026-09-28 hit this: the PR #423 worker could not run
`npm run lint:structure` / `npm run test:structure` at all (the scripts invoke `ast-grep`,
absent from the install; it failed identically on the untouched claim commit), and the PR #422
worker fell back to running the same pinned `0.45.3` through the npx cache. CI is the only thing
that actually ran the guard.

The link farm is a deliberate design (it is what makes the pre-commit gate work in a cold
worktree — `bug-native-start-worktree-no-install`), so the fix is not "stop linking". It is
that a merged devDependency is invisible in every worktree until the primary is re-installed,
and the receipt presents that state as ready.

## Acceptance

- [ ] The preparation receipt distinguishes "linked install present" from "install satisfies the declared `devDependencies`", and a stale primary install is not reported as `ready: true` without a bounded explanation of what is missing.
- [ ] Name the concrete missing package(s) in the receipt (bounded, list-capped) so the fix is actionable without a diffing script.
- [ ] Document the remedy where the install is mirrored (re-install the primary, or give the worktree its own install) — in `ArggonManager/docs/agents.md` and/or the worktree section of `ArggonManager/docs/opencode2.md`.
- [ ] Keep the reported state non-fatal: a stale primary install must still produce a usable worktree, not a failed `start`.
- [ ] Add a deterministic test for a declared-but-uninstalled dependency: the receipt names it and readiness is not silently claimed.
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run check:plugin` and `arggon validate` are green.

## Notes

Found 2026-09-28 while reviewing PR #423. The immediate local remedy for the machine is
`npm install` in the primary checkout; the item exists because the _receipt_ claims readiness
that the gate then cannot use, which will recur for every future devDependency addition.
