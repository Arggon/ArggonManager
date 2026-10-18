---
type: bug
status: done
id: bug-auto-merge-armed-not-merged
title: "Arming auto-merge is not ensuring merge: delivery-lead merge ownership ends at --auto instead of at MERGED"
assignee: arggon-delivery-lead
branch: fix/bug-auto-merge-armed-not-merged
parent: story-tracker-hygiene
labels: []
created: "2026-10-12"
updated: "2026-10-18"
worktree_path: /home/arggon/Projects/ArggonManager-bug-auto-merge-armed-not-merged
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/story-tracker-hygiene/bug-auto-merge-armed-not-merged.md
  Leaves live only under a story. id is the filename stem: bug-auto-merge-armed-not-merged.
  CLI `arggon create bug auto-merge-armed-not-merged` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Arming auto-merge is not ensuring merge: delivery-lead merge ownership ends at --auto instead of at MERGED

## Context

Filed by the delivery lead against its own loop, at the product owner's prompt ("second time, same mistake") after PR #731 sat CONFLICTING with auto-merge armed until the owner complained. The first instance was PRs #726/#727 sitting BEHIND for hours with `--auto` set.

The defect: the lead's merge step currently ends at `gh pr merge --auto --merge` — arming the merge — instead of at the PR reading MERGED. Auto-merge does not fire on DIRTY (verdict-comment/item-file conflicts, the routine shape: maker report vs lead verdict appended to the same item file), on BEHIND (base moved), or while checks re-run; each of those needs a hand (merge main in, resolve keeping both, push, re-verify). Arming and walking away converts every one of those into silent dwell, and the owner becomes the merge monitor — the exact inversion of the role table (`engineering.md` §Roles and authority: the delivery lead owns "merge verification and the `done` flip").

Contributing shape: verdict comments auto-commit to main, so EVERY reviewed branch conflicts on its own item file by construction. The loop manufactures the very state auto-merge cannot clear, then relies on auto-merge to clear it.

## Acceptance

- [x] The delivery-lead loop gains a merge-ownership close-out: after arming auto-merge, verify MERGED (poll or re-check); on DIRTY/BEHIND, merge main in, resolve (keep report + verdict), validate, push, re-verify — never leave a reviewed PR unmerged without a named blocker on its item
- [x] The rule is written where the lead reads it (`skills/arggon-cli/references/orchestration.md` and/or `ArggonManager/docs/agents.md` §Orchestration → Merge verification) with the impact class the methodology-change rule requires
- [x] A `done` flip is refused-or-flagged while its PR is still OPEN (today the flip and the merge are two unlinked steps; the item can read done with the change unmerged)
- [x] `arggon validate` green; prettier clean; `npm test` green for the touched surface; PR opened

## Notes

### 2026-10-18 @ses_eafd0e4ffffeBslXHAfWdTPHVB

Merge-ownership close-out implemented (PR #861, branch fix/bug-auto-merge-armed-not-merged, commit 570f4bcb).

Evidence (commands run, expected vs observed):

- `arggon validate`: ok (0 warnings, convention v5) — expected green, observed green.
- `npx prettier -- check` on touched files: clean.
- `npx tsc -p tsconfig.typecheck.json --noEmit`: clean.
- `npx vitest run cli/src/update.test.ts cli/src/done-gate.test.ts cli/src/sync-command.test.ts`: 82 passed.
- New tests in cli/src/update.test.ts (5): done flip refused when an open PR targets the branch; allowed when no open PR; graceful degradation without execGh; no-branch makes no gh call; gh-failure allows the flip.

Kernel change: lib/src/update.ts refuses flipping a task/bug to `done` while an open GitHub PR targets the item's branch, degrading gracefully when PR state can't be determined. Wired execGh into CLI (updateOperation + runUpdate) and MCP (arggon_update) entry points.

Docs: rule written where the lead reads it — skills/arggon-cli/references/orchestration.md and ArggonManager/docs/agents.md §Orchestration → Merge verification; one-line lesson in pitfalls.md. Skill copies + Claude template regenerated via skills:sync; .convention.yml provenance checksum refreshed.

Methodology impact: Behavioral (ADR 0016 adopter-upgrade channel) — adds a done-gate rule and PR guard.

Ready for the delivery lead's review + merge verification; the done flip stays the lead's call after the PR merges.

### handoff 2026-10-18 @ses_eafd0e4ffffeBslXHAfWdTPHVB (session: ses_eafd0e4ffffeBslXHAfWdTPHVB) — next: Review and merge PR #861 (branch fix/bug-auto-merge-armed-not-merged); the done flip stays the lead's call after merge verification.

- branch: fix/bug-auto-merge-armed-not-merged
- open questions: None; acceptance checklist fully addressed except lead's review/merge/done flip.

### 2026-10-18 @arggon-standards-reviewer

verdict: approve

## Evidence verified by reading (code review)

Change set (commit 570f4bcb, branch fix/bug-auto-merge-armed-not-merged): 10 files, +259/-11. Touches kernel + CLI + MCP + docs + tests, all on-item.

### 1. Kernel guard — lib/src/update.ts (lines 48-84, 624-637)

- prOpenForBranch(branch, cwd, execGh) — new exported guard. Calls getOpenPRs(null, cwd, execGh), which resolves the GitHub repo via detectRepo(cwd, ...) then lists open PRs via gh pr list --json number,title,headRefName,url. Returns { open: true, reason } only when an open PR's headRefName === item.branch; returns null when no match OR when any error occurs (gh missing/unauthenticated/repo undetectable) — graceful degradation, flip proceeds, acceptance gate still applies.
- Guard wired into runUpdate at flippingToDone && gatedLeaf && item.branch && opts.execGh !== undefined — runs only for task/bug leaves flipping in_progress→done with a branch set and execGh injected. Throws actionable error: cannot mark '<id>' done: an open PR (#n, title) still targets branch '...' — verify MERGED before flipping done ... Merge the PR (or close it), then flip done; never leave a reviewed PR unmerged without a named blocker on its item. Placed before any filesystem mutation.
- execGh?: typeof execFileSync added to UpdateOptions (line 186), typed via typeof import("node:child_process").execFileSync.

### 2. Wiring — execGh into all three entry points

- cli/src/cli.ts: execGh: execFileSync at both runUpdate call sites (lines 1224, 1253) — the --issue path and the general path.
- cli/src/mcp-server.ts: execGh: execFileSync on the arggon_update tool (line 813). MCP callers are agents, but the guard is a read-only check that degrades gracefully — no authority change.

### 3. Tests — cli/src/update.test.ts, 5 new cases (done flip merge-ownership guard)

1. Open PR targets branch → refused, status stays in_progress, error matches /targets branch 'fix\/bug-x'/ ✓
2. No open PR → allowed, status done ✓
3. No execGh injected → allowed (graceful degradation) ✓
4. No branch → execGh never called, allowed ✓ (asserts expect(execGh).not.toHaveBeenCalled())
5. gh throws → allowed (graceful degradation) ✓
   Cases map 1:1 to the item's acceptance criteria. Assertions discriminate (without the guard, case 1 would flip to done instead of throwing).

### 4. Docs / methodology impact

- skills/arggon-cli/references/orchestration.md — Merge verification section rewritten: arming auto-merge is NOT ensuring merge; poll till MERGED; DIRTY/BEHIND → merge main in, resolve keeping both report + verdict, validate, push, re-verify. Kernel flip side documented (merge-ownership close-out, bug-auto-merge-armed-not-merged).
- ArggonManager/docs/agents.md §Orchestration → Merge verification — same rule, byte-equivalent.
- skills/arggon-cli/references/pitfalls.md — one-line lesson added referencing the bug id.
- .convention.yml — checksums refreshed for both orchestration.md and pitfalls.md (the provenance targets of skills:sync).
- Methodology impact class stated in commit message: Behavioral, ADR 0016 adopter-upgrade channel ✓ (review bar requires it for PRs touching methodology carriers).

### 5. Non-functional (readable surface)

- Subprocess args are arrays, never shell-interpolated (ghPrListJson: ["pr","list","--limit",...,"--json",fields]; fallback: ["gh","api",...]).
- Guard is read-only — no writes outside repo root, no secrets logged.
- Error messages are actionable (name the PR, the branch, the remedy, the item id).
- get-open-prs.ts is pre-existing (added in a4be3a23); the ./get-open-prs.js import matches the existing pattern in cli/src/sync-command.ts:5.

## Claims pending execution evidence (not observed by me — route to verifier)

The delivery lead reports: arggon validate ok (0 warnings), prettier clean, tsc --noEmit clean, vitest run cli/src/update.test.ts cli/src/done-gate.test.ts cli/src/sync-command.test.ts — 82 passed. I verified the test code and docs exist in the diff, but I did not execute gates (reviewer is read-only). The smoke test below is a blocking bar for this behavior change.

## Probes needed

Run these in the item's worktree and return expected-vs-observed:

| #   | Command (cwd)                                                                                                                                                                                                                                                            | Expected                     | Observed | Blocks if failed                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | -------- | ------------------------------------------------ |
| 1   | npx tsc --noEmit -p lib/tsconfig.json (cwd: worktree root)                                                                                                                                                                                                               | exit 0, no errors            | —        | Yes (type safety; .js-of-.ts import resolution)  |
| 2   | npx vitest run cli/src/update.test.ts cli/src/done-gate.test.ts cli/src/sync-command.test.ts (cwd: worktree root)                                                                                                                                                        | 82 passed, 0 failed          | —        | Yes (test surface)                               |
| 3   | npm run arggon -- validate (cwd: worktree root)                                                                                                                                                                                                                          | exit 0, 0 warnings           | —        | Yes (validate false-pass check)                  |
| 4   | npx prettier --check lib/src/update.ts cli/src/update.test.ts cli/src/cli.ts cli/src/mcp-server.ts (cwd: worktree root)                                                                                                                                                  | all files formatted          | —        | Yes (prettier clean)                             |
| 5   | Smoke: on a fixture git repo with GitHub origin, claim a task, set branch fix/bug-x, satisfy acceptance, then arggon update --status done <id> with an open PR (mock gh) targeting fix/bug-x → expect refusal with branch in message; then without open PR → expect done | refusal / allow as specified | —        | Yes (blocking smoke bar for CLI behavior change) |

Probe 5 is the review-time smoke required by docs/engineering.md §Review bar → Smoke test: probe changed commands on a fixture repo and record expected-vs-observed evidence.

## Scope

No cross-item files, no unrelated reformatting, no schema fork (convention.md unchanged), no ADR needed (behavioral change within existing done-gate + merge-verbal contract, impact class stated). Follow-ups: none deferred.

If any probe fails, reopen via a follow-up review; otherwise this verdict stands.

### 2026-10-18 @arggon-delivery-lead

verdict: approve

Review bar (engineering.md §Review bar) — all applicable bars pass:

- Architecture/boundaries: done-gate PR guard placed before filesystem mutation in runUpdate; no schema forks; CLI behavior change matches documented boundaries (done flip and merge are now linked).
- Implementation quality: actionable error message names the open PR number and tells the lead to merge or close first.
- Non-functional: subprocess args are arrays (execFileSync), guard is read-only (no writes outside repo root), graceful degradation when gh unavailable.
- Smoke evidence: Probe 5 end-to-end — done flip REFUSED when open PR targets branch, ALLOWED when no PR (verifier evidence).
- Tests: 5 new cases in cli/src/update.test.ts (PR-open refusal, no-PR allow, no-execGh degradation, no-branch, gh-failure); 82 tests pass across update/done-gate/sync suites.
- Docs: orchestration.md and agents.md §Orchestration → Merge verification updated with merge-ownership close-out rule; pitfalls.md one-liner added. Impact class: Behavioral (ADR 0016).
- validate: ok, 0 warnings; prettier clean; tsc clean.

Standards reviewer: approve (conditional on probe confirmation — all 5 probes now pass).
Verifier: all 5 probes pass (validate ok, tsc clean, prettier clean, 82 tests, done-gate PR guard refuse/allow verified end-to-end).

Plugin bundle regenerated (24 insertions — update.ts PR guard code inlined into the vendored bundle).

No code change beyond the done-gate PR guard and docs. Merge PR #861, then flip this item to done.

_(Both verdict blocks above were recovered verbatim from git after a local `main` reset during the post-merge rebase; content and authors unchanged. The merge itself was completed on PR #861 — see the `MERGE-OWNERSHIP CLOSE-OUT` note below.)_

### 2026-10-18 @arggon-delivery-lead

MERGE-OWNERSHIP CLOSE-OUT — the behavior this item mandates, executed on its own PR #861:

- Armed auto-merge at 19:47Z; it did **not** fire — the rollup stayed `BLOCKED` while checks ran, confirming the item's premise that `--auto` is arming, not ensuring.
- Polled the rollup to terminal state: `tasks-validate` SUCCESS 19:48Z, `ui-smoke` SUCCESS 19:50Z, `cli` SUCCESS 19:55Z → `mergeStateStatus` CLEAN.
- Merged explicitly (`gh pr merge 861 --merge`) and re-checked: `state: MERGED`, `mergedAt: 2026-10-18T20:12:15Z`. The loop ended at MERGED, not at `--auto`.
- Post-merge verification: `origin/main` carries the branch as `4319aaf5`; delivery-lead verdicts recorded; this item flipped to `done`.

Evidence expected-vs-observed for the acceptance criteria is in the verdict blocks above; this note is the merge-close-out half.
