---
type: bug
status: in_progress
id: bug-release-config-workflow-agreement-ungated
title: "Nothing gates the release-please config against the tags `release.yml` actually creates — a one-word omission (`include-component-in-tag`) silently killed releases for five days, and every aborted run reported `success`"
assignee: arggon-delivery-lead
branch: fix/bug-release-config-workflow-agreement-ungated
parent: story-release-pipeline
labels: [ci, release, gate-fidelity]
created: "2026-10-07"
updated: "2026-10-12"
claimed_at: "2026-10-12T13:30:32.525Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-release-config-workflow-agreement-ungated
---
<!--
  Placement (v0): ArggonManager/delivery-rollout/release-pipeline/story-release-pipeline/bug-release-config-workflow-agreement-ungated.md
  Leaves live only under a story. id is the filename stem: bug-release-config-workflow-agreement-ungated.
  CLI `arggon create bug release-config-workflow-agreement-ungated` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Nothing gates the release-please config against the tags `release.yml` actually creates — a one-word omission (`include-component-in-tag`) silently killed releases for five days, and every aborted run reported `success`

## Context

Found on 2026-10-07 while cutting `0.6.0`. The release pipeline had been **dead
since 2026-10-02** and nobody knew, because **every aborted run reported
`success`**.

### What happened

`release-please-config.json` never set `include-component-in-tag`. The official
schema (fetched 2026-10-07, `schemas/config.json`) documents the default as
`true`, so release-please looked for component-prefixed tags:

```
⚠ Found release tag with component '', but not configured in manifest
❯ looking for tagName: arggon-manager-v0.5.0
❯ looking for tagName: lib-v0.5.0
⚠ There are untagged, merged release PRs outstanding - aborting
```

But the tags that exist are plain — `v0.2.0 v0.3.0 v0.4.0 v0.4.1 v0.5.0` —
because `release.yml` creates them that way, which is the **decided contract**
(`spec-release-pipeline-015` invariant 1: _"the root tag `vX.Y.Z` names the exact
commit being published"_; `release.yml:101` does `git tag -a "v${VERSION}"`).
So release-please could never find `v0.5.0`, concluded its own merged release PR
was untagged, and aborted before opening another one. **Permanently: it could not
open any subsequent release PR.**

### Why it was invisible

Verified across 13+ consecutive runs since the 0.5.0 cycle: every one contains
`untagged, merged release PRs outstanding - aborting`, and every one reports
**`success`**. The abort is a `logger.warn` inside a successful job
(`release-please` `src/manifest.ts:936`), so it is invisible to CI status, to any
dashboard reading conclusions, and to anyone who has not read the log line.

This is the same defect class as
`bug-verification-regex-matching-nothing`: a check that cannot fail teaches its
reader that nothing is wrong. The pipeline was confidently green while producing
nothing.

## Acceptance

- [x] A gate asserts the **release-please config agrees with the tags
      `release.yml` creates** — at minimum that the component-in-tag setting
      resolves to the `vX.Y.Z` form the workflow produces, so the next config
      drift fails loudly instead of aborting inside a green run
- [x] The gate is **proven with a negative case**: flip `include-component-in-tag`
      in a fixture and confirm the check fails. A gate that has never been seen
      red is not evidence (this repo's own standard — the reject-refactor and
      negative-fixture precedent)
- [x] The **abort is surfaced**: an aborted release-please run must not report a
      bare `success` that a reader can mistake for progress. Either the workflow
      fails/warns loudly on the abort condition, or it asserts a release PR exists
      when one is expected. State which, and why the chosen shape cannot go red on
      a legitimate no-release push
- [x] The contract is **written down where the next author reads it**: the tag
      form (`vX.Y.Z`, no component prefix) and the config option that must agree
      with it, in `release.md` or the spec — not only in this item
- [x] Verified against a real release-please run, not by reading the config:
      observe the run either open the release PR or fail loudly
- [x] Tests travel with the change; `npm run test`, `npm run test:structure`,
      `npm run lint:structure` green; `arggon validate` green

## Notes

Related and stacked: `bug-autorelease-label-lifecycle-unowned` is the second half
of the same deadlock. Both had to be resolved for `0.6.0` to be proposable, and
either one alone would have kept the pipeline dead.

### 2026-10-12 — maker (arggon-maker worktree): gate + abort backstop

**Not "fixed" again.** The config already carried `include-component-in-tag: false`
(commit b7b5f866). This change adds the two things that were missing: a gate that
holds the config and `release.yml` against each other, and a run that can no longer
report `success` while aborting.

**Gate 1 — config ↔ tag-form agreement.** `cli/src/release-config-agreement.test.ts`
(exports pure `agreementViolation(config, workflow)`). Predicate: `release.yml`'s
`git tag -a "<ref>"` line must produce the plain `v${VERSION}` (spec invariant 1),
AND `release-please-config.json`'s `include-component-in-tag` must resolve to
`false` (absent ⇒ schema default `true` ⇒ the outage shape). Two-sided: it also
reddens the reverse drift of editing the workflow's tag back to a component prefix.
Documented in `release.md` §The tag↔config agreement.

**Gate 2 — the abort surfaces.** `cli/release-abort-check.mjs`, wired into
`.github/workflows/release-please.yml` right after the checkout (runs on every push,
no `if:`). Predicate IS release-please's own, lifted from `src/manifest.ts`: a MERGED
PR still carrying `autorelease: pending` (`gh pr list --state merged --label
"autorelease: pending"`). Found ⇒ exit 1 (red); none ⇒ exit 0. **Why it cannot go red
on a legitimate no-release push:** the red condition is exactly that predicate, which
only exists when a merged release PR is stuck; an ordinary push (no `Release-As:`
trailer) merges no release PR and every already-merged one has been flipped
`autorelease: pending`→`autorelease: tagged`, so the query is empty (green path
proven). An OPEN release PR is excluded by `--state merged`; a gh query that cannot
run warns and exits 0 (never cries wolf — that failure has already reddened the
action step above it). SHAPE CHOSEN: **fail the run on the abort predicate** (not
"assert a release PR exists"), because "a merged PR stuck pending" is a direct
read of release-please's own condition and needs no model of "when a release was
expected". SEAM left for `bug-autorelease-label-lifecycle-unowned` (marked comment
in the script): the manual-recovery message + the `release.yml` label flip.

**Negative-case evidence (a gate never seen red is not evidence).**
injected stuck pending PR ⇒ exit 1 (verbatim):

```
release-abort-check: FAIL — release-please is STUCK and this run would otherwise report success.
1 MERGED release PR(s) still carry the 'autorelease: pending' label, which is
release-please's own abort condition (src/manifest.ts: "There are untagged, merged release PRs
outstanding - aborting"). ... #123 chore: release (release-please--branches--main) ...
First suspect is the tag↔config agreement cli/src/release-config-agreement.test.ts pins: ...
exit=1
```

injected empty list ⇒ green: `release-abort-check: OK — ... release-please is not aborting.`
(exit 0). The config gate's `is red when include-component-in-tag is true ...` and
`the negative case against the REAL config bytes: flipping the key goes red` both
fire (18/18 tests in the two new files pass).

**Gates run (expected → observed).**

| Command                         | Expected       | Observed                                                   |
| ------------------------------- | -------------- | ---------------------------------------------------------- |
| `arggon validate`               | ok, 0 warnings | `arggon validate: ok (0 warning(s), convention v5)`        |
| `npm run test`                  | green          | `Test Files 145 passed (145)` / `Tests 3160 passed (3160)` |
| `npm run test:structure`        | ok             | `test result: ok. 5 passed; 0 failed;`                     |
| `npm run lint:structure`        | no findings    | exit 0                                                     |
| `npm run lint`                  | clean          | exit 0                                                     |
| `actionlint release-please.yml` | clean          | exit 0                                                     |
| prettier (touched files)        | conformant     | `All matched files use Prettier code style!`               |

**AC #5 (real release-please run) — verified post-merge, by the delivery lead.** The
merge push to main IS a real `release-please.yml` run (no `Release-As:` trailer ⇒
legitimate no-release push ⇒ must stay green: the backstop finds no stuck PR, and
the healthy steady state keeps it green). I did NOT fabricate a release proposal to
force a red run. `npx release-please --dry-run` was NOT run as evidence here: it is
not offline-runnable in this worktree (release-please is not a local dependency, and
the CLI dry-run queries the GitHub API for releases/tags), so it proves nothing a
unit test does not — the real post-merge run is the evidence, and the delivery lead
surfaces it.

**For the siblings (reported, not filed here):**
`bug-release-needs-auth-self-describing` — the backstop's gh-auth failure path
(warn + exit 0) assumes the runner gh is authenticated by `GITHUB_TOKEN`; a
self-describing auth-failure message belongs to that item.
`bug-autorelease-label-lifecycle-unowned` — owns the `release.yml` label flip and
the manual-recovery text appended after my marked comment.

### handoff 2026-10-12 @ses_ecfafb575ffeLCEQKunZ0o9mM2 (session: ses_ecfafb575ffeLCEQKunZ0o9mM2) — next: Merge PR #740 after review; on merge watch release-please.yml's no-release run — cli/release-abort-check.mjs must print OK (AC#5 real-run evidence, surfaced by delivery lead).
- branch: fix/bug-release-config-workflow-agreement-ungated
- open questions: Observe the real post-merge release-please.yml run stays green (AC#5); confirm release-please flips autorelease pending→tagged on the healthy path before release.yml tags (labels bug-autorelease-labe…

### handoff 2026-10-12 @ses_ecfafb575ffeLCEQKunZ0o9mM2 (session: ses_ecfafb575ffeLCEQKunZ0o9mM2) — next: Merge PR #740 after review; on merge watch release-please.yml's no-release run — cli/release-abort-check.mjs must print OK (AC#5 real-run evidence, surfaced by delivery lead).
- branch: fix/bug-release-config-workflow-agreement-ungated
- open questions: Observe the real post-merge release-please.yml run stays green (AC#5); confirm release-please flips autorelease pending→tagged on the healthy path before release.yml tags (labels bug-autorelease-labe…

### 2026-10-12 @ses_ecfafb575ffeLCEQKunZ0o9mM2
## Evidence — gate + abort backstop (arggon-maker)

PR #740: https://github.com/Arggon/ArggonManager/pull/740 (base main). The one-word config repair (include-component-in-tag: false, b7b5f866) was already on main and was NOT touched; this change adds the two gates that were missing.

### Shipped
- cli/src/release-config-agreement.test.ts — gate. Pure agreementViolation(config, workflow): release.yml must tag the plain v\${VERSION} (spec invariant 1) AND the config's include-component-in-tag must resolve to false (absent ⇒ schema default true ⇒ the outage). Two-sided (absent-key + workflow-side component drift).
- cli/release-abort-check.mjs + step in .github/workflows/release-please.yml (runs on every push, after the action) — abort backstop. Predicate IS release-please's own (src/manifest.ts findMergedReleasePullRequests): a MERGED PR still carrying 'autorelease: pending' ⇒ exit 1 (red); none ⇒ exit 0. SHAPE = fail the run on the abort predicate. Cannot red on a legitimate no-release push: that predicate only exists when a merged release PR is stuck; an ordinary push merges none and every already-merged PR is flipped to 'autorelease: tagged', so the path is green (proven). An open release PR is excluded by --state merged; a gh query failure warns + exits 0 (never cries wolf). Comment seam left for bug-autorelease-label-lifecycle-unowned (manual recovery + release.yml label flip).
- release.md §The tag↔config agreement — the contract for the next author.

### Gates: expected → observed
- arggon validate → 'arggon validate: ok (0 warning(s), convention v5)'
- npm run test → 'Test Files 145 passed (145)' / 'Tests 3160 passed (3160)'
- npm run test:structure → 'test result: ok. 5 passed; 0 failed;'
- npm run lint:structure → no findings (exit 0); npm run lint → exit 0; actionlint release-please.yml → exit 0; prettier (touched files) → conformant.

### Negative case — the backstop seen RED (injected gh returns a merged stuck pending PR), verbatim exit 1:
```
release-abort-check: FAIL — release-please is STUCK and this run would otherwise report success.
1 MERGED release PR(s) still carry the 'autorelease: pending' label, which is
release-please's own abort condition (src/manifest.ts: "There are untagged, merged release PRs
outstanding - aborting"). ... #123 chore: release (release-please--branches--main) ...
First suspect is the tag↔config agreement cli/src/release-config-agreement.test.ts pins ...
```
Green case (injected []) exit 0: 'release-abort-check: OK — ... not aborting.' Config gate flip-to-true / delete-key on the REAL committed config also goes red. Both new suites 18/18.

### AC#5 (real release-please run) — post-merge, delivery lead
The merge push to main is the real release-please.yml run (no Release-As: trailer ⇒ no-release push ⇒ must stay green). Did NOT fabricate a red run. npx release-please --dry-run not used: not offline-runnable here (not a local dep; dry-run hits the GitHub API), so it adds nothing a unit test lacks — the real run is the evidence.

### For siblings (reported, not filed here)
- bug-release-needs-auth-self-describing: the gh-auth failure path (warn+exit 0) assumes the runner gh authed by GITHUB_TOKEN; a self-describing auth message belongs there.
- bug-autorelease-label-lifecycle-unowned: owns the release.yml label flip + the manual-recovery text after the marked comment.
