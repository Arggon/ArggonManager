---
type: task
status: done
id: task-runcli-import-tsx-migration
title: "Migrate the remaining spawn-chain helpers (success-stdout, doctor, validate, headless-ci) from the tsx wrapper CLI to node --import tsx"
assignee: Arggon
branch: feat/task-runcli-import-tsx-migration
parent: ci-stability
labels: [testing, flaky]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/ci-stability/task-runcli-import-tsx-migration.md
  Leaves live only under a story. id is the filename stem: task-runcli-import-tsx-migration.
  CLI `arggon create task runcli-import-tsx-migration` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Migrate the remaining spawn-chain helpers (success-stdout, doctor, validate, headless-ci) from the tsx wrapper CLI to node --import tsx

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator

### 2026-10-01 @Coordinator

Filed from the bug-row-table-flake root cause (PR #513): the tsx wrapper CLI (tsx/dist/cli.mjs) re-execs node as a second child and hosts a per-spawn IPC server (/tmp/tsx-<uid>/<pid>.pipe) whose unhandled transient failures exit the chain 1 under load. PR #513 migrated ONLY cli/src/row-table-stdout.test.ts's local runCli helper (that helper is file-local; the other suites own their own copies).

## Acceptance

- [x] Inventory every test helper that spawns the tsx wrapper CLI (success-stdout, doctor, validate, headless-ci packed-bin, e2e helpers) — list file + spawn shape.
- [x] Migrate each to `node --import <abs>/tsx/dist/loader.mjs` (or the packed dist bin where the lane already uses one), preserving asserted stdout/stderr bytes.
- [x] Full suite green; each migrated suite run 10x locally without transient exit-1.
- [x] Confirm no remaining reference to tsx/dist/cli.mjs in test spawn chains (grep gate or follow-up note).

### 2026-10-01 @Coordinator

### 2026-10-01 @Coordinator

Inventory precision from the PR #513 mechanical review: runCli copies spawning the tsx wrapper CLI exist in doctor.test.ts:48, success-stdout.test.ts:30, and ~33 further files (~35 total) — the acceptance inventory should confirm that count and sweep all of them; consider extracting ONE shared spawn helper instead of 35 per-file copies.

### 2026-10-01 @Coordinator

### 2026-10-01 @Coordinator

Inventory precision from the PR #513 mechanical review: runCli copies spawning the tsx wrapper CLI exist in doctor.test.ts:48, success-stdout.test.ts:30, and ~33 further files (~35 total) — the acceptance inventory should confirm that count and sweep all of them; consider extracting ONE shared spawn helper instead of 35 per-file copies.

### 2026-10-01 @Arggon
Migration complete on branch feat/task-runcli-import-tsx-migration (2 code commits, PR opened; not merged).

## Final inventory (confirmed count: 47 test files, reviewer seed said ~35 — seed undercounted)

Spawn shape everywhere: module const `resolve(root, "node_modules/tsx/dist/cli.mjs")` + spawnSync/spawn `[tsx, cli, ...args]`; a few inline or named differently (tsxLoader/tsxEntry/tsxCli; board.test.ts used joined segments).

- cli/src (45): adopt, board, board-serve, build-info, cascade, claim-race, cli, comment, comment-race, config-race, create, doctor, handoff, headless-ci, init, init-docs, init-opencode, instructions, issue-roundtrip, layout, lib-build, measure, mcp-parity, mcp-server, mcp-smoke, playbooks, reopen-gate, report, row-table-stdout, show, spec, spec-analyze, spec-audit, spec-baseline, spec-decision-gaps, spec-import, steal-gate, success-stdout, sync-smoke, test-tmp, tracker-commit, trend, tui, validate, worktree
- labs (1): torture
- opencode (1): plugins/arggon/tools
- Special roots kept: lib-build (fresh-clone copy root — loader path from the copy via nodeImportArgs(entry, copy)); MCP cliSpawn injection (mcp-parity CLI_SPAWN, mcp-server 2 sites) now uses the nodeImportArgs argv triple
- Spawned TS helper scripts (not cli.ts) also migrated: test-tmp stress runner, tracker-commit committer, config-race driver (nodeImportArgs)
- cleanup.test.ts: verified — NO wrapper copy exists (scope guard was a no-op)
- Deliberate exceptions (documented, NOT migrated): e2e/board.smoke.spec.ts:1384 (spawns at 1391/1406 — concurrent worker owns that file), smoke/{context-report,opencode-smoke,opencode-wave,tui-smoke}.ts, and product-side cli/src/measure.ts:132 cliCommand() (spawns wrapper when running from source; product code out of scope) + cli/src/mcp-server.ts:864 deriveDefaultCliSpawn (argv recognition only). package.json script lane (npm run arggon/dev/smoke:*) runs the tsx bin as main process — also a candidate follow-up.

## Helper design (preferred over 47 copies)

cli/src/test-spawn.ts: runCli(args, cwd?, opts) sync utf8 spawnSync; spawnNodeCli(args, opts) async (ChildProcessWithoutNullStreams); nodeImportArgs(entry, root?) argv triple for helper scripts/injection; cliEntryPath/tsxLoaderPath with optional root. Files with extra behavior keep tiny delegating wrappers (cli.test env map, issue-roundtrip optional env, reopen/steal stdin input, sync-smoke env, headless-ci timeout, mcp-parity/tools --json prefix, labs/torture JSON parse); plain files import runCli directly; ALL call sites unchanged. Gate: cli/src/test-spawn.test.ts pins helper wiring + scans *.test.* under cli/src, labs, test, opencode for any wrapper reference outside comments (strings kept — the wrapper only appears inside strings). Packaging: dist/test-spawn.* excluded from the npm pack mirroring dist/test-tmp.*; pack-contents gate extended.

## Gates + loops (final state)

- npm test: 1961/1961 passed (111 files); lint 0 errors; tsc typecheck clean; npm run build ok; check:plugin ok (bundle unchanged, no regen commit); arggon validate ok:true
- 10x loop: doctor, success-stdout, measure — 30/30 suite runs OK, zero transient exit-1
- Byte preservation: no assertion changes. One test-plumbing exception, disclosed: mcp-smoke's "server process gone" wait now accepts signal termination (exitCode !== null || signalCode !== null — idiom test-tmp/tracker-commit already use) because direct node killed by SIGTERM keeps exitCode null where the old wrapper self-exited with a code. Full suite caught this (1 failure → fixed → green).

Commits: 6e5729ee (helper + gate + pack exclusion), 20e625ef (47-suite migration, net -383 lines).

### handoff 2026-10-01 @Arggon (session: ses_f0aa6a0b4ffd9zUh3OD2bgVLIR) — next: Review PR; merge squashes tracker+code commits. Then file e2e/smoke/measure.ts wrapper follow-ups.
- branch: feat/task-runcli-import-tsx-migration
- open questions: mcp-smoke signal-death predicate ok? measure.ts product wrapper spawn follow-up item needed

### 2026-10-01 @Arggon
Merge-resolution update (review blocker B1 on PR #518): the branch forked before #515 merged; #515 added a new wrapper spawn in cli/src/worktree.test.ts (~1252 on main: cleanup --prune --json with local tsx/cli consts). The textual merge dropped my deleted declarations under it → TS2304 at worktree.test.ts:1242 on the merge commit (CI run 36853491884).

Resolution: merged origin/main; migrated the #515-added site to the shared runCli helper (const r = runCli(["cleanup", "--prune", "--json"], dir)) instead of resurrecting local declarations. #515's assertions, comments, and diagnostic message kept byte-identical to main. Verified cli/src/harness-state.test.ts (new on main) and cli/src/cleanup.ts carry no wrapper spawns — the site was the only new one.

Inventory correction: 47 test files (file count unchanged), now 48 spawn SITES. Notable: the grep gate could not have caught this — gate scans *.test.* for the cli.mjs literal, and the #515 site's wrapper reference lived in the (merge-deleted) const declarations, not in the spawn line itself; tsc (TS2304) was the backstop that caught it. Both backstops now green.

Post-merge gates: npm test 1968/1968 (112 files — main's additions incl. harness-state.test.ts), lint 0, build ok, check:plugin ok, arggon validate ok:true; trio doctor/success-stdout/measure one clean pass each. Note: main already tracks the product-side follow-ups I flagged (task-derive-cli-spawn-loader, task-e2e-board-serve-wrapper).

### 2026-10-01 @Arggon
B1 resolved, CI green (run 36856706281: cli pass 4m18s, ui-smoke pass, tasks-validate pass).

Merge: origin/main merged into feat/task-runcli-import-tsx-migration; the #515-added worktree.test.ts cleanup --prune --json spawn migrated to the shared runCli helper (assertions + diagnostic messages byte-identical to main). harness-state.test.ts / cleanup.ts verified wrapper-free — it was the only new site. Inventory: 47 test files / 48 spawn sites.

One additional CI gate surfaced on the push: the version guard classifies the package.json `files` exclusion as publish-relevant while v0.4.0 is already tagged ("release forgotten"). Resolved per the guard's design: version bumped 0.4.0 -> 0.4.1 (patch) + minimal CHANGELOG entry; guard now passes ("version 0.4.1 is not yet tagged - ok"). Flagging for the release runbook: the next publish is 0.4.1, and any parallel branch touching shipping fields should rebase over a359a3a1.

Post-merge + post-bump gates: npm test 1968/1968 (112 files), lint 0, build ok, check:plugin ok, arggon validate ok:true; trio (doctor/success-stdout/measure) clean pass post-merge. PR body updated with the corrected counts and both resolutions. Item stays in_progress — review/merge is the coordinator's call.

### 2026-10-01 @Coordinator
### 2026-10-01 @Coordinator
verdict: approve (lead-architect review of the rebase delta; full mechanical pass on file). B1 resolved exactly as requested: the #515 cleanup-prune site migrated to the shared helper (runCli), assertions byte-identical; counts corrected to 47 files / 48 sites; the backstop lesson (tsc catches what the comment-stripping grep gate structurally cannot) recorded on the item. The guard-forced version bump 0.4.0 -> 0.4.1 + CHANGELOG entry accepted — RELEASE RUNBOOK NOTE: next publish is 0.4.1; shipping-field branches rebase over a359a3a1. Reviewer follow-up precision folded into task-e2e-board-serve-wrapper (+4 smoke scripts), task-derive-cli-spawn-loader (+measure.ts cliCommand, +package.json tsx-bin lanes). Merged: PR #518 squash -> 8cda4d96 (CI green on the reconciled head). Item flipped done.
