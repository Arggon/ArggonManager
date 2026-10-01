---
type: task
status: done
id: task-release-spec
title: "Spec + plan: release pipeline (release PR + OIDC publish + exact pin + tarballs)"
assignee: Arggon
branch: feat/task-release-spec
parent: story-release-pipeline
labels: [delivery, spec]
priority: p1
created: "2026-10-01"
updated: "2026-10-01"
worktree_path: /home/arggon/Projects/ArggonManager-task-release-spec
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/task-release-spec.md
  Leaves live only under a story. id is the filename stem: task-release-spec.
  CLI `arggon create task release-spec` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spec + plan: release pipeline (release PR + OIDC publish + exact pin + tarballs)

## Context

Implements the spec-first gate (ADR 0017) for [ADR 0018](../../../../docs/adr/0018-update-delivery-and-distribution-channel.md)
§1–2 and §4: the release-please-style release PR flow, the OIDC publish
workflow, the exact kernel pin, and the tarball assets. Inputs: ADR 0018,
[exploration-update-delivery-016](../../../../docs/explorations/exploration-update-delivery-016.md),
`release.md` (current manual runbook + gotchas), `ArggonManager/docs/ci.md`
(drift gate + pinned install interplay), `task-ci-seam-pin-tracks-release`
(lands with/before the pipeline; repo's own `arggon.yml` pin is enforced by
the seam lag guard — derivation rejected with evidence, see
task-ci-seam-pin-tracks-release and the ADR 0018 amendment of 2026-10-01).

## Acceptance

- [x] Spec at `ArggonManager/docs/specs/spec-release-pipeline-015.md` with purpose, surfaces (workflow inputs/triggers, manifest files), invariants, and acceptance criteria. Invariants present: never publish without tag↔version agreement (C3 ordered predicate + A9); no stored `NPM_TOKEN` (OIDC only, `id-token: write`, npm ≥ 11.5.1 runner); lib-first publish order with propagation poll; exact kernel pin written in lockstep (extra-files JSON updater — `node-workspace` plugin rejected at source level: it preserves the caret); both tarballs attached to the GitHub Release; the publish workflow file is named `release.yml` (trusted-publisher binding).
- [x] Settles with rationale, exactly one choice each: exact pin via release-please `extra-files` JSON updater; release proposal via `Release-As: X.Y.Z` trailer (no conventional-commit adoption required); `release.yml` triggers on push-to-main self-guarded to release commits (tag-push and release-published are structurally dead: GITHUB_TOKEN recursion rule; `workflow_call` breaks the calling-workflow filename binding); CHANGELOG in house Keep-a-Changelog style, generator output hand-editable in the release PR. Sources dated and reviewer-verified at source level.
- [x] Interplay documented: CI version guard, drift gate + literal `ARGGON_VERSION` pin enforced by the seam lag guard (aligned to the recorded task-ci-seam-pin-tracks-release decision after review), approval-required CI on GITHUB_TOKEN-created release PRs ("Approve workflows"), the one-time human npmjs.com trusted-publisher setup, and the `repository` field prerequisite on both packages.
- [x] Plan at `ArggonManager/docs/plans/plan-release-pipeline-015.md` (T0–T8, ordered, verifiable ACs, linked to the spec); `task-release-workflow` acceptance checklist mirrors the plan (T3 mirror updated to the ordered predicate at merge).
- [x] Gates: `spec validate` ok; `spec analyze --baseline` 0 NEW / 6 unchanged, exit 0 (reviewer re-ran independently); `arggon validate` ok. Reviewer verdict request-changes adjudicated: F1 already fixed on head, F2–F4 applied and coordinator-verified, prose-format gate green.
- [x] Non-goals recorded: no auto-publish on push to main (enforceable form: no publish without a human-pushed version-bump commit), no standalone binaries, no `whatsnew`, no non-npm package managers.

## Noteswhat triggers `release.yml` (tag push vs release published); the CHANGELOG section format (must match the existing Keep-a-Changelog style; hand-editable in the release PR).
- [x] Documents the interplay: CI version guard (tags), drift gate + `ARGGON_VERSION` pin, `task-ci-seam-pin-tracks-release`, and the one-time human step (npmjs.com trusted publishers for `arggon-manager` + `@arggondev/lib`, workflow file `release.yml`, direct publish allowed).
- [x] Plan at `ArggonManager/docs/plans/plan-release-pipeline-015.md` linked to the spec; ordered tasks each with verifiable acceptance criteria; the implementation task `task-release-workflow` updated to mirror them.
- [x] `arggon spec validate` ok; `spec analyze --baseline <file>` reports no NEW findings (baseline committed beside the spec work); `arggon validate` ok.
- [x] Non-goals recorded: auto-publish on push to main; standalone binaries; `whatsnew`; non-npm package managers.

## Notes

### handoff 2026-10-01 @ses_f081ac611ffemv23pwZefY9f10 (session: ses_f081ac611ffemv23pwZefY9f10) — next: Coordinator review of PR #545 (spec+plan only). On merge, task-release-workflow may claim after task-ci-seam-pin-tracks-release lands plan T0 semantics.
- branch: feat/task-release-spec
- open questions: C3 trigger deviation from old checklist wording (push-main guarded vs tag/release events) needs coordinator sign-off; repository field missing in both package.jsons is a one-time prereq in plan T1

### 2026-10-01 @ses_f081ac611ffemv23pwZefY9f10
Spec + plan delivered — PR #545 (branch feat/task-release-spec, worktree ArggonManager-task-release-spec).

Artifacts: ArggonManager/docs/specs/spec-release-pipeline-015.md; ArggonManager/docs/plans/plan-release-pipeline-015.md (T0–T8); baseline ArggonManager/docs/specs/spec-analyze-baseline-release-pipeline-015.json committed beside the spec; task-release-workflow checklist mirrored to plan T1–T8.

Settled choices (rationale + dated sources in the spec):
1. Exact pin via release-please extra-files JSON updater — node-workspace's newVersionWithRange preserves the caret (src/updaters/node/package-json.ts, accessed 2026-10-01), so it cannot write the exact pin.
2. Proposal without conventional commits: Release-As: X.Y.Z trailer on a (possibly empty) commit to main — release-please README documented override; forces both manifest packages in lockstep.
3. release.yml trigger: push to main, self-guarded to release commits. NOT tag push / release published: release-please creates tag+release with the default GITHUB_TOKEN and GitHub's recursion rule suppresses those events (docs.github.com, Triggering a workflow, accessed 2026-10-01); and npm trusted publishing validates the CALLING workflow filename under workflow_call (docs.npmjs.com/trusted-publishers, accessed 2026-10-01), so a reusable release.yml would break the release.yml naming invariant. Ownership consequence: release-please.yml = PR maintenance only (skip-github-release: true); release.yml owns tag + GitHub Release + publish + assets.
4. CHANGELOG: house Keep-a-Changelog style, hand-edited in the release PR; generator output is a draft; hand edits persist (manifest-driven prepend).

Gates + evidence (expected vs observed):
- arggon spec validate → expected ok / observed {"ok":true, errors:[], warnings:[]}.
- spec analyze --save-baseline <file> → 6 corpus findings snapshotted; spec analyze --baseline <file> → expected no NEW findings / observed "0 new, 0 resolved, 6 unchanged", exit 0. Zero findings target the new spec itself.
- arggon validate (pre-commit hook) → ok (0 warnings, convention v5). Commit 74749bbf, staged explicit paths only.
- PR: https://github.com/Arggon/ArggonManager/pull/545 with task-release-spec in title+body.

Findings for the coordinator (not filed as items per subagent rules):
- task-release-workflow checklist deviation: original wording had release-please.yml creating "release PR + tag + GitHub release notes"; under C3 the tag + release notes move to release.yml (recursion + npm-calling-workflow rules). Mirrored checklist reconciled; sign-off requested.
- "Auto-publish on push to main" non-goal: the settled trigger IS push-to-main but fires only on a merged release PR (version bump beyond latest v* tag); spec argues this preserves ADR 0018's constraint — human comfort check requested.
- Both package.json files lack repository.url — required by npm trusted publishing; added as one-time plan T1 (AC A13).
- task-ci-seam-pin-tracks-release now has concrete required semantics (release-window drift-gate skip) in the spec Interplay section — its claiming agent should implement to that contract.

### 2026-10-01 @ses_f0800e936ffeMAm3ZjdNqUVXgW
Recovery session (verification + one contract fix): attached to the existing worktree and found the resumed worker's delivery (commit 74749bbf, PR #545) mid-flight. Verified the deliverable against the acceptance checklist — spec + plan complete, four settled choices with rationale + dated sources, non-goals present, baseline committed. One defect against the mission contract: the spec's Interplay (and plan T0, task-release-workflow Context/T7) still described the seam pin as RUN-TIME DERIVATION with release-window skip semantics — exactly what the recorded decision on task-ci-seam-pin-tracks-release (2026-10-01, recovery session) REJECTED. Fixed in commit 0b99eb83: spec Interplay rewritten to "enforced non-divergence (guard), not run-time derivation" with the decision cited in Sources; Edge table release-window row now structural (literal pin does not move at release time — no skip semantics needed); plan T0 = literal pin + lag-guard test with red/green acceptance states; re-pin step stays, guard-enforced. Gates (expected vs observed): spec validate → ok; spec analyze --baseline spec-analyze-baseline-release-pipeline-015.json → expected 0 NEW / observed "0 new, 0 resolved, 6 unchanged", exit 0; arggon validate → ok (pre-commit, twice). Pushed 74749bbf..0b99eb83; PR #545 head now 0b99eb83; reviewer note posted as PR comment.

### handoff 2026-10-01 @ses_f0800e936ffeMAm3ZjdNqUVXgW (session: ses_f0800e936ffeMAm3ZjdNqUVXgW) — next: Coordinator: review + merge PR #545 (head 0b99eb83); sign off C3 ownership deviation and file the one-line ADR 0018 §1 amendment (derivation parenthetical superseded).
- branch: HEAD
- open questions: ADR 0018 parenthetical amendment owner; task-release-spec Context line still says "pin becomes derived" (stale, outside my file scope); release.yml push-to-main trigger vs auto-publish non-goal needs…

### 2026-10-01 @ses_f0870e73affeEVvaFZPi9K7NDj
verdict: request-changes (coordinator review of PR #545, reviewer pass adjudicated — note: the reviewer examined the pre-0b99eb83 head).

F1 (pin semantics): ALREADY RESOLVED on head 0b99eb83 — Interplay/edge row/T0/sources now describe the guard-enforced literal pin citing the recorded decision on task-ci-seam-pin-tracks-release. Verified; no action.

Required fixes on the current head:
F2 (spec §C3, trigger guard): the rule ordering reds main permanently. After v(X) is tagged at commit C, every later ordinary push has V=X with the tag pointing at C ≠ HEAD → rule "tag exists pointing elsewhere → fail loudly" fires before "any other push → exit 0", making the steady state a permanent loud failure (first repro: the pipeline's own first post-merge push). Fix: classify FIRST — if the version at github.sha equals the version at the pushed commit's parent, it is not a release commit → exit 0; only version-changing pushes enter the tag cascade. Mirror into plan T3 and acceptance A5's fourth path.
F3 (spec invariant 7): overclaims — a direct hand-pushed version bump to an untagged number would publish without any release PR, and the guard cannot distinguish it from a squash-merged release-PR commit. Restate the guarantee in the enforceable form ("no publish without a human-pushed version-bump commit") and record the direct-push class in the edge table as a named trust boundary.
F4 (spec A12 + Flow step 3): the evidence path is underspecified — per current docs.github.com (GITHUB_TOKEN), pull_request events from GITHUB_TOKEN-created PRs run in an approval-required state; name the one-click "Approve workflows" step (write-access user) so A12's "npm ci green on the PR" is executable.
F5: no action; A2 stays mandatory.

Sources for F4: docs.github.com/en/actions/concepts/security/github_token ("When GITHUB_TOKEN triggers workflow runs", accessed 2026-10-01).

### 2026-10-01 @ses_f0800e936ffeMAm3ZjdNqUVXgW
Review fixes F2–F4 applied (commit 2bc6b10b, PR #545 head; F1 already on 0b99eb83, untouched). F2: §C3 guard is an ordered predicate — (0) version at github.sha == version at parent → exit 0 without publishing, FIRST (covers tracker flips/docs/fixes and post-release pushes, killing the permanent-red steady state); (1) version-changing push, tag v(V) absent → release; (2) tag at HEAD → idempotent re-run (wording kept); (3) tag elsewhere → fail loudly. Squash-merge safety stated (one commit, parent = pre-bump main, version differs exactly once). Mirrored: plan T3 (predicate + acceptance incl. a post-release push staying green), spec A5 (paths in predicate order), tag/race edge row → rule-0 outcome. F3: invariant 7 = "no publish without a human-pushed version-bump commit to main"; guard reads the commit, not its provenance (cannot distinguish squash merge from a hand push — said explicitly); edge-table row "Direct hand-pushed version bump to an untagged number" = named accepted trust boundary (treated as the release act); non-goals line aligned. F4: Flow step 3 names the approval gate — GITHUB_TOKEN-created PRs start approval-required, one "Approve workflows" click by a write-access user starts the runs, lockfile-sync push starts no new runs (docs.github.com GITHUB_TOKEN guidance, accessed 2026-10-01); A12 evidence executable: Approve workflows clicked → CI green incl. the lockfile-sync push. Gates (expected vs observed): spec validate → ok (26 docs, 0 warnings); spec analyze --baseline → expected 0 NEW / observed "0 new, 0 resolved, 6 unchanged", exit 0; arggon validate → ok (pre-commit). Pushed 0b99eb83..2bc6b10b. Mirror drift flagged: task-release-workflow T3 line still carries the old un-ordered guard wording (outside this round's edit scope — reconcile at review or during implementation).

### handoff 2026-10-01 @ses_f0800e936ffeMAm3ZjdNqUVXgW (session: ses_f0800e936ffeMAm3ZjdNqUVXgW) — next: Coordinator: re-review PR #545 at head 2bc6b10b (F2–F4); reconcile task-release-workflow T3 mirror to the ordered predicate.
- branch: main
- open questions: workflow-item T3 mirror drift (old guard wording, outside my edit scope this round); direct-push trust boundary wording sign-off
