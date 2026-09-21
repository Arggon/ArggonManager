---
type: task
status: done
id: task-native-permissions-worktrees
title: "Permissions, worktree domain and item lifecycle"
assignee: Arggon
branch: feat/task-native-permissions-worktrees
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-21"
depends_on: [task-native-commands-seam]
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-permissions-worktrees.md
  Leaves live only under a story. id is the filename stem: task-native-permissions-worktrees.
  CLI `arggon create task native-permissions-worktrees` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Permissions, worktree domain and item lifecycle (W4)

## Context

W4 of `plan-native-first-011`. Ship permission defaults (reviewer `edit` deny, coordinator subagent allow-list, minimal shell gates) and implement start/cleanup over the worktree domain (`ctx.worktree.create/list/remove`), keeping the `gh` PR step and the kernel invariants (never steal a claim, never reopen done/cancelled).

## Acceptance

- [x] Headless claim → worktree → commit → (stubbed) PR → done scenario passes.
- [x] Never-steal and no-reopen invariants are covered by tests and hold with permissions active.
- [x] `cleanup` removes merged worktrees and clears `worktree_path`.
- [x] Permission defaults load without breaking ordinary sessions.

## Notes

- Depends on W2; kernel invariants remain authoritative (permissions are defense in depth).

### 2026-09-20 @Arggon
W4 permissions + worktree domain + lifecycle — implemented on `feat/task-native-permissions-worktrees` (head 1f2c5ee; draft PR pending).

Worktree domain (ADR 0011 §1, plan-native-first-011 W4)

- `tools.arggon.start` claims (kernel rules, `agent: true`: never steal) and creates `../<repo>-<id>` through `ctx.worktree.create` (name `<repo>-<id>`, `directory` = the canonical checkout's parent), creates/switches the convention branch inside the worktree (`git switch -c`: the domain's Git strategy checks out a DETACHED worktree at the start ref) and records `branch` + `worktree_path` in the WORKTREE copy, so the claim commit lands on the feature branch and the canonical checkout stays untouched — `arggon start --worktree` parity. Re-runs attach to the recorded/deterministic path; a lost race (claim conflict) removes the worktree+branch it just created; a stale canonical copy (uncommitted tracker changes) refuses with an actionable error; `push` is opt-in and the `gh` PR step stays an explicit agent step.
- `tools.arggon.branch` records the convention branch name (kernel bookkeeping).
- `tools.arggon.cleanup` classifies with the SHARED kernel rule and prunes through `ctx.worktree.remove`: removes the worktree, deletes the merged branch, clears `worktree_path` and commits all cleared records in ONE tracker commit (surgical staging); `no_gh` for ancestry-only.
- Kernel: the cleanup classification/git plumbing moved to `lib/src/cleanup.ts` (`classifyCleanupEntry`, `defaultCleanupGit`, `findMergedPr`, `CLEANUP_TERMINAL_STATUSES`) and `cli/src/cleanup.ts` re-exports it — CLI and native tool share the merge criterion by construction (test: tool `cleanup` output byte-identical to `arggon cleanup --json --no-gh` on the same fixture). Deliberate extraction: the CLI behavior is unchanged (its 78 worktree/tracker-commit tests stay green).
- Probes (2.0.10, recorded in the playbook): every domain op requires `projectID` and loads config from the canonical checkout; `create({ directory })` treats it as the parent and returns the actual directory (collisions get `-2`); `list` reads saved inventory only (`refresh` first discovers git-created worktrees); `remove` works for git-created worktrees; `ctx.permission.rules` is ABSENT on 2.0.10.
- Decision: native path = the domain; the CLI (`arggon start --worktree` / `arggon cleanup --prune`) is the documented fallback when the domain/project id is unavailable. Native `start` is a deliberate subset (no `node_modules` link, no `x-worktree.post-start` hook) — documented in the playbook.

Permissions (defense in depth, never the rule source)

- Seam (`templates/docs/opencode.jsonc`): minimal shell gates — deny `git commit --no-verify*`, `git push --force*`, `git push -f*`; no global `ask` (headless-safe), base policy stays allow-all.
- Agents: reviewer keeps `edit`/`subagent` deny and gains read-only shell gates (`git commit|push|merge|rebase`) plus native tool denies (`arggon_create|update|handoff`) next to the MCP spellings; worker denies `arggon_create` (native + MCP); coordinator allow-list documented.
- Probe-verified: a native tool action is `<namespace>_<tool>` (`arggon_update` deny removes `tools.arggon.update` from the Code Mode catalog → "Unknown tool"); `shell` denies are per command; the reviewer's `git push` is denied while `git status` still runs.
- `/arggon-start` drives `tools.arggon.start`; `/arggon-done` reaps with `tools.arggon.cleanup({ prune: true })`.

Evidence

- `npm test` → 86 files / 1411 tests green. New: 12 worktree-domain tests (domain-backed fake; never-steal rollback; stale-canonical guard; deterministic attach; cleanup prune/list/skips; byte parity with the CLI; typed failures outside git and without the domain), 2 wiring tests, permission-default pins (seam JSONC + agent frontmatter incl. native spellings), 15-tool registration/pinned/budget.
- `npm run lint` clean; `npm run build` ok; `npm run check:plugin` exit 0.
- `arggon validate` ok (0 warnings); `arggon spec validate` ok (18 docs).
- `npm run context:report --strict` → all bounds pass: native 15 tools / 9 pinned 12,182 B ≤ 12,288 B advisory; generated AGENTS.md 2,005 ≤ 2,048; item block 252 ≤ 1,024.
- `npm run smoke:opencode` (opencode v2.0.10, headless) → 26 scenarios / 0 failures (143 checks), including: lifecycle (19 checks: domain create at `../<repo>-<id>`, detached→branch, claim commit in the worktree, canonical untouched, stubbed merge, done, cleanup removes + branch delete + record clear + one commit), invariants (12 checks as the shipped `arggon-worker` agent: kernel refuses steal via update AND start, and the reopen; states unchanged), permissions (8 checks as `arggon-reviewer`: show allowed, update hidden, `git push` denied, `git status` runs), 15-tool registration/catalog, `/arggon-start` driving the native start tool.
- Flakes disclosed (both re-run green in isolation; neither is a product failure): one full run had `/adr` fail 2 checks (model wandered instead of writing the artifact) and one had `/status` fail 1 check (harness detection gap for the bracket spelling `tools["arggon"].x`, fixed in 1f2c5ee). Logs: /tmp/opencode/smoke-full.log, smoke-final.log, smoke-final2.log.
- Bundle regenerated with `npm run build:plugin` (37 modules, 310,607 B) and drift-gated (`check:plugin` exit 0).

Decisions / follow-ups

- ADR 0006: the three new tools ship lean schemas (bare output schema, terse descriptions) so the definitions payload stays within the advisory (12,182 B, 106 B headroom); `start` joins the pinned set (9).
- Finding (reported, not fixed — W3 scope): the plugin's session↔item correlation regex does not recognize the bracket namespace spelling `tools["arggon"].update(...)` (observed in a real session); `CORRELATION_CALL_PATTERNS` matches `tools.arggon.<name>(...)` only, so correlation falls back to branch/env/storage.
- Not in scope: `smoke:opencode:wave` (flagged W4/W7 in W3) and the repo's tracked `.opencode` dogfood seam (W7).

### handoff 2026-09-20 @Arggon — next: Coordinator review of the draft PR: verify the W4 smoke evidence and gates, then merge with a MERGE commit (tracker auto-commits live on this branch, never squash). No worker action pending.
- branch: feat/task-native-permissions-worktrees
- open questions: Native definitions payload at 12,182 B (106 B headroom under the ADR 0006 advisory): richer schemas for the worktree tools need a deliberate budget decision; native start is a subset of the CLI (no n…

### 2026-09-21 @DeepSeek V4.1 Flash
## Final review — PR #377 @ 4f9b88a (base opencode2) — DeepSeek V4.1 Flash

Supersedes my review of c6c11ef. Fix commits reviewed: 377d30f (S1/S2 ownership + attach guard + cleanup node_modules unlink) and 4f9b88a (reviewer worktree-lifecycle denies + payload/ownership docs). CI cli success verified on 4f9b88a (run 35599562016).

### Re-verified repros (independent probes, not only the added tests)
- S1 stale-canonical: pre-existing unmerged feat/task-t + uncommitted canonical claim → START_FAILED (uncommitted tracker changes); the branch SURVIVED at the same tip and the worktree this run created was removed.
- S1 claim-conflict: committed claim by someone + pre-existing branch → START_FAILED (claim conflict); branch survived, tip unchanged, created=1 removed=1.
- S2 recorded foreign path: worktree_path pointing at an unrelated git repo → START_FAILED (not a git worktree of this repo); the foreign repo kept only master, no branch created, domain.create calls = 0. Default-path variant covered by the new unit test.
- Ordinary-session seam probe (fresh init, no agent): git push --force origin main → Permission denied: shell; git status --short runs.

The code matches its docstring: discardWorktree gets no branch on the stale/branch-setup paths and branchCreated ? branch : undefined on claim refusal; isRegisteredWorktree now guards both attach paths; nativeCleanup unlinks the start-created node_modules link via the shared kernel helper (lib/src/worktree.ts), ownership rule unchanged.

### Gates reproduced on 4f9b88a (clean tree)
- npm test → 86 files / 1416 tests green (+5 W4-review regression tests).
- npm run lint clean; npm run build ok; npm run check:plugin exit 0 (38 modules, 312,930 B, no drift; tree clean after).
- argpon validate ok (0 warnings, v5); argpon spec validate ok (18 docs).
- npm run context:report -- --strict → all bounds pass (native 15 tools / 9 pinned / 12,182 B ≤ 12,288 B; AGENTS 2,005 B; item block 252 B).
- npm run smoke:opencode (real opencode 2.0.10) → 26 scenarios / 0 failures (144 checks), exit 0: lifecycle 19/19 (domain create at ../<repo>-<id>, detached→branch, claim commit on the feature branch, canonical untouched, stubbed PR merge, done, cleanup domain-remove + branch delete + record clear in ONE commit), invariants 12/12 as arggon-worker (steal refused via update AND start, reopen refused, states unchanged), reviewer gates (show allowed, update denied, start/cleanup denied, git push denied, git status runs).

### Acceptance
- [x] lifecycle scenario — clean smoke, 19/19.
- [x] never-steal / no-reopen covered and holding with permissions active — unit + smoke; kernel stays the authority (lib/src/rules.ts).
- [x] cleanup removes merged worktrees and clears worktree_path — unit + smoke (single tracker commit).
- [x] permission defaults load and gate without breaking ordinary sessions — seam probe + smoke (seam file unchanged by the fix; re-probed green).

### Residual non-blocking notes
- Reviewer denies now cover every mutating native tool (create/update/handoff/start/branch/cleanup/priority/sync/import_issues) plus the MCP create/update/handoff spellings; the MCP server exposes only those three mutating tools (9 total), so no gap remains.
- Pre-existing cleanup --no-gh bug is tracked as bug-cleanup-no-gh-ignored (opencode2); the bracket-namespace correlation finding stays reported for W3/W7 as disclosed. No W5+ scope in the fix diff.
- Flake note: two earlier clean W4 runs had the single check session succeeds as the reviewer agent fail on provider.invalid-output (OpenAI Chat stream ended without finish_reason); all substantive checks passed in every run, and the full run above was green. Harness/provider matter, not a product failure.

### Verdict: MERGE
No blocking findings remain at 4f9b88a. Merge with a MERGE commit — never squash. Item stays in_progress until the coordinator merges; I am not marking it done.

### 2026-09-21 @Arggon
Coordinator note: S1/S2 verified with independent repros (rollback ownership; attach guard on a foreign repo), reviewer denies the mutating tools, cleanup unlinks node_modules, payload docs contrasted against envelopes. Gates 1416 tests, lint/build/check:plugin, validate, spec, smoke 26/0, budget within ADR 0006; CI pass on 4f9b88a and dd3238b. Merged with merge commit; item flipped to done.
