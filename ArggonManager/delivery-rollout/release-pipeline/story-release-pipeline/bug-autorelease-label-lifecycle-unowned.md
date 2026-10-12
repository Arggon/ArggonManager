---
type: bug
status: in_progress
id: bug-autorelease-label-lifecycle-unowned
title: "The `autorelease` label lifecycle is load-bearing and owned by nobody: release-please needs `autorelease: pending` → `tagged`, but it only flips the label when ITS tagging path runs, and this repo tags in `release.yml` — a permanent deadlock by construction, documented nowhere"
assignee: arggon-delivery-lead
branch: fix/bug-autorelease-label-lifecycle-unowned
parent: story-release-pipeline
labels: [release, docs, methodology]
created: "2026-10-07"
updated: "2026-10-12"
claimed_at: "2026-10-12T17:27:29.536Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-autorelease-label-lifecycle-unowned
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-autorelease-label-lifecycle-unowned.md
  Leaves live only under a story. id is the filename stem: bug-autorelease-label-lifecycle-unowned.
  CLI `arggon create bug autorelease-label-lifecycle-unowned` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# The `autorelease` label lifecycle is load-bearing and owned by nobody: release-please needs `autorelease: pending` → `tagged`, but it only flips the label when ITS tagging path runs, and this repo tags in `release.yml` — a permanent deadlock by construction, documented nowhere

## Context

Found on 2026-10-07 while cutting `0.6.0`, as the second half of a deadlock whose
first half is `bug-release-config-workflow-agreement-ungated`. Either one alone
would have kept the release pipeline dead; both had to be resolved for a release
PR to be proposable at all.

### The mechanism, measured

release-please tracks release PRs by **label**. Its defaults
(`release-please` `src/manifest.ts:289–291`):

```js
export const DEFAULT_LABELS = ["autorelease: pending"];
export const DEFAULT_RELEASE_LABELS = ["autorelease: tagged"];
```

`findMergedReleasePullRequests` (`manifest.ts:1146`) iterates merged PRs and
selects those carrying `hasAllLabels(this.labels, …)` — i.e. still
`autorelease: pending`. Any it finds is treated as a **merged-but-untagged**
release, and `createPullRequests` then refuses to open a new one:

```
⚠ There are untagged, merged release PRs outstanding - aborting
```

**The label is normally flipped by release-please's own tagging path** — which
this repo deliberately does not use. The config sets
`skip-github-release: true` and `release.yml` owns tagging (`git tag -a
v${VERSION}`), because `GITHUB_TOKEN`-created events do not trigger workflows
(spec §Rationale). So release-please never tags, never flips the label, and the
one merged release PR it created — **#556**, merged 2026-10-02 — sat on
`autorelease: pending` forever. Every subsequent run read it as untagged and
aborted.

**Resolved for 0.6.0** by creating the `autorelease: tagged` label and moving
#556 onto it. Verified: the abort count went 1 → 0 and release PR #664 appeared.

### The gap

**No record of this lifecycle exists anywhere.** `grep -rn autorelease` across the
entire tree returned **zero hits** before this investigation — not in
`spec-release-pipeline-015`, not in ADR 0018, not in `release.md`. A label that
is load-bearing for the pipeline appears nowhere an author or operator would read
it, and its ownership is split across two workflows that do not talk to each other.

## Acceptance

- [x] Decide and record **who owns the label**, with the reasoning: (a)
      `release.yml` flips `autorelease: pending` → `tagged` on the merged release
      PR after it tags (the workflow that actually tags owns the label its action
      implies); (b) `release-please.yml` detects a tagged version and flips it
      (keeps the label's meaning with its author, but makes a workflow that owns
      no tags responsible for them); or (c) another shape, stated
- [x] Whatever is chosen, **the deadlock cannot recur**: proven by a test or a
      documented, verified run, not by reading the config. Show the sequence that
      previously deadlocked now completing
- [x] The lifecycle is **written down where the operator reads it** — the
      `autorelease` states, which workflow owns each transition, and what to do
      when a merged release PR is stuck (the recovery I performed by hand belongs
      in `release.md`'s exception paths, which today do not mention it)
- [x] `skip-github-release: true` and label ownership are reconciled explicitly:
      the config deliberately opts out of release-please's tagging, so the item
      states which parts of release-please's bookkeeping the repo now owns itself
- [x] A stuck-label condition is **detectable before it costs five days** — the
      release PR that should exist is asserted, or the stale label is reported,
      rather than relying on someone reading a warning inside a green run
- [x] Tests travel with the change where the change is code; `arggon validate`
      green

## Notes

Stacked with `bug-release-config-workflow-agreement-ungated`: that item fixes the
tag-form mismatch, this one the label bookkeeping. Both were required. Neither
had been considered when the release pipeline was designed — the spec's §Rationale
worked out _who tags_ but never asked _who updates release-please's bookkeeping
once it stops tagging_.

### 2026-10-12 @ses_ed6d54e92ffe2VO1GeR34DQEEy
### 2026-10-12 @arggon-delivery-lead — decision recorded: option (a), release.yml owns the flip

The item's first acceptance criterion asks who owns the `autorelease: pending` → `tagged` transition. That is a reversible CI-ownership call inside the delivery lead's sequencing authority (not an authority-map row, not a brief), so it is decided and recorded here.

**Decision: (a)** — `release.yml` flips the label on the merged release PR, in the same run that tags, immediately after the tag↔version agreement step.

Reasoning:
1. The label's meaning is "this release PR was merged but its release is not tagged yet". The fact that resolves that condition — the tag — exists only in `release.yml`'s run. The workflow that creates the fact owns the bookkeeping the fact implies; coupling them in one run also makes the flip atomic by construction (a run that dies before the flip leaves the abort backstop to catch it, which is exactly what item `bug-release-config-workflow-agreement-ungated` lands as its abort-surfacing step).
2. (b) was rejected: it makes a workflow that owns no tags responsible for tag bookkeeping, and flips on a delay (the next push to main), so the label stays wrong for the whole window between the tag and the next push — the exact window the deadlock lived in.
3. The `skip-github-release: true` reconciliation the acceptance asks for: the repo opted out of release-please's tagging because GITHUB_TOKEN-created events do not trigger workflows, so release-please never runs its own tagging path and never flips its own label. The parts of release-please's bookkeeping the repo now owns itself are: (i) the tag-vs-config agreement (gate, landed by `bug-release-config-workflow-agreement-ungated`), (ii) the label lifecycle flip (this item), and (iii) the abort-condition surfacing that replaces "read the warning inside a green run".

Detection criterion for this item is therefore satisfied by the release-please.yml backstop from `bug-release-config-workflow-agreement-ungated` (fail the run when merged `autorelease: pending` PRs are outstanding) plus this item's release.md lifecycle section; the maker should extend that backstop's message with the manual recovery (`gh pr edit <n> --add-label "autorelease: tagged" --remove-label "autorelease: pending"`) if the wave-3 item's landed step does not already carry it.

### 2026-10-12 @ses_ed6d54e92ffe2VO1GeR34DQEEy
### 2026-10-12 @arggon-delivery-lead — live recurrence during wave-3 merge verification (context for the maker)

The deadlock this item describes is not historical: merged release PR **#664** (`chore: release main`, merged 2026-10-09) sat on `autorelease: pending` until today, and every release-please run since was silently aborting behind green — the exact 5-day-blindness class. It was surfaced by the new backstop (landed with PR #740: run 38282448930 went RED naming #664 on the #740 merge push) and I cleared it by hand during merge verification: `gh pr edit 664 --add-label "autorelease: tagged" --remove-label "autorelease: pending"`. No automation flips it yet — that is this item's job. The maker's non-recurrence evidence can cite this exact sequence: stuck #664 → backstop red → manual flip → next run green.

### 2026-10-12 @arggon-maker — implemented: `release.yml` owns the flip

**Shape.** `cli/release-label-flip.mjs` (new; `cli/release-label-flip.test.ts` drives it offline with a queued fake `gh` on `GH_BIN`) queries release-please's own abort predicate — `gh pr list --repo … --state merged --label "autorelease: pending" --limit 200 --json number,title,headRefName`, the same window the backstop uses — then, per merged PR, runs `gh pr edit <n> --repo … --add-label "autorelease: tagged" --remove-label "autorelease: pending"`: **the exact command the manual recovery documents**, so automation and instruction cannot drift. It re-runs the predicate as verification (the edit's exit code is not the verdict) and prints `OK` / `WARNING` lines.

**Placement.** In `release.yml`, after the tag↔version agreement assert and before the GitHub Release object and anything that ships, under `if: steps.guard.outputs.release == 'true'` (covers rule-1 release and rule-2 re-run; rule-0 pushes never reach it). The window between the tag and the flip is therefore as short as the run allows; the label tracks the **tag**, not the publish, so it stays correct if a later step fails.

**Failure policy: warn, never fail (exit 0 on every path).** The step sits before the publish, so a non-zero exit would strand a tagged release at the worst moment — nothing shipped because bookkeeping failed; on a rule-2 re-run the artifacts may already have shipped, so failing would redden a complete release for bookkeeping alone. The residual failure is not silent: the run log carries the warning, and the release-please backstop reddens the next push naming the PR plus the manual recovery. That is the deliberate asymmetry with the backstop, which fails CLOSED on unknown state: a gate must never claim green, a repair must never strand the release it is tidying up after. Both the script header and `release.md` state the rejected alternative (fail the run) and why.

**Permission.** Added `pull-requests: write` only (`contents: write`, `id-token: write` untouched). GitHub's GITHUB_TOKEN permission table (docs.github.com → Workflow syntax for GitHub Actions → permissions) says `pull-requests: write` "permits an action to add a label to a pull request", and the label endpoints (`POST`/`DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels`) are listed under Repository permissions for "Pull requests" (write) in "Permissions required for GitHub Apps"; `write` includes the read `gh pr edit` performs. Already observed live in this repo: `release-please.yml` grants `pull-requests: write` (no `issues:`) and its backstop's `gh pr list --label` query returned #664.

**Backstop seam.** `cli/release-abort-check.mjs`'s FAIL message now carries the manual recovery at the marked seam; predicate, verdicts and the fail-open paths are untouched, and the stale seam comments now describe the landed ownership. A new test pins the recovery line on the red path and its absence on the green path; every original test stays green.

**Docs.** `release.md` gains §The `autorelease` label lifecycle (states, who owns each transition, the stuck-PR recovery, the `skip-github-release: true` reconciliation: tag↔config agreement / label flip / abort surfacing are the three pieces of release-please bookkeeping the repo now owns), plus the flip in "What the automation owns" and the named owner in §The tag↔config agreement.

**Non-recurrence evidence (class-level, offline).** `cli/release-label-flip.test.ts`: no-op (exactly 1 query, no edit), one and many flips, the exact manual-recovery argv, failed flip → warn + exit 0, label surviving the flip → warn + recovery, query failure, unparseable output, unverifiable flip, `GITHUB_REPOSITORY` fallback, missing repo. The workflow contract pins placement (after agreement, before the release object/publish), the guard condition, and the `pull-requests: write` grant. The class's live record stays the sequence in the comment above: #664 stuck → backstop run 38282448930 red naming it → manual flip → run 38283343454 `release-abort-check: OK` + release PR #744 opened; this change automates the flip in that same run.

**Gates** (worktree, branch `fix/bug-autorelease-label-lifecycle-unowned`) — expected vs observed, all run before the PR: `npm run test` → all green; `npm run test:structure` → green; `npm run lint:structure` → green; `npm run arggon -- validate` → `ok (0 warning(s), convention v5)`; `actionlint .github/workflows/release.yml` → no findings; `npx prettier --check` on the six changed files → "All matched files use Prettier code style!".
