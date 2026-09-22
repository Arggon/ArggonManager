---
type: task
status: in_progress
id: task-start-build-exit-visibility
title: start build-exit visibility + symlink-fallback docs
assignee: Arggon
branch: feat/task-start-build-exit-visibility
parent: native-redesign
labels: []
priority: p3
created: "2026-09-22"
updated: "2026-09-22"
claimed_at: "2026-09-22T00:31:48.532Z"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-start-build-exit-visibility
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/task-start-build-exit-visibility.md
  Leaves live only under a story. id is the filename stem: task-start-build-exit-visibility.
  CLI `arggon create task start-build-exit-visibility` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# start build-exit visibility + symlink-fallback docs

## Context

Low findings from the PR #388 review (`task-start-worktree-lib-resolution`):

1. The build exit is ignored (`lib/src/worktree.ts:450-457,488-489`): a build
   that fails but still emits `dist/index.js` (tsc without `noEmitOnError`) is
   reported "built" and flips, while the docs (`json-output.md:418`,
   `pitfalls.md:78`) say "a failed build falls back visibly". Honor the exit or
   precise the docs (the gate still fails loudly if the kernel is broken).
2. `README`/`docs/agents.md` describe always the farm and omit the bare-symlink
   fallback (which `json-output`/skill do document).
3. Attach with a previous install runs the local build even when there is no
   farm to flip (~2s).

## Acceptance

- [ ] Build failure semantics match the docs (exit honored, or the wording
      corrected), with a test for the failing-build-emits-dist case.
- [ ] README/agents mention the bare-symlink fallback.
- [ ] The attach-with-previous-install path skips the build when there is no
      farm to flip (or the cost is documented as accepted).
- [ ] `arggon validate` green; CI green.

## Notes

- Filed from the PR #388 review; non-blocking.

### 2026-09-22 @Arggon
## Worker evidence (2026-09-21 @Arggon) — branch feat/task-start-build-exit-visibility, PR #390

Commit `638b69c` (code + tests + docs + regenerated bundle); not done — coordinator owns merge + done.

Implemented findings 1–3 (all three; the "doc-only" option was not needed):
1. **Exit honored.** `WorkspaceBuildRunner` now reports success (spawn error / non-zero exit / signal = failure) and `buildLocalWorkspaces` flips the farm entry only after a successful build. A build that fails yet still emits `dist/index.js` (`tsc` without `noEmitOnError`) keeps the primary's copy and lands in `linkedWorkspaces`; the `json-output.md`/`pitfalls.md` wording is now true.
2. **Bare-symlink fallback documented** in `README.md` and `ArggonManager/docs/agents.md` (+ `json-output.md`/skill state the exit contract and the skip).
3. **Attach skip.** A build runs only when the install can consume it: start's own farm (flip) or a reified `npm ci` install whose workspace link already resolves the worktree copy (the gate needs that entry). A bare symlink to the primary install has no farm to flip → skipped, so attach re-runs stop paying the ~2s build.

Tests (mutation-verified: removing either guard fails 2 tests):
- `cli/src/start.test.ts`: failing-build-emits-entry keeps primary; bare-symlink attach skips; reified install still builds.
- `cli/src/worktree.test.ts` (real git + real `npm run build` + real pre-commit gate): failing-emits e2e and attach-skip e2e.

Before/after repro (real CLI on a /tmp fixture repo, real gate hook recording `require.resolve("@arggon/lib")`):
- Phase A, fresh `start --worktree` with a build that emits `dist/index.js` then exits 1 — before: `linkedWorkspaces: []`, farm entry flipped to the worktree copy, gate resolved `<wt>/lib/dist/index.js`; after: `linkedWorkspaces: ["@arggon/lib"]`, farm entry → primary, gate resolved `<primary>/lib/dist/index.js`. The build emitted the entry in both runs (yes).
- Phase B, attach to a pre-created worktree whose install is a bare symlink — before: worktree `lib/dist` PRESENT (wasted build); after: absent (skipped), gate resolved the primary's copy.

Gates on `638b69c`: `npm test` 1494/1495 — the only failure is the pre-existing `bug-measure-tmp-hygiene-flake` (shared-`/tmp` race with concurrent sibling suites; leftover dir names changed between runs; explicitly out of scope for this item) · `npm run lint` ✅ · `npm run build` ✅ · `npm run check:plugin` ✅ (bundle regenerated + committed) · `arggon validate` ✅ v5 · `arggon spec validate` ✅ 18 · prettier ✅ on every touched file.
CI: `cli` pass (4m16s, run 35673130685) + `tasks-validate` pass (37s, run 35673130879) on the pushed tip. PR #390 is draft and mergeable; tracker-carrying branch → merge commit, never squash.

Scope: `lib/src/worktree.ts`, `cli/src/{start,worktree}.test.ts`, `README.md`, `ArggonManager/docs/{agents,json-output}.md`, `skills/arggon-cli/references/pitfalls.md`, regenerated `opencode/plugins/arggon/index.bundle.ts`. No overlap with `cli/src/measure*` or the code-span sweep.

### handoff 2026-09-22 @Arggon — next: Review draft PR #390 (fix 638b69c + tracker commits); confirm CI on the final tip, merge with a merge commit (never squash), then flip done.
- branch: feat/task-start-build-exit-visibility
- open questions: None blocking. Deliberate: a reified npm ci install with a missing declared entry is still built (the gate needs it) — only a bare symlink to the primary install is skipped; the attach skip is proven…

### 2026-09-22 @Arggon
CI follow-up: the tracker tip `d067551` (code `638b69c` + this evidence comment) is green too — `cli` pass (4m13s, run 35673463151) + `tasks-validate` pass (38s, run 35673463179). No further commits are planned from this worker; the next tip move is the coordinator's review/merge (merge commit, never squash) and `done`.
