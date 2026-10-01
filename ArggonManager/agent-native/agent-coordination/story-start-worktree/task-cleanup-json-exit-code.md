---
type: task
status: in_progress
id: task-cleanup-json-exit-code
title: "cleanup --prune --json exits 0 even with non-empty failures[] (exit-code contract decision)"
assignee: Arggon
branch: feat/task-cleanup-json-exit-code
parent: story-start-worktree
labels: [opencode-seam, cli]
priority: p3
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T12:46:44.289Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-cleanup-json-exit-code
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/story-start-worktree/task-cleanup-json-exit-code.md
  Leaves live only under a story. id is the filename stem: task-cleanup-json-exit-code.
  CLI `arggon create task cleanup-json-exit-code` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# cleanup --prune --json exits 0 even with non-empty failures[] (exit-code contract decision)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-01 @Coordinator

### 2026-10-01 @Coordinator

Filed from the bug-cli-cleanup-branch-delete-missing-failure review (PR #515). Pre-existing, confirmed identical before/after: the --json path of cleanup --prune returns before the human path sets process.exitCode = 1 (cli.ts ~2401 vs ~2438), so a prune run with failures[] exits 0.

## Acceptance

- [x] Decide the machine contract explicitly: does a non-empty failures[] mean non-zero exit for --json consumers? (Contract change -> document in json-output.md in the same PR; keeping 0 is also acceptable if documented.)
- [x] Implement + test the chosen behavior; human-path behavior unchanged.
- [x] Note for callers: agents/scripts keying on exit status today.

### 2026-10-01 @Arggon
Contract decision: KEEP exit 0 for --json with non-empty failures[]; documented, not changed.

Rationale: json-output.md nowhere promises non-zero for per-item failures (checked before deciding); the general rule ties exit to ok (ok:false => non-zero), and the only documented exit!=ok exceptions are explicit gate modes (sync --check, spec analyze --baseline) — cleanup --prune is a mutating maintenance op with designed partial-success semantics ('per-item failures never abort the run'). A shipped spawned-CLI test from #515 (worktree.test.ts, 'reports a real branch-delete failure in BOTH pruned and failures') already pins status===0, so agents/tooling rely on it. The machine surface is the payload: failures[] + pruned[].action==='failed'; the human path keeps exit 1 (text has no structured failure channel). Native/MCP cleanup is in-process — no exit code — so the contract is CLI-only.

Evidence: doc sentence added to json-output.md §cleanup only (Exit-code contract task-cleanup-json-exit-code; prettier-stable, prose-format.test.ts 3/3 green); cli.ts comment extended at the --json early-return (no code change — behavior already matches); worktree.test.ts: --json test comment updated to cite the now-real doc contract + NEW spawned human-path test 'exits 1 on the human path when a prune failure occurred' (forced git branch -d refusal, asserts status 1 + failed:/leftover-branch lines on stderr).

Gates (worktree ArggonManager-task-cleanup-json-exit-code): npm test 112 files / 1981 passed; npm run lint clean; npm run build ok; npm run check:plugin ok (no bundle drift — cli.ts comment-only, not bundled); npm run arggon -- validate ok:true. Note: worktree needed a manual link-farm install (node_modules symlinks to primary + @arggondev/lib -> ../../lib + lib pre-build) because start --worktree skipped it (its commit step failed: tsx not found — no node_modules yet); install gap reported to coordinator separately, no tracker item filed from here.

### handoff 2026-10-01 @ses_f087fbfebffe3hzxLVHwJLtqKc (session: ses_f087fbfebffe3hzxLVHwJLtqKc) — next: Review + merge PR #527 (draft): contract decision documented (keep exit 0 for --json with failures[]), tests pin both paths; coordinator flips item to done after merge.
- branch: feat/task-cleanup-json-exit-code
- open questions: start --worktree skipped the link-farm install in this worktree (commit step died: tsx not found before node_modules existed) — coordinator may want a follow-up on install ordering; my worktree was f…
