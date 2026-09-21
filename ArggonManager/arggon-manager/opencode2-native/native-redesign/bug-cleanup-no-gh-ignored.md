---
type: bug
status: done
id: bug-cleanup-no-gh-ignored
title: cleanup --no-gh ignores the flag (pre-existing)
assignee: Arggon
branch: fix/bug-cleanup-no-gh-ignored
parent: native-redesign
labels: []
priority: p3
created: "2026-09-20"
updated: "2026-09-21"
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-bug-cleanup-no-gh-ignored
---
<!--
  Placement (v0): ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-cleanup-no-gh-ignored.md
  Leaves live only under a story. id is the filename stem: bug-cleanup-no-gh-ignored.
  CLI `arggon create bug cleanup-no-gh-ignored` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --no-gh ignores the flag (pre-existing)

## Context

Found during the W4 review (`task-native-permissions-worktrees`): `arggon
cleanup --no-gh` (pre-existing in the base, verified empirically) still runs
the `gh` fallback; the flag does not change the classification.

## Acceptance

- [x] `cleanup --no-gh` skips the `gh` fallback entirely (offline/CI
      semantics) and the behavior is covered by a test.
- [x] Default `cleanup` keeps the gh fallback.
- [x] `arggon validate` green; CI green.

## Notes

- Pre-existing, not a W4 regression; filed per the review-findings rule.

### 2026-09-21 @Arggon
Evidence (worker, branch fix/bug-cleanup-no-gh-ignored @ b5852e9, draft PR #382):

ROOT CAUSE: commander names a --no-gh option `gh` (default true, false when passed); the cleanup action read `opts.noGh` (always undefined), so `noGh: opts.noGh === false` was always false and the squash-merge gh fallback always ran.

REPRO (fixture from cli/src/worktree.test.ts, task-charlie = done + unmerged branch, gh shim on PATH logging invocations):
- before fix, `cleanup --json --no-gh`: task-charlie {removable:true, reason:null, via:"squash-merged PR #12"}; gh shim invoked 1x.
- after fix, `cleanup --json --no-gh`: task-charlie {removable:false, reason:"branch 'feat/task-charlie' is not fully merged into 'main'"}; gh shim invoked 0x.
- after fix, default `cleanup --json`: gh shim invoked 1x, charlie removable via "squash-merged PR #12" (fallback kept).

GATES (all green): npm test (89 files / 1455 tests), npm run lint, npm run build, npm run check:plugin (bundle unchanged), npm run arggon -- validate (ok, convention v5), npm run arggon -- spec validate (ok, 18 docs).

Acceptance checkboxes left unticked for the coordinator: local verification covers all three except the not-yet-run CI and the merge itself. Only touched cli/src/cli.ts and cli/src/worktree.test.ts.

### handoff 2026-09-21 @Arggon — next: Review draft PR #382 (fix/bug-cleanup-no-gh-ignored @ b5852e9): confirm CI green, then tick the three acceptance boxes and mark done after merge (coordinator).
- branch: fix/bug-cleanup-no-gh-ignored
- open questions: CI result not observed by the worker; plugin-parity test opencode/plugins/arggon/tools.test.ts:1113 compares CLI --no-gh with plugin no_gh but its fixture is ancestry-merged, so the CLI wiring is now…

### 2026-09-21 @Arggon
### 2026-09-21 review verdict (PR #382 @ 6c8f1b3) — REVIEW

VERDICT: MERGE (merge commit, NOT squash — the branch carries the tracker auto-commits).

BLOCKING FINDINGS: none.

VERIFIED (reviewer, worktree ArggonManager-opencode2-bug-cleanup-no-gh-ignored):

1) Repro before/after, real spawned CLI with a gh shim first on PATH (fixture mirrored from initCleanupRepo: task-charlie = done + unmerged branch):
- base a0f3624 `cleanup --json --no-gh`: task-charlie {removable:true, reason:null, via:"squash-merged PR #12"}; shim invoked 1x (gh pr list --state merged --head feat/task-charlie ...).
- head 6c8f1b3 `cleanup --json --no-gh`: task-charlie {removable:false, reason:"branch 'feat/task-charlie' is not fully merged into 'main'"}; shim invoked 0x.
- head default `cleanup --json`: shim invoked 1x; charlie removable via "squash-merged PR #12" (fallback kept).
- head `cleanup --json --prune --no-gh`: pruned only ancestry-merged task-alpha; charlie's worktree+branch untouched; shim 0x (offline/CI semantics).
2) Regression test is real: copied cli/src/worktree.test.ts into a scratch worktree at base a0f3624 — `vitest run -t "through the CLI"` FAILS (removable:true/reason:null); same test on head PASSES.
3) No other --no-* misreads: grep opts.no -> only `--now` (not a negation). All `--no-commit` (x8) read `opts.commit === false`; `--no-cascade` -> `opts.cascade !== false`; `--no-fail-on-new` -> `opts.failOnNew !== false`; `--no-hook` -> `hook: opts.hook === false`. Native/plugin cleanup already reads `input.no_gh === true` (opencode/plugins/arggon/index.ts:2477) — no parallel bug.
4) Gates on head 6c8f1b3: npm test 89 files / 1455 pass; lint clean; build ok; check:plugin ok (bundle byte-identical, 324264 bytes, git status clean after build); arggon validate ok (convention v5); arggon spec validate ok (18 docs).
5) CI: check-runs API on 6c8f1b3 -> `cli` success, `tasks-validate` success.
6) Scope: 3 files only — cli/src/cli.ts (+5/-2), cli/src/worktree.test.ts (+67), item md (claim + comments). No lib/, plugin, README, docs or parallel-worker files (hygiene/trend) touched. README's cleanup section already documents `--no-gh` semantics exactly as now implemented; CHANGELOG practice is release-wave batching (no per-bugfix entries) -> no docs debt.
7) Test quality: spawns the real CLI via tsx, real PATH resolution of the shim, shim logs invocations; call count stays 1 across default + --no-gh runs, proving the second run never reached gh; asserts both the via annotation and the ancestry reason; temp dirs use the tracked teardown helper.

NOT VERIFIED / NOTES:
- Verdict posted with the repo's own CLI (`npm run arggon -- comment`, same tracker write path) because this session's arggon MCP tools are broken: the server resolves the stale global binary /home/arggon/Projects/ArggonManager/dist/cli.js, which cannot find the v5 convention root ("No tasks/ convention found" even for a plain show).
- Real GitHub PRs (not the shim) and Windows were not exercised; kernel gh behavior is unit-covered and the shim log records every invocation.
- The handoff open question is accurate: opencode/plugins/arggon/tools.test.ts:1113 parity fixture is ancestry-merged, so it never exercised the CLI flag; the new spawned-CLI test closes that wiring gap, no follow-up item needed.
- Acceptance boxes left unticked for the coordinator (not marked done here).

RECOMMENDATION: merge as a merge commit. No change requests.

### 2026-09-21 @Arggon
Coordinator note: reviewer verified the repro before/after with a gh shim (0 invocations with --no-gh; fallback kept by default; --prune+--no-gh prunes only ancestry-merged), the regression test fails at base and passes at head, and no other --no-* misreads. Gates 1455 tests, lint/build/check:plugin/validate/spec; CI pass. Merged with merge commit; item flipped to done.
