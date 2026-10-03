---
type: bug
status: todo
id: bug-seam-drift-gate-blocks-new-generated-seam-content
title: "`tasks-validate` drift gate installs the PINNED released arggon and diffs the committed seam, so any PR adding new generated seam content (e.g. the ZCode goal-mode template) fails until a release + ARGGON_VERSION re-pin"
parent: tooling-and-environment
labels: [ci, release]
created: "2026-10-03"
updated: "2026-10-03"
---
<!--
  Placement (v0): ArggonManager/arggon-manager/cli/tooling-and-environment/bug-seam-drift-gate-blocks-new-generated-seam-content.md
  Leaves live only under a story. id is the filename stem: bug-seam-drift-gate-blocks-new-generated-seam-content.
  CLI `arggon create bug seam-drift-gate-blocks-new-generated-seam-content` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# `tasks-validate` drift gate installs the PINNED released arggon and diffs the committed seam, so any PR adding new generated seam content (e.g. the ZCode goal-mode template) fails until a release + ARGGON_VERSION re-pin

## Context

`tasks-validate` bootstrapped the tree with the **pinned released** bin
(`arggon init --no-commit`) and then required a clean `git status --porcelain`.
The comparison therefore answered "do the committed seam bytes match what
`ARGGON_VERSION` generates?" — correct for an adopter, structurally wrong for the
seam's own repo, where a feature PR legitimately **adds or edits generated
content**. Then the seam POSTDATES the pin: the pinned init rewrites the
committed bytes back (the state file still records them as "untouched since last
generation", so `init` regenerates rather than protects them), the diff goes
dirty, and the gate fails naming a seam that does not predate anything — with a
remedy (`run 'arggon init'`) that cannot work, since the pinned init is the very
thing deleting the new content. Reproduced verbatim on PR #605 and, in this
branch's evidence comment, against the shipped step bodies.

Mechanism in one line: `init` regenerates a destination whose recorded
`x-generated` checksum matches disk, so a seam that postdates the pin is exactly
the case the pinned generator overwrites.

The fix makes the gate **direction-aware** instead of release-gated: it compares
against the generator that owns the seam (the checkout's own build when the
checkout IS the seam's source, the pinned release for every adopter and fork) and
keeps the release protection as an explicit **pinned-lag assertion** — no
committed `arggonVersion` stamp may be NEWER than `ARGGON_VERSION`, because that
is the state in which the pinned install rewrites committed content (#527).

## Acceptance

- [x] A feature PR that legitimately changes generated seam content can go green: the gate compares against the BRANCH's own templates (init from the checkout), or exempts newly added destinations, or compares only files that existed at the pinned ref — **done, first option**: the drift gate bootstraps and regenerates with this checkout's own build (`npm ci --ignore-scripts` → `npm run build` → `node dist/cli.js init`) when the checkout is the seam's source; adopters keep the pinned path.
- [x] The message is directionally honest (it currently blames a seam that POSTDATES the ref) and prescribes a remedy that can work — each verdict now names the generator that disagrees plus the remedy for that direction, and the lagging-pin case reports the lag with the only working remedy (bump the pin) while naming "re-running the pinned init" as *not* the fix.
- [x] One coherent release story covering this AND the version guard that refused #600 — one root cause, one decision — `release.md` §One release story: two axes (shipped package identity = `cli/version-guard.mjs`, needs a release; repo-owned seam bytes = the drift gate, does not), the decision, and the price paid.
- [x] Decide and record: 'cut a release first' (an explicit, documented cost on every seam-touching PR) vs 'make the gate branch-aware' (no cost, weaker drift detection) — **branch-aware**, recorded in `release.md` §One release story, `ArggonManager/docs/ci.md` §Which generator the gate compares against and as an ADR 0018 amendment, with the weakening stated in the open: in this repo `tasks-validate` no longer proves the PINNED release reproduces the seam.
- [x] `templates/docs/github/workflows/arggon.yml` stays byte-consistent with the committed workflow — the gate exempts itself deliberately; do not break that exemption while fixing this — the two files differ only in the two action SHA pins (the repo copy is generated from the template, never hand-divided); the self-exemption and the `.convention.yml` `generatedAt` exclusion are kept and asserted, and the fresh-clone no-op (`git grep -q "arggon:generated"`) is unchanged.

Extra, not in the original list (found while proving the fix):

- [x] Both directions are provable: hermetic two-direction coverage in `cli/src/headless-ci.test.ts` plus a real probe (real build, real templates, the shipped step bodies) documented in `ArggonManager/docs/ci.md` §Reproduce the drift gate both ways.
- [x] A missing `dist/cli.js` is a hard error, never a silent fall-back to the pinned release (that fall-back *is* the bug).

### Round 2 — review `request-changes` (design accepted, no redesign)

- [x] `cli` red on `628a4332` handled as the known artifact-drift flake, not chased: `gh run rerun 37090935003 --failed` → run 37090935003 **attempt 2** `cli` = **success** (ui-smoke was already success). No code change for it.
- [x] `ArggonManager/docs/ci.md` compensation brought down to words the code supports: the pinned-lag assertion is named a **version-skew proxy, not byte-equality**, its blindness in exactly the case this item unblocks is named (a feature PR that moves templates and regenerates with **no version bump** leaves every stamp at the pin), and the false "neither copy can rot silently" claim is gone — `pinLagsSeam()`'s extra `pin !== pkgVersion` conjunct is documented as known skew (`bug-ci-seam-pin-shell-vs-test-copy-divergence`). The section now states the same ceiling `release.md` §One release story does ("the price paid is one weaker claim").
- [x] `cli/src/ci-seam-pin.test.ts`'s header corrected to the gate CI actually runs (literal pin + the workflow's pinned-lag assertion; the byte comparison is branch-local here, pinned only for adopters), with a pointer to the two-copy skew item.
- [x] The two-copy invariant is now machine-checked: `cli/src/headless-ci.test.ts` has a `workflow parity: template vs the copy CI runs` block — byte comparison of the two workflow files modulo `uses:` action refs, plus the branch-aware generator predicate, the pinned-release fallback and the lag-before-diff ordering asserted in **both steps of both copies**. Verified discriminating: neutering the lag line or the predicate in the committed copy turns it red, naming the file and the step. The rule of record is stated in `ArggonManager/docs/ci.md` §Where the rule of record lives: the TEMPLATE is the rule; the committed copy is what CI runs and is held to it.

## Notes

### 2026-10-03 @ses_f02ab5836ffeOAxmisboIwWE4x
Found by the coordinator on PR #605 (task-zcode-goal-mode), 2026-10-03 — CI evidence, not theory.

The `tasks-validate` job installs the **pinned RELEASED** package globally:

```
npm install -g "arggon-manager@$ARGGON_VERSION"   # 0.5.0
arggon init --no-commit
git status --porcelain ...   # any dirty generated file => "the committed arggon seam predates the pinned ref"
```

So the gate answers "does the committed seam match what the RELEASED version generates?" — the right question for drift, and structurally the wrong question for a PR that ADDS seam content. #605 adds two generated files (the ZCode `templates/goal-mode.md` and `commands/arggon-goal.md`) plus the two JSON descriptions naming them. The committed seam is now AHEAD of 0.5.0, the pinned init strips them, and the job fails:

```
the committed arggon seam predates the pinned ref — run 'arggon init' and commit:
 M .zcode-marketplace/arggon/.zcode-plugin/plugin.json
 M .zcode-marketplace/marketplace.json
```

The message is inverted for this case — the seam does not PREDATE the ref, it POSTDATES it — and the prescribed remedy cannot work, because the pinned 0.5.0 init is the very thing deleting the new files.

Same catch-22 as the released-version guard that refused #600's `adapters/` `files` change (0.5.0 already tagged). Third symptom of one root cause: **the release/pin cycle has no path for a feature PR that legitimately changes generated content.** `task-ci-seam-pin-tracks-release` is `done` and covers pin TRACKING, not this.

Repro: on any branch adding or editing a generated seam file (`.opencode/**`, `.zcode-marketplace/**`, `.mcp.json`, generated docs), push and read `tasks-validate`.

Acceptance:
- [ ] A feature PR that legitimately changes generated seam content can go green: the gate compares against the BRANCH's own templates (init from the checkout), or exempts newly added destinations, or compares only files that existed at the pinned ref
- [ ] The message is directionally honest (it currently blames a seam that POSTDATES the ref) and prescribes a remedy that can work
- [ ] One coherent release story covering this AND the version guard that refused #600 — one root cause, one decision
- [ ] Decide and record: 'cut a release first' (an explicit, documented cost on every seam-touching PR) vs 'make the gate branch-aware' (no cost, weaker drift detection)
- [ ] `templates/docs/github/workflows/arggon.yml` stays byte-consistent with the committed workflow — the gate exempts itself deliberately; do not break that exemption while fixing this


### 2026-10-03 @Arggon
## Evidence — both directions, real build, shipped step bodies (PR #607)

`tasks-validate` on the PR head `220bfa6b`: **pass (36 s)** — the branch-local
path (build + own `init`) runs and is green on this PR's own seam change.

The probe below extracts the `run:` bodies from the workflow with the same parser
the fixture uses and runs them verbatim (`bash -e`) in a throwaway clone, with
`ARGGON_VERSION=0.5.0` and the released `0.5.0` bin on PATH as the pinned
generator. Reproduce per `ArggonManager/docs/ci.md` §Reproduce the drift gate both ways.

    A. NEW gate, seam current for its own generator  => expect exit=0
    --- drift
    --- exit=0 | dirty: M ArggonManager/.convention.yml   (state file only: the documented exclusion)

    B. STALE seam (template moved, seam not regenerated)  => expect exit=1
    the committed arggon seam does not match what this checkout's own build (node dist/cli.js) generates
    — regenerate it with 'npm ci && npm run build && node dist/cli.js init' and commit, or drop the
    template change that moved it:
     M .mcp.json
     M templates/docs/mcp-json
    --- exit=1

    C. SEAM NEWER THAN THE PIN (#605 shape), committed
    --- NEW drift (branch-local)  --- exit=0   <-- the fix: a feature PR goes green
    --- OLD bootstrap (pinned init, main's body)   -> rewrites the committed bytes
    --- OLD drift (main's body)
    the committed arggon seam predates the pinned ref — run 'arggon init' and commit:
     M .mcp.json
    --- exit=1                          <-- the reported failure, same commit, old gate

    D. PIN LAGS THE SEAM (committed stamp 0.9.9 > ARGGON_VERSION)  => expect exit=1
    ARGGON_VERSION (0.5.0) lags the committed arggon seam (0.9.9):
    the pinned init would REWRITE committed content — bump ARGGON_VERSION to 0.9.9
    once that version is released (release.md, 'The re-pin'). Re-running the pinned
    init is not the fix: it is what deletes the newer content.
    --- exit=1

    E. missing build (dist/cli.js removed)  => expect exit=1, no silent fall-back
    dist/cli.js is missing: run 'npm ci && npm run build' (the bootstrap step does this)
    --- exit=1

    F. the runner's own file stays exempt: edited `.github/workflows/arggon.yml`
       (plus the state file's generatedAt churn) => exit=0

Case C is the whole bug: same commit, old gate red with the inverted message, new
gate green.

Hermetic coverage (no network, no build): `cli/src/headless-ci.test.ts`
- a seam that postdates the pin: GREEN on the branch-local path, RED on the pinned
  path with `arggon-manager@<pin>` and the re-run remedy in the message;
- a moved template and a hand-edited generated file: RED with the branch generator
  named (the stub generator implements `init`'s checksum rule — regenerate when the
  recorded checksum matches disk, keep otherwise — so the red is faithful, not
  manufactured);
- a committed stamp newer than `ARGGON_VERSION`: RED with the bump remedy and
  explicitly without "re-run init"; the assertion reads the COMMITTED state, so it
  fires for the commit, not just for a dirty tree;
- missing `dist/cli.js`: RED; both step bodies must carry the same generator
  predicate and the lag assertion must precede the diff (asserted as text).

Gates on `220bfa6b` (rebased onto `origin/main` f382ff10): `npm run build`,
`npm test` (2234 passed / 121 files), `npm run lint`,
`npm run arggon -- validate`, `npm run check:plugin`.

## Reported, not fixed (out of this item's scope)

`.opencode/agents/arggon-prover.md` is committed but has **no `x-generated`
entry** (added by d0aba5ef / PR #583, after v0.5.0), so `init` classifies it as
"adopter-modified — on disk with no provenance state" and skips it: the drift gate
cannot see it drift, and it is invisible to the pinned gate too (0.5.0 has no such
dest). Evidence: with the pinned init it is clean, with this branch's build
`init --dry-run` reports `modified-skip .opencode/agents/arggon-prover.md`, and
`grep -c arggon-prover ArggonManager/.convention.yml` = 0. This is a pre-existing
blind spot (a generated dest committed without provenance), not something this
change introduced or widens — a seam regeneration on the next release would record
the entry and close it. Worth its own item; I did not grow this diff.

Also for the coordinator: three stash entries are sitting in the shared repo
(`stash@{0}` "headless-ci describePacked sequential fix … found dirty in primary",
`stash@{1}` "seam-pin worker diagnostics … made in primary", `stash@{2}` "wip-item3")
— none are mine; their own notes say the owning session should pop them into the
right branch.

### handoff 2026-10-03 @Arggon — next: Review PR #607 (tasks-validate pass 36s on 220bfa6b); merge when cli+ui-smoke are green, then flip this item done
- branch: fix/bug-seam-drift-gate-blocks-new-generated-seam-content
- open questions: Accept the recorded weakening? (repo CI no longer proves the PINNED release reproduces the seam); file a follow-up for the unprovenanced .opencode/agents/arggon-prover.md dest?

### 2026-10-03 @Arggon
## Round 2 — review asks closed (PR #607)

**1. The red `cli` lane was the known artifact-drift flake, not this diff.**
`gh run rerun 37090935003 --failed` → **run 37090935003, attempt 2: `cli` = success**
(ui-smoke was already `success` on attempt 1). Same head `628a4332`, no code change
for it — matching the coordinator's reproduction on `f382ff10` and the green
`220bfa6b`. New head `03b15492` runs the lane again from scratch (below).

**2. `ArggonManager/docs/ci.md` no longer overstates the compensation.** The
"Two assertions keep the release protection" framing is gone. The section now
says what the code does:

- the pinned-lag assertion is a **version-skew proxy, not byte-equality**, and is
  **blind in exactly the case this item unblocks** — a feature PR that moves
  templates and regenerates the seam with **no version bump** leaves every stamp
  at the pin, so the seam has postdated the release while the stamps say nothing,
  and nothing in `tasks-validate` detects that on a branch;
- `validate`/`doctor`/`list` through the pinned bin are a **read gate, not a seam
  gate**;
- the false "neither copy can rot silently" claim is removed and replaced with the
  fact: `pinLagsSeam()` carries a `pin !== pkgVersion` conjunct the shell copy
  lacks (that conjunct is what keeps the release window green in the test), filed
  as `bug-ci-seam-pin-shell-vs-test-copy-divergence` rather than papered over.

The ceiling is now the same sentence `release.md` §One release story already uses
("the price paid is one weaker claim"), with a new **§Where the rule of record
lives**: the workflow TEMPLATE is the rule (it is what adopters vendor), the
committed copy is what CI runs and is held to it by the new parity test; the TS
predicate is the repo-side guard in the `cli` job; only the shell copy decides
`tasks-validate`.

**3. `cli/src/ci-seam-pin.test.ts`'s header now describes the gate that runs
here** (comment-only): the pin's two uses (registry install + the workflow's
pinned-lag assertion), the branch-local byte comparison, and a note that the
"opposite drift" line no longer applies to the pin — the pin ahead of the stamps
is the documented template-less-patch case, and byte drift belongs to the
branch-local path.

**4. The two-copy invariant is machine-checked** — `cli/src/headless-ci.test.ts`,
new top-level `describe("workflow parity: template vs the copy CI runs")`:

- byte comparison of the two workflow files with `uses:` action refs collapsed to
  a placeholder (the only documented difference: the template floats on `@v4`,
  this repo SHA-pins them);
- the branch-aware generator predicate, the pinned-release fallback and the
  lag-before-diff ordering asserted in **both steps of both copies**, so a
  regression names the file and the step instead of printing two workflows.

Discrimination proven by mutation, not assumed: neutering the lag line in the
committed copy → `× carries one rule` red with the divergence message; changing
the predicate in the committed **bootstrap step only** → **both** parity tests red,
one of them naming `step 'Bootstrap the tracker …' lost the branch-local
generator`. Workflow restored after each.

**Push mechanics (no force-push).** The branch was already published at
`628a4332`, so the rebase could not fast-forward:

    ! [rejected] fix/bug-seam-drift-gate-... -> fix/bug-seam-drift-gate-... (non-fast-forward)
    hint: Updates were rejected because the tip of your current branch is behind its remote counterpart.

I did not force-push. Published history was restored (`git reset --hard
origin/<branch>`, back to `628a4332`) and the two round-2 commits were
re-applied by cherry-pick onto it — verified byte-identical to the rebased tree
for every file this item touches — then `origin/main` was integrated with a
**merge commit** instead of a rebase, so the push is a plain fast-forward
(`628a4332..03b15492`) and nothing published was rewritten. The linear rebase is
preserved at `backup/bug-seam-drift-gate-blocks-new-generated-seam-content-round2`
(b222fe92) if you prefer it; that would need
`git push --force-with-lease origin backup/…-round2:fix/bug-seam-drift-gate-blocks-new-generated-seam-content`,
which I am not authorized to run. Flagging the deviation from the literal
"rebase onto origin/main" wording so it is your call, not a silent substitution —
the precedent (`task-adapter-selection-flags`) recommended a merge commit for the
same situation.

Gates on `03b15492` (origin/main 455d6cc4 merged): `npm run build`,
`npm test` (2278 passed / 122 files), `npm run lint`,
`npm run arggon -- validate`, `npm run check:plugin`.

### handoff 2026-10-03 @Arggon — next: Merge PR #607 (round-2 fixes pushed as fast-forward 03b15492; decide rebase-vs-merge per the comment), then flip this item done
- branch: fix/bug-seam-drift-gate-blocks-new-generated-seam-content
- open questions: Linear rebase instead of the merge commit (needs force-with-lease, unauthorized)? Accept the recorded weaker claim (version-skew proxy, blind on unbumped feature PRs)?

### 2026-10-03 @ses_f00552974ffegoUU0yQr6H7y1u

### 2026-10-03 @Reviewer (codex, reviewing PR #607)
verdict: request-changes (head red on a pre-existing flake + the durable record overstates the compensation)

**No redesign asked for.** The branch-aware trade itself is accepted: I verified the adopter-facing
protection is untouched, the drift that matters day-to-day (committed seam vs. the repo's own
templates) is preserved, and the gate now fails closed instead of silently answering the wrong
question. The three asks below are a green head and ~15 lines of record/test. This PR should not
re-open the design.

#### Blocking

1. **The PR head is red.** `gh pr checks 607` on `628a4332`: `tasks-validate` pass (28 s),
   `ui-smoke` pass, **`cli` FAIL** (run 37090935003, job 111110931552,
   `SpawnHarnessError … does not provide an export named 'runSync'` from `lib/dist/operations.js`).
   Failure class is the known artifact-drift flake (`bug-cli-spawn-suites-exit-1-flake`): another
   suite lane rebuilt `lib/dist` in place mid-spawn. **It is not caused by this diff** — main
   reproduces the identical class on `f382ff10` (run 37090397049, `does not provide an export named
   'trackerNonItemDirs'`), and the earlier push `220bfa6b` was fully green. Green CI is necessary,
   so: re-run `cli` to green (or push) before merge. No code change needed for this one.

2. **`docs/ci.md` overstates what compensates for the weakening — the durable record of this trade
   must be exact.** Two sentences are wrong as written:
   - "Two assertions keep the release protection" — the pinned-lag assertion is a **version-skew
     proxy, not a byte-equality proof**. It fires only when a committed `arggonVersion` stamp is
     newer than the pin. In this repo a feature PR changes templates and regenerates the seam
     *without* a version bump (release.md step 2: release-please touches five files, none of them the
     seam), so the stamps stay at the pin and the assertion is silent — in exactly the case this
     item exists to unblock. State the residual class plainly: *committed seam == branch templates
     AND != pinned-release templates, with pin == stamps, is unenforced.*
   - "This repo pins the same rule as a test (`cli/src/ci-seam-pin.test.ts`), so neither copy can
     rot silently" — they are **not the same rule**. `pinLagsSeam()` (ci-seam-pin.test.ts:96-99) is
     `pin !== pkgVersion && compareVersions(pin, newest) < 0`; the shell copy has no
     `pin !== pkgVersion` conjunct, reads a different state-path candidate list, and the TS guard
     only ever reads `.github/workflows/arggon.yml` + `ArggonManager/.convention.yml`. Two
     independent copies; neither polices the other's text.
   The first paragraph ("no longer proves that the _pinned release_ reproduces the committed seam")
   and release.md's "the price paid is one weaker claim, stated plainly" are honest — keep them, and
   let the compensation paragraph match them.

3. **`cli/src/ci-seam-pin.test.ts` now describes a gate that no longer exists for this repo**
   (comment-only, but it is the record of the pin's rule): lines 5-6 ("the drift gate compare the
   committed seam against that release") and 43-44 ("the opposite drift — the pin moved without
   regenerating the seam — stays policed by the workflow's own drift gate at CI time"). Both still
   hold for adopters and false for the seam's own repo, whose generator is now the branch build.

4. **Nothing machine-checks the invariant this fix rests on: the two workflow copies.**
   `headless-ci.test.ts` parses `templates/docs/github/workflows/arggon.yml` (line 163,
   `steps = workflowRunSteps(readFileSync(WORKFLOW_TEMPLATE, …))`) — the file CI never runs — while
   CI runs `.github/workflows/arggon.yml`. Today they differ only in the two `uses:` pin lines
   (I diffed both copies at the head: that is the whole delta), but a future one-sided edit would put
   untested shell in the executed copy and leave the tested copy green — the exact
   "green because the other copy was tested" hole. Acceptance #5 was verified by hand only. Add the
   ~10-line parity assertion (normalize the two `uses:` lines, compare the rest) next to the
   existing predicate assertion; it also machine-checks the shared predicate instead of asserting it
   as text in one copy.

#### Verified by reading (no rework implied)

- **The predicate cannot misfire toward green.** Both steps carry the byte-identical condition
  (`.github/workflows/arggon.yml:64` and `:118`), no env hand-off (so no drift between steps), and
  the misclassification direction is fail-closed: a repo wrongly read as an adopter gets the pinned
  init and a direction-honest red, never a silent pass. Real CI confirms the predicate is TRUE for
  this repo — job 111110931337 log shows `added 158 packages`, `> arggon-manager@0.5.0 build`,
  `postbuild → build:plugin`, then the drift step's `node dist/cli.js init` printing
  `regenerated untouched docs: 36 file(s)`. `dist/` is gitignored, so the build cannot dirty the
  diff.
- **Shell is safe under the runner's shell.** The log confirms `shell: /usr/bin/bash -e {0}` — no
  `pipefail`, so the `git show | grep | grep | sort -V | tail -1` substitution exits 0 on a state
  file with no stamps and the `-n "$newest"` guard skips cleanly. `git grep` only sees tracked
  files, so a fresh clone's untracked init output still no-ops green. The two-candidate state-path
  loop cannot crash on the second miss (`git cat-file -e … 2>/dev/null` inside `if`).
- **The exclusions survived, all four.** Self-exemption `:(exclude).github/workflows/arggon.yml`
  with its reason in-body; `.convention.yml` `generatedAt` exclusion; the `git grep
  "arggon:generated"` activation key; fresh-clone no-op. Template edits are covered by the
  destination exclusion — `templates/docs/github/workflows/arggon.yml` is a source, never a
  destination (`cli/src/docs.ts:305` maps `github/workflows/arggon.yml` → `.github/workflows/arggon.yml`).
- **No new red-on-release window.** The generator's version can only reach the seam through
  `ArggonManager/.convention.yml`, which is excluded from the diff; `git grep 0.5.0` over
  `.mcp.json`/`.opencode`/`opencode.jsonc`/`ArggonManager/docs` finds it nowhere else. So the
  release PR (pkg V+1, stamps V, pin V) and the re-pin PR (all V+1) both stay green, and the #527
  shape (stamps > pin) goes red. Committed stamps on main are `{0.3.0, 0.4.0, 0.4.1, 0.5.0}`;
  `sort -V` picks 0.5.0 = the pin.
- **Coverage is unchanged in the `modified[]` bucket.** I recomputed every committed
  `x-generated` checksum against disk: 16 of 57 entries mismatch, and the real job reports
  `kept adopter-modified docs: 20 file(s)`. Those files are invisible to the drift gate in the old
  and the new form alike (init protects them), so the branch-local comparison governs the same 36
  regenerated files the pinned one did. Pre-existing, not widened here.
- **The hermetic fixture is faithful where it matters.** `checksumOf` is imported from
  `./docs.js` for the fixture's state file, and the stub's `sha256:<hex>` matches
  `cli/src/docs.ts:541`; the regenerate-on-matching-checksum rule is the real one (docs.ts:574), and
  the *adopter* red case drives the **real packed `arggon init`** against a real template, not the
  stub — so direction 1 is not self-agreed. The stub only carries the branch-local direction, the
  docstring says so, and the real build round trip is documented in `docs/ci.md` §Reproduce.
  `runStep` uses `bash -e -c` on bodies de-indented verbatim from the shipped file, and injects
  `ARGGON_VERSION` (plus a non-vacuous `binVersion` assertion) — the runner's shape.
- **Scope call on the prover gap was right.** `.opencode/agents/arggon-prover.md` has no
  `x-generated` entry (verified: `/arggon-prover/.test(state)` → false; only coordinator/reviewer/
  worker are stamped), it predates this change, the branch does not widen it, and the coordinator
  filed `bug-prover-agent-has-no-x-generated-entry` on main. Correctly reported, not silently grown.

#### Minor (file as follow-ups, do not block)

5. The predicate greps the **whole** `package.json`, not the top-level `name`, so an adopter with
   `cli/src/cli.ts` plus any `"name": "arggon-manager"` occurrence (workspace/override entry) takes
   the branch path and hard-fails on `npm ci`. Fail-closed, so low; `node -p "require('./package.json').name"`
   (or an anchored grep) would be exact — and note no test pins that *this* repo classifies as the
   seam source, so a rename would be invisible while main's seam still matches 0.5.0 byte-for-byte.
6. The branch path's `npm run build` triggers `postbuild → build:plugin`, which writes the **tracked**
   `opencode/plugins/arggon/index.bundle.ts`. A stale bundle would now surface as a seam-drift red
   whose remedy ("re-run `node dist/cli.js init`") cannot fix it. `check:plugin` owns that truth;
   worth one line in ci.md or an exclusion.
7. `tasks/.convention.yml` (the legacy candidate) has no hermetic coverage of the lag assertion.
8. ADR 0018's amendment is dated 2026-10-02; the item was created 2026-10-03.

#### Answering the coordinator's question — what protection is GONE and not restored

"GONE: *an installed `ARGGON_VERSION` reproduces this repo's committed seam bytes.*" The lag
assertion does not restore it (see finding 2); it restores only the version-skew slice. Also gone,
for this repo only: the claim that a pin moved without a seam regen is caught at CI time (finding 3).
"KEPT, unchanged: every adopter/fork byte-comparison; the fresh-clone no-op; the self-exemption;
the `generatedAt` exclusion; missing-destination detection; hand-edited-generated-file detection."

#### Probes needed (executor: arggon-prover)

1. `gh run view --job 111110931552` → `gh run rerun 37090935003 --failed` (repo root, any cwd):
   expect `cli` conclusion `success` on the same head `628a4332`. A second red with the same
   `SpawnHarnessError`/half-written-`lib/dist` signature means the flake needs its own item
   (`bug-cli-spawn-suites-exit-1-flake` is already open) — it still does not block this merge, but it
   must be filed before merge rather than after.
2. Only if finding 4's parity test is declined: extract the `run:` bodies from the **committed**
   `.github/workflows/arggon.yml` (not the template) with `workflowRunSteps` and run them
   `bash -e` in a throwaway clone of the head with `ARGGON_VERSION=0.5.0`; expect exit 0 at head,
   exit 1 with `this checkout's own build` after moving one template, exit 1 with
   `dist/cli.js is missing` after `rm dist/cli.js`. This is what CI actually executes;
   today the answer is implied by the two-copy diff, and the parity test would make it explicit.

Merge when: `cli` green, findings 2-4 landed, then flip the item `done` (acceptance checklist is
already complete and accurate).

### 2026-10-03 @ses_f00552974ffegoUU0yQr6H7y1u
### 2026-10-03 @Reviewer (codex, round 2 — PR #607 @ `dd2c3c72`)
verdict: approve

Round-1 findings 1-4 are closed and the head is green. Merge it, flip the item `done`. The design trade
is unchanged from what I accepted; this round only made the record say what the code does, and put a
machine check on the invariant the fix rests on.

#### 1. `cli` green, flake not chased — confirmed

- `gh pr checks 607` on `dd2c3c72`: **cli pass** (5m18s, run 37092508750 / job 111115639715),
  **ui-smoke pass**, **tasks-validate pass** (28s, run 37092508759 / job 111115639658).
- Run 37090935003 (the head I flagged) now reads `success` — the rerun of the failed job on the **same
  sha `628a4332`**, no code change.
- `git diff --stat 628a4332 dd2c3c72` over this item's files: `ArggonManager/docs/agents.md` (+16/-3),
  `docs/ci.md` (+46/-11), `cli/src/ci-seam-pin.test.ts` (+39/-7), `cli/src/headless-ci.test.ts`
  (**+59, pure addition**). **No workflow, no template, no `cli/src` production file changed** — the
  drift gate body is byte-identical to what I read in round 1
  (`sha256(committed) = 68e496aa…` at both `628a4332` and `dd2c3c72`). Nothing was changed to make
  the flake go away, which is the only correct response to it.

#### 2. `docs/ci.md` — honest now, and release.md's sentence is the right ceiling

Read as a whole, §What the branch-local comparison gives up now: (a) opens with the price and points at
release.md's "the price paid is one weaker claim" **as the ceiling** the remaining checks are read
under; (b) names the pinned-lag assertion a **version-skew proxy, not byte-equality**, states the exact
blind spot — a feature PR that moves templates and regenerates with **no version bump** leaves every
stamp at the pin, so "the seam has postdated the release while the stamps say nothing" and "nothing in
`tasks-validate` detects that on a branch" — and then says why that is intended rather than hidden;
(c) labels `validate`/`doctor`/`list` "a read gate, not a seam gate"; (d) replaces the false
"neither copy can rot silently" with the **fact** (`pinLagsSeam()`'s extra `pin !== pkgVersion`
conjunct, and *why* it is there: it keeps the release window green in the test), tracked as a bug rather
than papered over; (e) adds §Where the rule of record lives, which states the asymmetry (template = the
rule, committed copy = what CI runs and is held to it) and that "only the workflow copy decides
`tasks-validate`".

Two accuracy checks I ran against the code: the no-version-bump blindness claim is right — `init`
stamps the **current package version**, and release-please's release PR touches five files, none of
them the seam (release.md §What the automation owns, step 2), so a feature PR's stamps sit at the pin;
and `pinLagsSeam()` (`ci-seam-pin.test.ts:96-99`) really is `pin !== pkgVersion && compare(pin,
newest) < 0`, which the shell copy does not carry. Nothing left to fix.

#### 3. `ci/src/ci-seam-pin.test.ts` header — accurate, not merely different

It now states the pin's two uses (registry install + the workflow's pinned-lag assertion), that "since
bug-seam-drift-gate-blocks-new-generated-seam-content the byte comparison is NOT against the pin in this
repo" with the branch-local/adopter split, that #527 is caught by the stamp comparison rather than a
byte diff, and it replaces the false "opposite drift is policed by the drift gate" line with the
correct scope: the branch-local byte comparison "catches a pin that moved without a seam regen only
insofar as the **SEAM** disagrees with the **SOURCE**, not with the pin" — and that the pin ahead of
the stamps is the documented template-less-patch row. Both statements match the shipped step bodies I
read. Corrected, not softened.

#### 4. Parity test — discriminates as claimed; the carve-out cannot hide a body divergence

`describe("workflow parity: template vs the copy CI runs")`, top-level (outside `describePacked`),
so it runs in the ordinary `cli` lane on every PR, cross-platform, no network and no pack. Verdict:
admit.

- **Byte comparison.** `workflow.replace(/^\s*-?\s*uses:.*$/gm, "      - uses: <action-ref>")` then
  `toBe`. Because the replacement is a **single canonical line**, the collapse preserves the *number*
  of action refs, so adding or removing one still fails; only the ref *value* is excepted, which is
  exactly the documented delta (template floats on `@v4`, this repo SHA-pins). It cannot mask a
  divergence elsewhere: a line inside a `run:` body that started with `uses:` would not be valid
  bash, and `action-pins.test.ts` independently requires every `uses:` in every shipped workflow to be
  a 40-hex SHA — so the excepted region is itself machine-guarded, by a different gate.
- **Mutation claims, checked by reading the assertions.** Neutering the lag line in the committed copy
  → the byte comparison is red (and the failure message says which way to fix it: edit the template and
  regenerate, never hand-divide). Changing the predicate in the committed **bootstrap step only** →
  both tests red, and the second names it (`${file}: step 'Bootstrap the tracker' lost the
  branch-local generator`), because the per-file loop walks `[BOOTSTRAP_STEP, DRIFT_STEP]` for both
  copies. A **coordinated** edit to both copies is still caught by the literal predicate/fallback
  assertions. The claim is accurate.
- **One nit, not blocking** (please take it next time round): in the new test the ordering assertion is
  `indexOf(lag) < indexOf("git status --porcelain")` **without** the presence check, and
  `indexOf(missing) === -1` makes it vacuously true — so on its own it would not notice a lag line
  deleted from *both* copies. It is covered: the byte comparison catches the one-copy edit, and the
  packed fixture still has `toBeGreaterThan(-1)` at `headless-ci.test.ts:414` (verified present), so
  the class cannot slip. Adding `expect(drift).toContain("lags the committed arggon seam")` makes the
  new test self-contained.

#### 5. Delivery deviation — the right call, and no problem for the parity test's premise

Escalated, not silently substituted: correct. Rejected non-fast-forward, restored published history
by reset, cherry-picked the two round-2 commits, integrated `origin/main` with a merge commit, pushed a
plain fast-forward. Nothing published was rewritten, no force-push, no `--force-with-lease` needed from
me. Verified: `03b15492` parents are `954b4aa9` (branch) + `455d6cc4` (main); `git diff
origin/main...dd2c3c72` is **9 files, all this item's** — main's adapter-selection work does not leak
into the PR diff; the merged `ArggonManager/docs/agents.md` = main's file **plus** this item's §CI-gate
paragraph (both sides survived; no conflict markers in any merged file); and the merged
`.github/workflows/arggon.yml` is byte-identical to `628a4332`'s. The "byte-identical to the rebased
tree" claim checks out: `git diff b222fe92 dd2c3c72` over the six item files is **empty**. The
`backup/…-round2` ref (`b222fe92`) is **local only** (nothing under `backup/` on the remote) — the
linear rebase is a courtesy, and my advice is to leave it unpublished: a linear rebase would now cost a
force-push to undo a merge that is correct and cheap to keep.

On the specific worry: **no problem for the parity test's premise.** The test reads
`.github/workflows/arggon.yml` from the checkout, and the gate runs `.github/workflows/arggon.yml`
from the same checkout — CI evaluates the merge result `dd2c3c72`, not a parent — so the tested file
and the executed file are the same bytes by construction, merge commit or not. Positive evidence rather
than argument: the parity test ran green on `dd2c3c72`, which is the first thing that would have caught
a merge-resolution that hand-divided the copies.

#### 6. Is the class closed? Closed for this pair; one pair still open, and its item needs re-scoping

The workflow pair can no longer drift: any divergence beyond `uses:` refs is red in the default lane
with a remedy that names the direction, and the carve-out is covered by `action-pins.test.ts`. What
the parity test does **not** do: generalize. It compares the two files it names; it says nothing about
other tracked copies of a rule, and nothing about the **other** pair — the shell predicate in the
workflow vs `pinLagsSeam()` in TS, which cannot be byte-compared and remains open.

Action for the coordinator (not for this PR):
`bug-ci-seam-pin-shell-vs-test-copy-divergence` was filed before this round landed and its acceptance
list is now mostly stale — items 1 (parity check), 3 (header describes the gate CI runs), 4 (predicate
parity in both steps/files) and 5 (where the rule of record lives) are **satisfied by this PR**, and its
Context conflates the two pairs (it lists template-vs-committed as the problem, then describes the
shell-vs-TS conjunct). Only item 2 (the `pin !== pkgVersion` skew) is real work. Re-scope it before
claim, and note the trap: "fixing" it by pasting the conjunct into the shell copy is not obviously
right — the shell copy is the **stricter** one (it reds on stamp > pin even when pin == package.json,
which is the #527 shape), so the decision to close the gap should be made deliberately, with the
release-window semantics checked, not by symmetry.

#### No regressions — re-verified on `dd2c3c72`

- **Predicate identical in both steps, fail-closed:** byte-identical workflow, so unchanged from round 1;
  and the real job still takes the branch path on the merged head — `added 158 packages`, `>
  arggon-manager@0.5.0 build`, then the drift step's `node dist/cli.js init` reporting
  `regenerated untouched docs: 36 file(s)` before an empty porcelain.
- **All four exclusions preserved** (self-exemption with its reason, `.convention.yml` `generatedAt`,
  `git grep "arggon:generated"` fresh-clone no-op, adopter pinned path) — same bytes, same reasoning as
  round 1.
- **Hermetic fixture still drives the real packed init** for the adopter-red case:
  `headless-ci.test.ts` round-2 delta is a **pure +59-line addition** placed above `describePacked`;
  nothing inside the packed suite changed.

#### Probes needed (optional — nothing here blocks the merge)

1. Nothing required for approval. If the coordinator wants belt-and-braces on the merge delivery:
   `git -C <repo> diff origin/main...origin/fix/bug-seam-drift-gate-blocks-new-generated-seam-content`
   expects exactly the 9 files above; and `git -C <worktree> rev-parse HEAD` expects `dd2c3c72` with
   `git status --porcelain` empty (both already read clean here).
2. Optional, next time the fixture is touched: the bootstrap step's `arggon init` reports `27 file(s)`
   regenerated while the drift step's second run reports `36 file(s)` on the same head. The gate's
   verdict (the porcelain) is empty, so this is report-only and pre-existing in shape — the gate runs
   `init` twice by design — but if you ever want it explained, a `--json` run of `init` on a throwaway
   clone comparing the two passes would say which 9 destinations change classification between them.
   Not a merge condition and not caused by this PR.

Merge: yes. Then `arggon` flip `bug-seam-drift-gate-blocks-new-generated-seam-content` to `done` — the
acceptance checklist (round 1 and round 2) is accurate and complete — and re-scope the two filed
follow-ups (`bug-ci-seam-pin-shell-vs-test-copy-divergence`, `bug-prover-agent-has-no-x-generated-entry`)
with the next claimant.
