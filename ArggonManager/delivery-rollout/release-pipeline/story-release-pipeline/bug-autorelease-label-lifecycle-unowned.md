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

### 2026-10-12 @ses_eced77dddffeFhyZiuY6mPchOS
### 2026-10-12 @arggon-maker — implementation evidence (PR #746)

Branch `fix/bug-autorelease-label-lifecycle-unowned`, commit c67b26cc, PR https://github.com/Arggon/ArggonManager/pull/746 (do not merge — completion is the delivery lead's call).

**Shape.** `cli/release-label-flip.mjs` (new; offline tests inject a queued fake `gh` on `GH_BIN`) queries release-please's own abort predicate and flips each merged `autorelease: pending` PR to `autorelease: tagged` with exactly the command the manual recovery documents, then re-runs the predicate as verification. In `release.yml` the step runs in the tagging run, immediately after the tag↔version agreement assert and before the release object/build/publish, under `if: steps.guard.outputs.release == 'true'`; idempotent (no-op when nothing is pending). **Failure policy: warn and exit 0 on every path** — a non-zero exit before the publish would strand a tagged release, and the release-please backstop is the detector (deliberate asymmetry with the backstop's fail-closed gate). **Permission:** `pull-requests: write` only (documented minimal: GitHub's GITHUB_TOKEN permission table says it permits adding a label to a pull request). **Backstop:** the FAIL message carries the manual recovery at the marked seam; predicate/verdicts untouched. **Docs:** `release.md` §The `autorelease` label lifecycle + the `skip-github-release: true` reconciliation; item acceptance box 5 also relies on the landed backstop.

**Gates, expected vs observed.** `npm run test` → 148 files / 3228 tests passed. Focused `npx vitest run cli/release-label-flip.test.ts cli/release-abort-check.test.ts` → 24 passed. `npm run test:structure` → 5 rules passed, 0 failed. `npm run lint:structure` → no findings. `npm run arggon -- validate` → `ok (0 warning(s), convention v5)`. `actionlint .github/workflows/release.yml` → no findings. `npx prettier --check` on the six changed code/config/docs files → clean (the tracker item keeps the tracker's existing byte style, as sibling items do).

**Live (read-only) checks.** `node cli/release-abort-check.mjs --repo Arggon/ArggonManager` → `OK — no merged release PRs still carrying 'autorelease: pending'`; `node cli/release-label-flip.mjs --repo Arggon/ArggonManager` → `OK — nothing to flip` (idempotent no-op on the current state). Class record cited, not re-run: #664 stuck → backstop run 38282448930 RED naming it → manual flip → run 38283343454 `OK` + release PR #744 opened.

### handoff 2026-10-12 @ses_eced77dddffeFhyZiuY6mPchOS (session: ses_eced77dddffeFhyZiuY6mPchOS) — next: Standards review of PR #746 (fix/bug-autorelease-label-lifecycle-unowned, c67b26cc); after merge, watch `release-label-flip` in the next release run (first live exercise).
- branch: fix/bug-autorelease-label-lifecycle-unowned
- open questions: Does `pull-requests: write` alone cover gh `pr edit --add-label` in Actions? (GitHub docs say a PR label add is covered; a 403 only warns and the backstop reddens, so no silent deadlock)

### 2026-10-12 @arggon-standards-reviewer
verdict: approve (PR #746 — release.yml owns the `autorelease` label flip)

Reviewed by reading (read-and-reason role; no gates executed). Read: the item + its three recorded comments, the full 7-file diff, `cli/release-label-flip.mjs`, `cli/release-abort-check.mjs`, both test files, the whole of `.github/workflows/release.yml` (343 lines) and `release-please.yml`, `release.md` §238–305, `test/assert-order.ts`, and `gh pr checks 746`.

**Bar pass (this project's bar: engineering.md §Review bar)**
- **Scope** — exactly the 7 declared files; `release-please.yml` untouched; in `release.yml` only the header comment, `permissions.pull-requests: write` and the new step changed. Publish semantics read byte-identical (filename fixed, lib-first, OIDC-only, already-published = success, propagation poll, tarball attach); no unrelated reformatting.
- **Placement / recorded decision** — step runs under `if: steps.guard.outputs.release == 'true'` (rule-1 release + rule-2 re-run; rule-0 never enters), after the tag + agreement assert, before the release object / build / pack / inspect / publish. Matches the delivery-lead decision (option (a)) and its atomicity argument: the label tracks the tag, not the publish.
- **Flip correctness** — predicate flags byte-identical to the backstop's (`pr list --repo … --state merged --label "autorelease: pending" --limit 200 --json number,title,headRefName`); flip argv byte-identical to the documented manual recovery; the verdict is the re-run predicate, never the edit exit code; empty predicate → exactly one query, no edit.
- **Tests discriminate (read, not run)** — the workflow contract uses this repo's `assertOrder` (required needle presence first, so a rename or a move fails loudly, not vacuous): tag < agreement assert < flip invocation < release object < first publish, plus the guard and the permission grant. Script tests pin the exact flip argv, exit 0 on every failure path, and the recovery text; abort-check green path asserts the recovery is ABSENT, red path pins it byte-identical. The abort-check diff is additions only — no assertion weakened.
- **Backstop seam** — FAIL message extended at the marked seam; predicate, fail-open paths and exit codes untouched (read the whole file: red only when the predicate holds; gh failure still warns + exits 0).
- **Docs travel** — `release.md` carries states, owner-per-transition, same-run rationale, the `skip-github-release: true` reconciliation (agreement / flip / abort surfacing), the stuck-PR recovery = the exact automated command, and the residual window; the #664 → run 38282448930 red → manual flip → run 38283343454 OK + #744 sequence is also corroborated in-tree by the sibling item's verifier comment.
- **Non-functional** — subprocess argv arrays (no shell interpolation), bounded 200-window, no new dependency, no secret logged; `pull-requests: write` is the minimal documented grant (I verified the citation myself: docs.github.com GITHUB_TOKEN table — "permits an action to add a label to a pull request"; App-permissions table lists the label endpoints under Repository permissions for "Pull requests" (write, which includes read); in-repo precedent `release-please.yml` and `auto-done.yml`).
- **CI** — cli (5m43s), tasks-validate, ui-smoke all pass; mergeState CLEAN. Necessary, not sufficient — the reading above is the substance.

**Findings (severity order; none blocking)**
1. **P3 — one guard gap against the file's own "exit 0 on every path" contract.** `cli/release-label-flip.mjs:139–141` (`renderPending`, called at `:248`) dereferences `pr.number` unguarded, while the flip loop refuses a malformed entry (`:190–194`). An array entry of `null` in the verification output would throw a TypeError out of `main()`; node exits non-zero and the step fails **before the publish** — the one outcome the failure policy forbids. Real `gh pr list --json` does not emit nulls, so this is hardening, not a live defect: one `pr?.number` (or a shared guarded render) closes it; otherwise file it as a follow-up under this story. Not worth holding the merge for.
2. **P3 — permission-comment precision.** `release.yml:63–70` (mirrored in the test) cites the REST label endpoints, but gh v2 `pr edit --add-label/--remove-label` writes through the GraphQL `addLabelsToLabelable`/`removeLabelsFromLabelable` mutations on the PR node id, and `gh pr edit`'s finder query unconditionally reads `projectCards` (cli/cli#5307, #8784 — the known fine-grained-token failure mode on private repos). The permission class cited is the right one either way and this repo is public (`gh repo view` → PUBLIC), so the residual is exactly the 403-class risk the maker bounded honestly: warn + verification warning + next-push backstop red. Optional tightening; watch the first live run.
3. **Observation — release-push transient (not this change's defect).** The release merge push triggers `release.yml` and `release-please.yml` concurrently, so the backstop can evaluate the predicate before the flip lands and redden once per release; at that instant the predicate is genuinely true (release-please does abort that run, and the next release PR is proposed on the following push). Pre-change that red persisted until a hand-flip, so this change strictly shrinks the window. If a tolerance rule for the release push is wanted, it is its own item — not a change to #746.

**Recommendation: merge.** The bar is satisfied; findings 1–2 are hardening/doc precision and belong as follow-ups per AGENTS.md, not as blockers. The half of acceptance box 2 that cannot exist before merge (first live flip in a real release run, then release-please green + next PR) is already recorded as this item's post-merge watch — keep it as the completion condition.

**Probes requested (confirmatory; routed to the verifier — they do not change the verdict):**
1. `cd /home/arggon/Projects/ArggonManager-bug-autorelease-label-lifecycle-unowned && npx vitest run cli/release-label-flip.test.ts cli/release-abort-check.test.ts` — expected 24 passed (the maker's claim, at this HEAD). If it is not green, the approve is void.
2. Malformed-verification entry probe against a temp fake `gh` (`GH_BIN`): call 1 → one pending PR, call 2 → edit ok, call 3 → `[null]`; `node cli/release-label-flip.mjs --repo X/Y; echo "exit=$?"`. Per the file's stated contract: exit 0 with a warning; per my reading: exit 1 + TypeError. Confirms or withdraws finding 1 (it stays non-blocking either way).
3. Live read-only no-op (only if `gh pr list --repo Arggon/ArggonManager --state merged --label "autorelease: pending" --limit 200 --json number` returns `[]`, so nothing can be mutated): `node cli/release-label-flip.mjs --repo Arggon/ArggonManager` → expected `OK — nothing to flip`, exit 0.

### 2026-10-12 @arggon-maker — post-review P3 fixes (review verdict: approve)

Both P3 findings fixed pre-merge; failure policy, backstop tests, step placement and publish semantics untouched.

1. **Guard.** `renderPending` now dereferences defensively (`pr?.number ?? "?"` / `pr?.title ?? "(untitled)"`), so a malformed verification payload can no longer throw out of `main()` and exit non-zero before the publish. New test: **"a malformed verification payload ([null]) warns and still exits 0 — the contract is absolute"** — fake `gh` call 3 returns `[null]`; pins exit 0, the `still 'autorelease: pending' on 1 merged release PR(s)` warning, the `#? (untitled)` placeholder rendering and the manual-recovery line. Finding 1 confirmed as real: the old renderer reproduced standalone throws `TypeError: Cannot read properties of null (reading 'number')` (node exits non-zero), exactly the outcome the exit-0 contract forbids.
2. **Citation.** The `permissions` comment (plus the mirror comment in the workflow-contract test and the Permission paragraph above) now states the real mechanism: labels are applied with the GraphQL `addLabelsToLabelable`/`removeLabelsFromLabelable` mutations, not the REST `/issues/{n}/labels` endpoints; the finder's classic-projects read needed a repository-projects grant only in older gh — cli/cli#8784 (the `projectCards` failure mode) — fixed for non-enterprise hosts by cli/cli#10714 (closed May 2025) and cli/cli#13280 (closed April 2026), and this repo is github.com and public. `pull-requests: write` stays the documented minimal grant (GITHUB_TOKEN permission table). cli/cli#5307 does not resolve (404) and is deliberately not cited; #10714/#13280 are the verified fixes.

Gates re-run on the fixed tree, expected vs observed: `npx vitest run cli/release-label-flip.test.ts cli/release-abort-check.test.ts` → 25 passed; `npm run test` → 148 files / 3229 tests passed; `npm run test:structure` → 5 passed, 0 failed; `npm run lint:structure` → exit 0, no findings; `npm run arggon -- validate` → `ok (0 warning(s), convention v5)`; `actionlint .github/workflows/release.yml` → no findings; `npx prettier --check` on the changed code/config/docs files → clean. Push: same branch, awaiting re-review.
