---
type: bug
status: done
id: bug-start-worktree-node-modules
title: arggon start --worktree fails and rolls back in fresh worktrees without node_modules
assignee: Arggon
branch: fix/bug-start-worktree-node-modules
parent: start-worktree-ergonomics
labels: []
priority: p2
created: "2026-09-18"
updated: "2026-09-18"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-start-worktree-node-modules
---
<!--
  Placement (v0): tasks/arggon-manager/cli/start-worktree-ergonomics/bug-start-worktree-node-modules.md
  Leaves live only under a story. id is the filename stem: bug-start-worktree-node-modules.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# argon start --worktree fails and rolls back in fresh worktrees without node_modules

## Context

Hit twice by OpenCode2 program workers (2026-09-18) and once by the coordinator
while starting `task-opencode-v2-spec`. Repro on this repo (pre-commit hook =
`npm run arggon -- validate`, the documented wiring):

```
npm run arggon -- start task-opencode-v2-spec --worktree --assignee Arggon --json
```

Observed: `start` creates `../<repo>-<id>` on the item branch, runs the claim
commit inside it, the pre-commit hook fails
(`ERR_MODULE_NOT_FOUND: Cannot find package 'commander'` — no `node_modules` in
the fresh worktree), `start` returns `START_FAILED`, and **removes the
worktree**; the item stays unclaimed. The documented order (`start` →
symlink) cannot work because the symlink would be needed before the first
commit.

Workaround (used by both workers): `git worktree add <path> -b <branch>`,
`ln -s <primary-checkout>/node_modules <path>/node_modules`, then re-run
`start --worktree` (it attaches, claims, commits, pushes).

## Acceptance

- [x] Repro recorded on a fixture (hook-enabled repo, no deps in the worktree)
      with expected vs observed.
- [x] Behavior decided and implemented per `start-worktree-ergonomics`:
      prepare the worktree (link the primary `node_modules` when present) **or**
      keep the worktree on hook failure with an actionable error **or** make the
      manual sequence the documented path.
- [x] Regression test covers the chosen behavior (fixture with a pre-commit
      gate).
- [x] `docs/agents.md` worktree guidance + the `arggon-cli` skill updated; no
      hook is silently bypassed.

## Notes

- The failure is honest (it surfaces the missing dependency), but the rollback
  destroys the diagnostic context and forces every agent to redo the manual
  dance; the fix is about ergonomics, not about skipping gates.

### 2026-09-18 @Arggon
Decision (worker Arggon): prepare the worktree + never destroy it on failure.

Repro (documented in the body, hit by two workers + coordinator): fresh worktree has no node_modules, the wired pre-commit gate ('npm run arggon -- validate') dies with ERR_MODULE_NOT_FOUND, and start removes the worktree instead of leaving it diagnosable.

Decided behavior:
1. Prepare: after worktree add (create or attach) and before the claim commit, if the primary checkout has node_modules and the worktree does not, symlink it into the worktree. Best-effort (try/catch, no-op when the primary has none); reported in human output and as the additive JSON field linkedNodeModules.
2. Never destroy: no rollback path remains. Any failure after the worktree exists keeps the worktree and branch, and the error names the failing step, the worktree path, a step-specific remediation, and that re-running 'start --worktree' attaches.
3. No hook bypass: --no-verify is never used; the fixture test proves the pre-commit gate executes inside the worktree (the gate's dependency require is what makes the first start succeed).

Out of scope note: the post-start x-worktree hook remains non-fatal and unchanged.

### 2026-09-18 @Arggon
### Evidence: fixture probes (real CLI from this branch), expected vs observed

Harness: scratch git repos (`init` + initiative/epic/story/task), bare `origin`, a fake `node_modules/fake-gate-dep`, and a pre-commit hook that `require`s it — the stand-in for the documented `npm run arggon -- validate` gate. Raw log: `/tmp/opencode/probe-bug-start-worktree-node-modules-output.txt`; script: `/tmp/opencode/probe-bug-start-worktree-node-modules.sh`.

**(a) fresh worktree + dependency-requiring gate** — expected: exit 0, `linkedNodeModules:true`, gate ran, symlink, claim commit. Observed: exit 0; JSON `"linkedNodeModules":true`; `node_modules -> <primary>/node_modules` symlink; `.gate-ran` marker present (gate really ran inside the worktree — no bypass); `claim: task-alpha` commit; the claim commit touches only the item file, so the link was never committed.

**(b) deliberately failing gate** — expected: exit 1 `START_FAILED`; message names failing step, worktree path, remediation, attach; worktree+branch kept. Observed: exit 1; message = `start failed while committing the claim (pre-commit gate); the worktree was kept at <path> (nothing was rolled back).` + git's `gate: deliberate failure` + `...re-run \`arggon start task-alpha --worktree\` — it attaches to the existing worktree. To discard it instead: ...`; worktree dir exists, 2 worktrees registered, `feat/task-alpha` branch exists, item staged-but-uncommitted (`M  tasks/launch/auth/login/task-alpha.md`). Follow-up probe: after fixing the hook, re-run attaches (`worktreeCreated:false`) and lands the claim commit.

**(c) repo without a hook / without primary node_modules** — expected: exit 0, `linkedNodeModules:false`, no link, claim commit. Observed: exit 0; `"linkedNodeModules":false`; no `node_modules` in the worktree; `claim: task-alpha`.

**(d) additive JSON field** — expected: key present, false when no link. Observed: non-worktree `start task-bravo` -> `"linkedNodeModules":false`; (a) true; (c) false; `cli/src/cli.test.ts` asserts the envelope key.

Automated coverage: `cli/src/worktree.test.ts` (link+report; keep+remediation+attach re-run; no-hook unaffected), `cli/src/start.test.ts` (`linkNodeModules` unit matrix + field false without `--worktree`), `cli/src/cli.test.ts` (envelope key). Full suite 1117 passed / 69 files; `lint`, `build`, `validate`, `spec validate` green.

Hooks are never bypassed: `--no-verify` is never passed, the gate must succeed for the commit to land, and its stderr is preserved in the kept-worktree failure.

### handoff 2026-09-18 @Arggon (session: ses_f4b5fb92cffeP7AJAkzMXS6FvY) — next: Coordinator: review PR #333 (draft, base opencode2), verify the fixture evidence + gates, then merge. Worker stops here: no merge, no status flip.
- branch: fix/bug-start-worktree-node-modules
- open questions: None blocking. Note: a re-run attach retries a failed claim commit but not a failed push (message says to push manually) — push/resume semantics stay out of this bug's scope.

### 2026-09-18 @Arggon
### Review fixes (PR #333 NO-MERGE findings F1–F5)

**F1 (BLOCKER, destructive: npm reify through the start-created link empties the primary install).** Fixed with ordering option (b), justified over (a): start must still link before the claim commit because the pre-commit gate runs BEFORE the post-start hook by design (docs/convention.md: the hook runs after claim commit / push / PR), so skipping the link when a hook is configured would leave the documented `npm ci` + `npm run arggon -- validate` wiring failing at the gate again. Now: link for the gate; immediately before a configured post-start hook runs, `unlinkNodeModulesLink` removes it (only a symlink whose target resolves to the primary's `node_modules`); after the hook, re-link only when the hook left no `node_modules` (hook did not bootstrap, or failed). Tests: `cli/src/worktree.test.ts` "hides the link from a configured post-start hook so npm ci cannot empty the primary" (hook captures `ls -l node_modules`, then simulates npm's clean step with `rm -rf node_modules/*` — which follows the symlink glob and would empty the primary — and installs its own deps; asserts the hook saw no symlink, the primary dep survives, the hook install stands, `postStart.ok: true`, `linkedNodeModules: true`), "re-links after a post-start hook that leaves no node_modules", plus the `unlinkNodeModulesLink` unit matrix in `cli/src/start.test.ts` (real dir / foreign symlink untouched; primary target survives). Regression value verified by temporarily disabling the unlink: the ordering test fails with `expected 'lrwxrwxrwx ... node_modules -> <primary>/node_modules' not to contain '->'`.

Manual F1 probe re-run (real CLI from this branch, npm 12.0.2 / node v26.7.0, script `/tmp/opencode/fix-333/probe-f1-npmci.sh`): fixture with `x-worktree.post-start: "npm ci"`, a primary `node_modules/fake-gate-dep`, and a PATH wrapper records what the hook sees.
- Expected: exit 0; `"linkedNodeModules":true`; `"postStart":{"command":"npm ci","ok":true}`; hook-time capture shows NO symlink to the primary; primary dep intact (`require('fake-gate-dep')` exit 0); worktree re-linked after the hook (the dep-less fixture lockfile makes `npm ci` leave no install); `claim: task-alpha` committed.
- Observed: exactly that — `HOOK SAW: ls: cannot access 'node_modules': No such file or directory`; `AFTER: primary node_modules contents: [fake-gate-dep]`; `AFTER: primary can require fake-gate-dep: exit=0`; `AFTER: worktree node_modules: fake-gate-dep (symlink: yes -> <primary>/node_modules)`; `claim: task-alpha`.
- Reviewer's probe5 before the fix: primary `node_modules` emptied, `require('fake-gate-dep')` exit 1. Docs warning added in `docs/convention.md` while `npm ci` stays the canonical example, plus README/docs/agents.md/json-output/skills wording.

**F2 (cleanup --prune refused start-created worktrees).** Fixed in `cli/src/cleanup.ts` (chosen over filing a bug + docs caveat): before `git worktree remove`, `unlinkNodeModulesLink(root, entry.path)` removes only a symlink whose target is the primary checkout's `node_modules` (never a real dir, never a foreign link; removing it never follows it), then git removes the worktree and any other untracked file still refuses per item. Test `cli/src/worktree.test.ts` "prunes a worktree whose start-created node_modules link is untracked (review F2)": asserts porcelain `?? node_modules`, full prune actions (`removed worktree` / `deleted branch` / `cleared worktree_path`), no failures, worktree gone, primary dep intact.

**F3 (push remediation promised an attach retry that does not push).** Chose the message fix (not attach-resume) because attach is also the claim-commit resume path; making attach push "when the local branch is ahead" would publish arbitrary WIP commits present in the worktree on any attach, and there is no persisted push-failure state to scope it to. The push-step remediation now reads: fix remote access, then push the kept branch manually: `git push -u origin <branch>` — a re-run of `arggon start <id> --worktree` attaches to the worktree but does not retry the push. Test "tells the user to push manually when the push step fails, and attach does not retry it" pins both the message and `pushed:false` on the attach re-run.

**F4 (inaccurate "gitignored"/"never committed" claims).** Re-phrased everywhere to the accurate statement: the link is untracked and NOT ignored (a `node_modules/` pattern matches directories only); start never commits it because the claim commit stages only the item file — stage explicit paths, never `git add -A`. Updated: `docs/agents.md`, `docs/json-output.md`, `README.md`, `skills/arggon-cli/SKILL.md`, `skills/arggon-cli/references/orchestration.md`, `skills/arggon-cli/references/pitfalls.md`, and the `linkNodeModules` code comment in `cli/src/start.ts`.

**F5 (test gaps).** Covered: attach-without-pre-existing-link ("links when attaching to an existing worktree that has no node_modules"), CLI-level `linkedNodeModules: true` envelope ("arggon start --worktree reports linkedNodeModules: true and runs the dependency gate", real CLI + bare remote + dependency-requiring pre-commit gate), and the F1 ordering tests above.

**Correction to the previous handoff line.** The handoff said the push remediation "message says to push manually" — that was inaccurate for the code as reviewed: the message only said "Fix remote access (`git fetch origin`, credentials), then re-run ... attaches". It now actually instructs `git push -u origin <branch>` for the push step (F3).

Gates re-run: full suite 1124 passed / 69 files; `lint` clean; `build` clean; `arggon validate` 0 warnings; `arggon spec validate` 16 docs, 0 warnings.

### handoff 2026-09-18 @Arggon (session: ses_f4b44e5faffe0ekr04eVu0CZg9) — next: Coordinator/reviewer: re-review PR #333 (draft, base opencode2) against the F1–F5 findings and the probe evidence above, confirm CI, then merge. Worker stops here: no merge, no status flip.
- branch: fix/bug-start-worktree-node-modules
- open questions: None blocking.

### 2026-09-18 @Arggon
Coordinator merge verification (two review rounds): round 1 found the F1 data-destruction blocker (link before post-start hook + npm ci empties the primary install) plus F2-F5; round 2 verified all fixed on 9bafcf0 — F1 independently reproduced fixed (hook sees no link, primary dep survives, worktree re-linked/real-installed; regression test discriminates old vs new order), F2 prune restored with a foreign-link guard, F3 message matches behavior, F4 wording accurate, F5 tests behavioral. Merged with cli pass. R1/R2 filed as task-start-worktree-relpath-nits. Closing.
