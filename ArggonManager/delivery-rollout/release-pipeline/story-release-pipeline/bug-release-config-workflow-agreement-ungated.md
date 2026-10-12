---
type: bug
status: done
id: bug-release-config-workflow-agreement-ungated
title: "Nothing gates the release-please config against the tags `release.yml` actually creates — a one-word omission (`include-component-in-tag`) silently killed releases for five days, and every aborted run reported `success`"
assignee: arggon-delivery-lead
branch: fix/bug-release-config-workflow-agreement-ungated
parent: story-release-pipeline
labels: [ci, release, gate-fidelity]
created: "2026-10-07"
updated: "2026-10-12"
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

### 2026-10-12 @ses_ecf022155ffeeGNMnHJeNTMYfl
verdict: request-changes (scope: the shipped live-state claim and merge/verification plan; no code change requested)

**Blocking finding — the evidence bundle's live-state claim is false, and the merge plan built on it will be misread.** The item Notes, the PR body and the handoff all say the merge push "must stay green" because the backstop "finds no stuck PR" / "every already-merged one has had its label flipped". Observed just now (read-only, 2026-10-12):

```
$ gh pr list --repo Arggon/ArggonManager --state merged --label "autorelease: pending" --limit 200 --json number,title,mergedAt
[{"number":664,"title":"chore: release main","mergedAt":"2026-10-09T15:14:36Z"}]
```

and the two latest release-please.yml runs (38266214060, 38266190932) each log `⚠ There are untagged, merged release PRs outstanding - aborting` while concluding `success`. The recurrence is live: #664 merged 2026-10-09 and its label was never flipped. release-please cannot flip it here — config `skip-github-release: true` makes `BaseStrategy.buildRelease` return before any candidate release exists (release-please v17.3.0 `strategies/base.js:354`; v17.3.0 is what the pinned action resolves), so `createReleasesForPullRequest`'s `removeIssueLabels(pending)/addIssueLabels(tagged)` (`manifest.ts:1294–1315`) never runs. `release.yml` has no flip yet either. Verified in the bundled source, not inferred.

Consequence: **on the merge push the backstop will exit 1 naming #664 — the first real run is a true RED, not OK** (unless #664 is flipped first). That red is the change working: it catches a live silent abort that has been green since 10-09. But as shipped the item tells the delivery lead to expect OK and treats "no stuck PR" as fact, so the record would misread the gate at exactly the moment it first fires.

Recommended sequence (real evidence both directions): merge → observe the run fail naming #664 (a real negative case, stronger than the injected fixture) → flip the label (`gh pr edit 664 --add-label "autorelease: tagged" --remove-label "autorelease: pending"` — the same manual recovery used for #556) → the next push prints OK and release-please opens the next release PR (AC#5's other branch). Flipping #664 before merge also works, but then the red exists only in the fixture.

Same claim in `release.md` §The tag↔config agreement: "…every already-merged one has had its label flipped to `autorelease: tagged`, so the check is green" states the post-sibling steady state as current fact. Scope it to the landed flip (`bug-autorelease-label-lifecycle-unowned`) or name the pending window; otherwise it misleads the next author reading it while the state is red.

What must change: replace the false green expectation in the item Notes / PR body / handoff with the observed pair above, and scope the release.md sentence. No code change requested — the artifact is otherwise approvable.

**On the six concerns (all read-only):**

1. **Abort predicate fidelity — matches release-please's own, no false negative found.** `findMergedReleasePullRequests` → `pullRequestIterator(targetBranch, 'MERGED', 200, false)` (manifest.ts:1140–1147): first 200 merged PRs on `main`, updated-desc, filtered by `hasAllLabels(['autorelease: pending'])` (DEFAULT_LABELS, manifest.ts:287–288); `createPullRequests` aborts on any hit (manifest.ts:926–934). The gh query is a faithful superset in the safe direction: a label filter switches `gh pr list` to its search backend (labels force the search path — verified live, the query returned only the merged #664), so it is not confined to a recent 200-PR window, spans all bases (single-branch repo), and does not require a parseable release-PR body. Divergences only widen the red. `--limit 200` is defensible: release-please's own cap is exactly 200, gh's search cap is 1000. Only realistic false-negative is search-index lag, bounded by the red condition being a persistent state — the next run still catches it. No false-positive path found: an open/normal PR cannot leak in (`--state merged`; no workflow other than this branch applies the label).
2. **Fail-open on gh failure — keep it.** The action step above shares token/API and runs first, so the shared-failure-domain argument holds; and because the predicate is a persistent state, warn+exit-0 can at most delay detection to the next push, never lose it. One tension worth recording: engineering.md's paired-deletion-guard precedent fails on "could not look" — but here fail-closed would manufacture reds on healthy pushes, which is the crying-wolf defect this item kills. Non-blocking improvement: emit `::warning::` so the warning surfaces as an Actions annotation instead of only in the step log.
3. **Placement/conditions — confirmed, cannot skip when needed.** release-please.yml:40–61, after the action (32) and checkout (38), before the lockfile sync, no `if:`, on every push. The only way it does not run is an earlier step failing — job already red. Green path proven offline (injected empty gh); red path exits 1 at script lines 117–143 (read).
4. **Config gate — two-sided and genuinely exercised.** `agreementViolation` reddens on config `true`, on the key absent ("absent (schema default: true)"), on workflow tag drift to a component prefix, on no `git tag -a` line, and on the real committed bytes with the key flipped or deleted. `workflowTagRef` reads release.yml:101 `git tag -a "v\${VERSION}"`; committed config line 5 is `include-component-in-tag: false`; six of the nine tests fail if the predicate is vacuous.
5. **Docs vs predicate/spec — consistent** modulo the scoping fix above; release.md states the same predicate the gate enforces and cites spec invariant 1 (`vX.Y.Z` names the exact published commit).
6. **Scope — exact.** Diff stat = the 5 claimed files + the two item bodies; `release.yml` untouched; b7b5f866 already on `origin/main` and untouched; the sibling-item edit is the delivery lead's recorded decision only (no half-built flip code); `cli/*.mjs` + `cli/*.test.ts` matches the release-guard / paired-deletion-guard / inspect-tarballs precedent.

**Residual (non-blocking, for the sibling):** post-sibling, on a release-merge push `release.yml` (flip) and `release-please.yml` (check) run concurrently — if the check beats the flip it reds once and clears on the next push. The recorded decision already puts the flip right after the tag↔agreement step, which should normally win; worth stating so the first such red is not read as a defect.

**Verified by me:** everything above by reading the diff/workflow/script/tests/release-please v17.3.0 source+schema, plus read-only live queries (`gh pr list`, `gh pr view 664`, `gh run view --log`). **Not verified:** the maker's gate table (both suites, `npm run test`/`test:structure`/`lint:structure`, actionlint) — verifier to confirm in this worktree.

## Probes needed
- `node cli/release-abort-check.mjs --repo Arggon/ArggonManager` — cwd `/home/arggon/Projects/ArggonManager-bug-release-config-workflow-agreement-ungated`. Expected: exit 1 with a message naming #664. This demonstrates the predicate catches the live stuck release PR (the maker's bundle has only injected-gh evidence). If it prints OK/exit 0, the top finding softens and the merge-run expectation flips.
- `gh pr list --repo Arggon/ArggonManager --state merged --label "autorelease: pending" --limit 200` — immediately before merge. Expected: #664. If empty (flip landed), the merge run should be green and AC#5 reads as "opens the release PR".

### 2026-10-12 @ses_ed6d54e92ffe2VO1GeR34DQEEy
### 2026-10-12 @arggon-delivery-lead
verdict: approve (lead merge call) — the standards review's request-changes was against the pre-merge verification CLAIM, not the artifact, and is resolved by the live observation sequence below

- Standards review verdict: `request-changes`, scoped to the item's AC#5 wording ("the merge run must stay green"): the real state has merged release PR #664 stuck on `autorelease: pending` since 2026-10-09 and the last two release-please runs aborting behind green — so the merge run is expected to be a TRUE RED naming #664, which is the gate's designed "fail loudly" branch, not a failure of the change. Every artifact bar item passed (predicate fidelity to release-please's own condition; fail-open argument; step placement; two-sided config gate with real negative cases; docs; scope; sibling seam left).
- Verifier execution evidence (this wave, worktree): live predicate `node cli/release-abort-check.mjs --repo Arggon/ArggonManager` → exit 1 naming #664 (verbatim); `gh pr list --state merged --label "autorelease: pending"` → exactly #664; new suites 18/18; full `npm run test` 145 files / 3160 tests pass; `test:structure` + `lint:structure` green.
- Resolution I am executing now: merge → observe the real release-please.yml run on the merge push go RED naming #664 (that observation IS AC#5's "fail loudly" evidence against live state) → flip #664 to `autorelease: tagged` (the documented manual recovery; `bug-autorelease-label-lifecycle-unowned` automates this flip next) → observe the following run green. The observed evidence lands as a follow-up comment on this item.
- Merging now; auto-done flips this item on merge.
