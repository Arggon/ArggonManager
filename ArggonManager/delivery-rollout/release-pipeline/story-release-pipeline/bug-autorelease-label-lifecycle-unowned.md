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
