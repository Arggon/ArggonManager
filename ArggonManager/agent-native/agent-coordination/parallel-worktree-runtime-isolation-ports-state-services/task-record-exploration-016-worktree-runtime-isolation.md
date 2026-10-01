---
type: task
status: in_progress
id: task-record-exploration-016-worktree-runtime-isolation
title: "Record exploration 016: worktree runtime isolation"
assignee: Arggon
branch: feat/task-record-exploration-016-worktree-runtime-isolation
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, exploration, devex]
created: "2026-10-01"
updated: "2026-10-01"
claimed_at: "2026-10-01T11:53:03.213Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-record-exploration-016-worktree-runtime-isolation
---
<!--
  Placement (v0): ArggonManager/agent-native/agent-coordination/parallel-worktree-runtime-isolation-ports-state-services/task-record-exploration-016-worktree-runtime-isolation.md
  Leaves live only under a story. id is the filename stem: task-record-exploration-016-worktree-runtime-isolation.
  CLI `arggon create task record-exploration-016-worktree-runtime-isolation` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Record exploration 016: worktree runtime isolation

## Context

Coordinator directive (2026-10-01): per-task worktrees sometimes collide at
runtime — "we cannot run the same project multiple times to test different
changes simultaneously … Docker might be the solution, but let's find the best
approach that consumes the fewest possible resources." This task records the
comparison as the repo's own exploration artifact (candidates → criteria →
findings with dated sources → recommendation). The decision itself (ADR +
follow-up spec/tasks) is intentionally **not** part of this task — it happens
after the product owner accepts the recommendation.

## Acceptance

- [x] `ArggonManager/docs/explorations/exploration-worktree-env-isolation-017.md` exists with the methodology's structure (candidates C1–C6, criteria 1–7, findings, recommendation) — renumbered from draft-016: main's concurrent update-delivery record merged exploration 016 + ADR 0018 + spec/plan 015 first (2026-10-01).
- [x] Covers the four required areas: process/worktree isolation model — what a session owns (F12, F14); ports/state/services runtime resources that leak across worktrees (F1–F3, F5, F11, F13); the observed incidents as findings (F12–F14 + incident register); options going forward (candidates + recommendation).
- [x] Consistent with the decision record it cites — ADR 0019 + spec/plan worktree-env-contract-016 (all links resolve after the renumber); the numbering collision with main's update-delivery ADR 0018/spec 015 is called out explicitly in each renumbered doc; no content contradictions.
- [x] `npm run arggon -- validate` ok; `npm test` untouched-green (docs-only change, suite still run); lint green.
- [x] Item hygiene: this checklist written + ticked, evidence comment + handoff appended, status stays `in_progress` for the coordinator.

## Notes

### 2026-10-01 @Arggon
Exploration recorded on branch feat/task-record-exploration-016-worktree-runtime-isolation (commit eb48effb), draft PR Arggon/ArggonManager#523.

Evidence:
- Files created: ArggonManager/docs/explorations/exploration-worktree-env-isolation-016.md; only other edit: this item's Context/Acceptance (boxes ticked).
- Numbering verified before writing: explorations max on main was 014; 015 and ADR 0017 are reserved by open PR #519, so this doc took 016 (both open PRs merge cleanly in either order).
- `npm run arggon -- validate` ok (0 warnings, convention v5) before staging; pre-commit gate re-ran it on commit.
- Measured inputs (2026-10-01): board --serve binds port 0 (cli/src/board-serve.ts:473); docker ps shows fixed-port shared services (evajoyas-db 5433, mssql 1433); node_modules 182 MB; docker system df 3.3 GB reclaimable volumes; distrobox shares $HOME (docs); containers share host kernel (Red Hat/CMU sources).
- Recommendation recorded: layered — C1 host-native env contract always (via the existing start --worktree seam), C2 ephemeral per-worktree service containers only for real service collisions; C3 devcontainer/C4 distrobox/C6 VM rejected as defaults; C5 Nix optional complement. ADR left open pending product-owner acceptance (next free ADR id likely 0018 at merge time).

### 2026-10-01 @Arggon
Adopter-generality revision pushed to PR #523 (commit 727df50a) after product-owner correction: the methodology ships to adopters (npm / OpenCode seam / ZCode plugin) on linux/macos/windows — the exploration must not assume this repo or this machine.

Changes:
- Scope restated: ArggonManager is the first adopter of its own convention; measured numbers are collision-class evidence, not an adopter baseline.
- New F9: Docker is not part of any adopter contract, and Docker Desktop runs a Linux VM on macOS/Windows (docs.docker.com, 2026-10-01) — Docker-dependent options are documented opt-in patterns only; C1 is the only zero-marginal-cost option on all three platforms.
- New F10: ADR 0005 adopter shapes — contract must degrade to a no-op (static-site adopter changes nothing).
- New F11: per-OS state-dir mapping follows env-paths conventions, not a new scheme.
- C1 mechanism corrected to file-first (gitignored dotenv-style file) instead of shell export — portable across runtimes and shells; unix sockets demoted to an optimization, never the contract.
- Cleanup integration made opt-in and safe by construction: kernel never probes/invokes Docker the convention didn't declare (F8).
- Criterion 7 (platform portability) added; YAGNI list extended (no Docker detection/installation in kernel).

`npm run arggon -- validate` ok (0 warnings). Recommendation unchanged in verdict, generalized in scope: C1 always; C2 opt-in for Docker-shipping adopters; C3/C4/C6 rejected; C5 optional. ADR remains open pending product-owner acceptance.

### 2026-10-01 @Arggon
Product owner ACCEPTED the recommendation (2026-10-01, this session). Decision recorded in this PR: ADR 0018 (status: Proposed, Accepted on merge) + exploration flipped to resolved + spec/plan worktree-env-contract-015 (spec validate ok, 26 docs). Follow-up tasks filed under the story: task-env-contract-start (layer 1 implementation), task-cleanup-declared-services (layer 2 reaping, depends_on env-contract-start), task-adopter-services-pattern-doc (layer 2 docs). PR updated to ready-for-review; scope: exploration + decision paper trail, docs-only.

### 2026-10-01 @Arggon
NUMBERING RECONCILIATION (attach session). The task title says "exploration 016", but main's concurrent update-delivery record merged first and took exploration 016 (`exploration-update-delivery-016.md`), ADR 0018 (`0018-update-delivery-and-distribution-channel.md`) and spec/plan 015 (update-channel/release-pipeline). The briefing's "ADR 0018 + spec/plan 015 already exist" pointers therefore resolve on main to that OTHER topic — not a contradiction to align with, but a merge-order collision with THIS branch's draft-era ids. Resolution, per "numbers are assigned by merge order":

- Renumbered on this branch (git mv + all cross-references): exploration-worktree-env-isolation-016 → **017**, 0018-worktree-runtime-isolation → **0019**, spec/plan-worktree-env-contract-015 → **016**; ADR README index row added for 0019. Stale numbering notes inside all three docs rewritten (the old "015/0017 reserved by PR #519" note was pre-merge and outdated). The other exploration was NOT renamed.
- origin/main merged into the branch first (clean, no conflicts); renumber applied on top.
- Incidents added to the exploration as findings per acceptance: F12 (seam-pin claimed worktree written into by a concurrent session — PR #544 disclosure, ses_f0821d67), F13 (the eight install-incidents of bug-start-install-ordering + the #517/#533/#551 strict/fresh-gate arc + a live attach observation), F14 (PR #559 session-move smoke leg proving per-session/per-call resolution) + an incident register table.
- strict-gate-bins tripwire (armed per briefing): attach start resolved all eight gate bins from the worktree (`source: "worktree"` ×8) — NO refusal, no npm ci needed; the tripwire did not fire, recorded as a post-#551 positive observation.
- Open question flagged for the coordinator (in F12): should the kernel/plugin detect and refuse a second live session on a claimed worktree (single-writer enforcement)? Out of this item's scope; not filed as a task from here.

Gates (this worktree, 2026-10-01): `npm run arggon -- validate` ok (0 warnings, convention v5); `spec validate` ok (30 docs, 0 warnings); `npm test` 2053/2053 green (two first-run failures fixed in-PR: prose-format gate caught a line-wrapped code span in the ADR — rewrapped; headless-ci needed `npm run build` in the worktree — environment, not code); `npm run lint` exit 0; plugin bundle regen byte-identical.

Item stays `in_progress` for coordinator review; PR #523 updated (retitled to exploration 017).
