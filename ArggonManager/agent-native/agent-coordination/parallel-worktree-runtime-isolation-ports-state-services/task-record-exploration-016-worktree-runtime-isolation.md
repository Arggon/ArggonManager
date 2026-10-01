---
type: task
status: done
id: task-record-exploration-016-worktree-runtime-isolation
title: "Record exploration 016: worktree runtime isolation"
assignee: Arggon
branch: feat/task-record-exploration-016-worktree-runtime-isolation
parent: parallel-worktree-runtime-isolation-ports-state-services
labels: [worktree, exploration, devex]
created: "2026-10-01"
updated: "2026-10-01"
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

### 2026-10-01 @ses_f06c45a3fffePcjwiADfQ455Bi
RECONCILIATION DELIVERED (attach session, commit e3028921 on feat/task-record-exploration-016-worktree-runtime-isolation, PR #523 updated + retitled).

NAMING DISCREPANCY (as briefed): the task title says exploration 016, but `exploration-update-delivery-016.md` + ADR 0018-update-delivery + spec/plan 015 merged on main first (concurrent session, different topic). This branch's draft-era ids collided on BOTH sides. Resolution: numbers assigned by merge order -> renumbered on the branch (git mv + all cross-refs + ADR README row): exploration-worktree-env-isolation-016 -> 017, 0018-worktree-runtime-isolation -> 0019, spec/plan-worktree-env-contract-015 -> 016. Stale in-doc numbering notes rewritten; draft-era ids remain only in dated tracker comments (history). The other exploration was NOT renamed. origin/main merged into the branch first (clean, no conflicts).

ACCEPTANCE (all ticked on the item body):
- exploration-worktree-env-isolation-017.md: methodology structure (C1-C6 candidates, criteria 1-7, F1-F14 findings with dated sources, recommendation), covering the four required areas - process/worktree isolation model (F12/F14), ports/state/services leaks (F1-F3/F5/F11/F13), observed incidents as findings, options going forward.
- Incidents recorded: F12 seam-pin concurrent-writer disclosure (PR #544, ses_f0821d67: writes at 10:18, 11:41-44, 12:04-07 in the claimed worktree; no work lost, single-writer ownership unenforced); F13 the eight install-incidents (bug-start-install-ordering) + #517 gateBins receipts / #533 opt-in strict / #551 unconditional fresh-start gate semantics + live post-fix observation; F14 PR #559 session-move smoke leg (per-session/per-call resolution, 42/42 checks x2); incident register table added.
- Alignment: cites ADR 0019 + spec/plan 016; the collision with main's update-delivery 0018/015 is called out in each renumbered doc's numbering note; no content contradictions (update-delivery ADR is a different topic; its only touchpoint, PR #544's release-pipeline reasoning, is unaffected).

GATES (this worktree): validate ok (0 warnings, convention v5); spec validate ok (30 docs, 0 warnings); npm test 2053/2053 green; lint exit 0; plugin bundle regen byte-identical. First-run failures both fixed in-PR: (1) prose-format gate caught a line-wrapped code span `cleanup --prune` in the ADR (rewrapped single-line); (2) headless-ci.test needed `npm run build` in the worktree (environment gap - dist/ is a build artifact, not installed by start).

strict-gate-bins TRIPWIRE (armed per briefing): did NOT fire. tools.arggon.start attach resolved all eight gate bins from the worktree (source: "worktree" x8, strict armed) - no refusal, no npm ci. Recorded as a post-#551 positive observation in exploration F13.

OPEN (not filed from here, flagged for coordinator): single-writer enforcement for claimed worktrees (F12) - should the kernel/plugin detect and refuse a second live session on a claimed worktree? Also note: if another ADR takes 0019 before this merges, renumber again at merge time (PR body notes this).

### handoff 2026-10-01 @ses_f06c45a3fffePcjwiADfQ455Bi (session: ses_f06c45a3fffePcjwiADfQ455Bi) — next: Coordinator: review PR #523 (exploration 017 + ADR 0019 + spec/plan 016, renumbered after main took 016/0018/015); ADR flips Accepted at merge; renumber again only if 0019/016 get taken meanwhile.
- branch: main
- open questions: Single-writer enforcement for claimed worktrees (exploration F12) - kernel/plugin detect+refuse a second live session? Needs an owner decision, no task filed; PR #523 title/body still reference the i…

### 2026-10-01 @ses_f06c45a3fffePcjwiADfQ455Bi
Correction to the handoff above: 'branch: main' is a wrong auto-detection (the tool ran from the primary checkout — same trap ses_f0821d67 hit on task-ci-seam-pin-tracks-release). The item branch is feat/task-record-exploration-016-worktree-runtime-isolation, head e3028921 (renumber + incident findings), PR #523. Tracker note: the comment/handoff sections were auto-committed on main (4000d1b3, e728abb9) while the claim commit (1ae3f286) lives on the branch — merging origin/main into the branch next so the item file reconciles on both sides before PR merge.
