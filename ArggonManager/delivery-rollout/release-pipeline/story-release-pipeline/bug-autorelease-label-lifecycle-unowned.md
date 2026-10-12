---
type: bug
status: todo
id: bug-autorelease-label-lifecycle-unowned
title: "The `autorelease` label lifecycle is load-bearing and owned by nobody: release-please needs `autorelease: pending` → `tagged`, but it only flips the label when ITS tagging path runs, and this repo tags in `release.yml` — a permanent deadlock by construction, documented nowhere"
parent: story-release-pipeline
labels: [release, docs, methodology]
created: "2026-10-07"
updated: "2026-10-07"
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

- [ ] Decide and record **who owns the label**, with the reasoning: (a)
      `release.yml` flips `autorelease: pending` → `tagged` on the merged release
      PR after it tags (the workflow that actually tags owns the label its action
      implies); (b) `release-please.yml` detects a tagged version and flips it
      (keeps the label's meaning with its author, but makes a workflow that owns
      no tags responsible for them); or (c) another shape, stated
- [ ] Whatever is chosen, **the deadlock cannot recur**: proven by a test or a
      documented, verified run, not by reading the config. Show the sequence that
      previously deadlocked now completing
- [ ] The lifecycle is **written down where the operator reads it** — the
      `autorelease` states, which workflow owns each transition, and what to do
      when a merged release PR is stuck (the recovery I performed by hand belongs
      in `release.md`'s exception paths, which today do not mention it)
- [ ] `skip-github-release: true` and label ownership are reconciled explicitly:
      the config deliberately opts out of release-please's tagging, so the item
      states which parts of release-please's bookkeeping the repo now owns itself
- [ ] A stuck-label condition is **detectable before it costs five days** — the
      release PR that should exist is asserted, or the stale label is reported,
      rather than relying on someone reading a warning inside a green run
- [ ] Tests travel with the change where the change is code; `arggon validate`
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
