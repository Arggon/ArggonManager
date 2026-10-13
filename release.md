# Release operations — the operator's exception manual

Releases are automated (ADR 0018 §1–2, §4; the design contract is
`ArggonManager/docs/specs/spec-release-pipeline-015.md`). Two workflows own
everything a version needs; the human decision is a review. This file is what
remains manual: the one-time setup, and the exception paths. It is not a
procedure to execute by hand — the manual bump/pack/publish runbook is gone.

## What the automation owns

1. **Propose** — push a `Release-As: X.Y.Z` trailer commit to `main` (empty
   commit is fine; no conventional-commit requirement):
   `git commit --allow-empty -m "chore(release): X.Y.Z" -m "Release-As: X.Y.Z"`.
   Decide the number first: bug fixes → patch, new surface → minor.
2. **`release-please.yml`** opens/updates the release PR: bumps both
   `package.json` versions in lockstep, rewrites the root's kernel dependency
   to the exact released version (no caret — exactness is sticky and guarded;
   see §The kernel pin stays exact), drafts the `CHANGELOG.md` section, and
   syncs `package-lock.json` onto the PR branch. The PR touches exactly five
   files: both `package.json` files, `package-lock.json`, `CHANGELOG.md`,
   `.release-please-manifest.json`.
3. **Review + merge** — hand-edit the drafted `## [X.Y.Z] - YYYY-MM-DD`
   section to house style (`### Added` / `### Changed` / `### Fixed`, kernel-
   facing changes called out), verify the five-file diff and that
   `dependencies["@arggondev/lib"]` is the bare `X.Y.Z` (the guard reddens
   otherwise), merge. Merging is the release. Merge the release PR **by
   itself**: the guard classifies the pushed HEAD commit, so a bump buried
   under later commits in the same push silently strands the release.
4. **`release.yml`** (the merge push) runs the ordered guard and the pre-tag
   gates (the merged CHANGELOG section for V; root-lib lockstep), then:
   annotated tag `vX.Y.Z` → flips the merged release PR's `autorelease:
pending` label to `autorelease: tagged` (release-please's own bookkeeping —
   see §The `autorelease` label lifecycle) → GitHub Release (notes = the merged
   CHANGELOG section) → build → pack → extract-and-inspect → publish
   `@arggondev/lib` first, then `arggon-manager` (OIDC trusted publishing) →
   both tarballs attached to the release. Every published artifact self-reports
   the release commit (`write-build-info`).

The first workflow run on a release-please-created PR needs one click — see
"Approve workflows" below. Publishing itself stays **inert** until the
one-time setup below exists: the workflow fails closed, it never falls back
to tokens.

## One-time setup: npm trusted publishers (human, npmjs.com)

For **both** packages — `arggon-manager` and `@arggondev/lib` — create a
trusted publisher bound to:

- repository `Arggon/ArggonManager`
- workflow filename **`release.yml`** (the binding is to the filename;
  renaming the workflow file is a breaking ops change and must be called out
  in the PR that does it)
- no environment
- **direct `npm publish` allowed** — configurations created after 2026-09-03
  default to stage-only publishing, so allowing direct publish is an explicit
  selection (ADR 0018 accepted direct publish as the initial shape; staged
  publishing is the upgrade path if the supply-chain bar rises)

npm's `repository.url` requirement is already satisfied: both `package.json`
files carry `git+https://github.com/Arggon/ArggonManager.git`.

**Every field is case-sensitive and must match exactly.** npm does not verify
the configuration when you save it, so a wrong value only surfaces at publish
time — as `ENEEDAUTH`, which says authentication failed without naming the
cause. The org here is `Arggon`, capital A.

**An existing connection cannot be edited.** To change one, delete it and
create a new one; npm fixes the provider and required fields at creation.

**A new configuration expires if its first successful publish does not land
within 2 days.** If it expires you must delete and recreate it — so configure
and re-run in the same sitting, not the next day.

Package settings pages, for the two entries:

- `npmjs.com/package/arggon-manager/access`
- `npmjs.com/package/@arggondev/lib/access`

When a publish fails with `ENEEDAUTH`, check the configured publisher first:
`npm trust list <package>` prints it. It requires a one-time password (it is a
2FA-protected read), and it is the fastest way to see whether the entry exists
and what it actually says — the two failures that cost this repo two release
attempts were a missing entry for `@arggondev/lib` and a lowercase-org repo
string for `arggon-manager`.

## "Approve workflows" (once per release PR)

`release-please.yml` creates the release PR with the default `GITHUB_TOKEN`,
and GitHub starts `pull_request` runs from such PRs in an approval-required
state: a write-access user clicks **"Approve workflows"** on the PR once and
CI runs. The lockfile-sync push afterwards only updates the PR — it starts no
new runs.

## Exception: the release run dies after the tag (worked example: 0.5.0)

A failing step that runs **after** the tag leaves a published tag with no
GitHub Release and nothing on npm. The guard cannot re-enter for that commit
(rule 0: version unchanged; rule 2: the tag already names this sha — which
needs a re-run of the _same_ push, i.e. the same workflow file), and a re-run
replays the file the run started with. So the remaining steps are the operator's,
in the order the workflow would have used:

```bash
# 1. the release notes for V (the merged CHANGELOG section) — same extractor
#    the workflow now calls, so the shape is identical
node cli/release-notes.mjs --write /tmp/release-notes.md --version <V>
gh release create "v<V>" --title "v<V>" --notes-file /tmp/release-notes.md

# 2. build at the RELEASE COMMIT (build-info must name it, not main's head),
#    from a detached worktree so the tree matches the tag exactly
git worktree add ../rel-<V> --detach v<V>
(cd ../rel-<V> && npm run build && node -p "require('./dist/build-info.json').sha")

# 3. pack BOTH packages (mkdir first — see the npm pack ENOENT gotcha), then
#    the same extract-and-inspect gate CI runs; nothing ships without it
mkdir -p /tmp/arggon-packs
(cd ../rel-<V> && npm pack --workspace lib --pack-destination /tmp/arggon-packs)
(cd ../rel-<V> && npm pack --pack-destination /tmp/arggon-packs)
(cd ../rel-<V> && node cli/inspect-tarballs.mjs /tmp/arggon-packs --version <V>)

# 4. kernel first, then CLI (invariant 3), each idempotent
(cd ../rel-<V> && npm publish --workspace lib)
npm view "@arggondev/lib" version          # poll until it shows <V>, never re-publish
(cd ../rel-<V> && npm publish)

# 5. attach both tarballs, then clean up
gh release upload "v<V>" --clobber /tmp/arggon-packs/*.tgz
git worktree remove ../rel-<V>
```

**0.5.0 (2026-10-02), exactly this path.** The run died at the notes step —
the extractor was inline awk anchored to the closing bracket of `## [V]`, and
release-please writes the LINKED form `## [0.5.0](…compare/…) (2026-10-02)`,
which that pattern cannot match. The tag `v0.5.0` → `13d72f5f` was already
pushed, so the operator completed the release by hand (release object with the
hand-curated notes, build at the tag, `inspect-tarballs` green, kernel then CLI
published, both tarballs attached). Fixed in the same PR as this entry: the
extraction is a tested module (`cli/release-notes.mjs`) that matches the header
by prefix, and it now runs as a `--check` gate **before** the tag step, so this
class cannot strand a tag again. Local publishing needs registry credentials in
`~/.npmrc`; the workflow's own path is OIDC trusted publishing.

## Exception: the release PR is non-lockstep (root != lib)

release-please bumps **only the components whose paths the wave touched**, while
`release-please-config.json`'s extra-files rule rewrites the root's kernel pin
to the root's new version assuming lockstep. A wave whose commits touch no
`lib/` path therefore yields a non-lockstep proposal — root ahead, lib unmoved —
which is a broken release: the root would pin a kernel version that was never
bumped. Every release is lockstep (ADR 0018 §1/§2; spec-release-pipeline-015
invariant 1), so it must never merge.

**Detection.** Both surfaces landed 2026-10-13
(`bug-release-proposal-non-lockstep-undetected`), after #764 (root 0.8.0, lib
0.7.1) sat undetected behind the release PR's approval-gated CI:

- `release-please.yml` runs `cli/release-lockstep-check.mjs` on every push. It
  reads both `package.json` versions at the open release PR's head ref and
  **reddens the maintenance run** when they differ, naming both versions and the
  remedy below. A lockstep proposal and a push with no open release PR stay
  silent; a gh query that cannot run warns and exits 0 (never a false red).
- `release.yml` asserts root == lib **before** creating the tag, so a
  non-lockstep release commit cannot strand a tag. (The assert used to run after
  the tag: it stopped the publish but left `vX.Y.Z` behind, the label flip never
  ran, and release-please wedged on the merged release PR — the 2026-10-02 →
  2026-10-07 outage class.)

**Remedy — force both packages with a `Release-As` trailer.** release-please
applies an **empty** commit to every component path (`CommitSplit
includeEmpty: true`), so an empty commit whose message carries the trailer sets
BOTH packages to `X.Y.Z` and updates the open release PR to a lockstep proposal:

```bash
git commit --allow-empty -m "chore(release): X.Y.Z" -m "Release-As: X.Y.Z"
git push origin main
```

`X.Y.Z` is the version you intend to release — normally the higher of the two
proposals, and the red check message prints the concrete command. The
`linked-versions` plugin is **not** an alternative here: under this repo's tag
contract (`include-component-in-tag: false`) `getComponent()` returns the empty
component, so the plugin finds no components to link (verified against
release-please 17.11.2). Step 1 of "What the automation owns" is the same
trailer used deliberately; this exception is about _repairing_ a proposal that
went out non-lockstep.

**If a tag is stranded anyway (legacy runs).** A run from before the pre-tag gate
can leave `vX.Y.Z` naming a non-lockstep commit with nothing published. Recovery:

1. **Never move or delete the tag** (invariants above) — and never publish from
   it or hand-create its GitHub Release: the commit's two versions disagree and
   its root kernel pin names a kernel that does not exist.
2. If the merged release PR still carries `autorelease: pending`, the next
   `release-please.yml` run reddens naming it; clear it with the label-flip
   command (§The `autorelease` label lifecycle).
3. Fix lockstep **forward**: push the empty `Release-As` commit for the NEXT
   version (patch for fixes, minor for features), merge that lockstep release
   PR, and let `release.yml` publish it. npm simply skips the stranded number;
   nothing points adopters at it.

## Exception: publish fails with an authentication error

Trusted-publisher misconfiguration (wrong filename, wrong repo, stage-only
default) surfaces only at publish time — npm does not validate the config on
save. The failure happens AFTER the tag and GitHub Release exist (by design:
the agreement gate runs first). Recovery:

1. fix the npmjs.com trusted-publisher config,
2. re-run the failed workflow ("Re-run failed jobs" on the same push) — the
   guard classifies the commit as an idempotent re-run (tag already at HEAD)
   and completes only the remaining steps.

## Exception: partial failure (kernel published, CLI failed)

Both publish steps treat "version already present at `X.Y.Z` on the
registry" as success — never re-publish, never unpublish. A re-run skips
whatever shipped and completes the rest.

## Why the propagation poll exists

The registry/CDN lags minutes: `npm view @arggondev/lib version` can still
show the old version right after a successful publish. The workflow polls
(bounded, 300 s) between the two publishes — retry, never re-publish. If the
poll exhausts, the run fails; re-run it once the registry has caught up (the
guard's idempotent path completes the release).

## Rebase over the release commit

Parallel branches that touch publish-relevant `package.json` fields must
rebase over the release commit — the CI version guard compares against tags,
not branches.

## From-source installs shadow the registry

A long-lived machine install can be an old from-source copy: `arggon
--version` prints a git sha instead of a plain version. The registry install
replaces it.

## Pack destination `ENOENT`

`npm pack --pack-destination` does not create the destination directory
(npm 10 and 12 exit 254 with `ENOENT`) — create it first (`release.yml` and
`ArggonManager/docs/ci.md` both script the `mkdir`).

## The kernel pin stays exact (guard-enforced)

The root's `dependencies["@arggondev/lib"]` ships the **bare** released version —
no `^`/`~`/range operator (ADR 0018 §2; spec-release-pipeline-015 invariant 4 /
A3), so what an adopter installs is exactly what CI tested. release-please's
extra-files JSON updater rewrites the version **inside** the existing string
(`generic-json.ts` does a version-regex substring replace), so it preserves
whatever operator is there: an exact pin stays exact, a caret stays a caret.
Exactness was established in the 0.8.0 release PR (#764, `5fd10db4`), and v0.9.0
kept it automatically (#770 rewrote `"@arggondev/lib": "0.8.0"` to `"0.9.0"` with
no operator), so the rewrite is machine-owned and sticky.

**What did not work (the record).** The original plan (spec C1 amendment,
2026-10-01) was a one-time hand-unpin inside the _first_ release PR's review,
"machine-owned exact→exact from release 2". That manual step never executed:
v0.4.1 through v0.7.1 all shipped the caret and nothing detected it. The
one-time exception was written down here and in the spec, but documentation is
not enforcement — the SPEC's `A3 verified` was effectively unmet for five
releases. The 0.8.0 release PR was the first to un-pin.

**The guard** (`bug-kernel-pin-never-exact`). Two surfaces keep A3 true:

- `release-please.yml` runs `cli/release-lockstep-check.mjs` on every push. At
  the open release PR's head ref it checks the versions (lockstep) **and** the
  kernel pin: a range operator, a stale exact version, or a missing dependency
  reddens the maintenance run, naming the value and the fix. A clean proposal
  and a push with no open PR stay silent; a gh query that cannot run warns and
  exits 0.
- `cli/release-lockstep-check.test.ts` pins main's own pin to the same contract
  on every CI run, so a range pin fails a PR before it ever reaches a release
  PR.

**No normalization step writes the pin** (decided 2026-10-13). release-please
owns that rewrite and exactness is sticky once main is exact; a caret-stripping
step would be a second writer on release-please's own PR branch — the
alternative the spec rejected (C1) — and would silently repair a release-please
regression instead of surfacing it. The detection gap is what A3 lacked, and the
guard closes it; the spec's rejected-alternative note was revisited and stands,
now on evidence.

**When the guard reddens.** In the release PR: edit `package.json`'s
`dependencies["@arggondev/lib"]` to the bare `X.Y.Z` being released, then re-run
`release-please.yml` ("Re-run all jobs" on the red run — or any later push to
`main`) so the lockfile-sync step recomputes `package-lock.json` on the fixed
branch; `npm ci` compares the lockfile against the changed pin. Merge only after
that run is green. A dependency-only un-pin on `main` is blocked by design (the
CI version guard treats `dependencies` as publish-relevant and demands a version
bump), which is why the fix lives in the release PR.

## The re-pin (guard-enforced)

After a release, regenerate the seam with the released version (`arggon init`)
and move the literal `ARGGON_VERSION` pin in BOTH
`templates/docs/github/workflows/arggon.yml` (what adopters vendor) and
`.github/workflows/arggon.yml` (this repo's CI) in the same PR. The pin is a
literal on purpose — deriving it from `package.json` would install the bumped
version between the release PR and the publish, before the registry has it
(the #527 outage class). Non-divergence is enforced, not remembered:
`cli/src/ci-seam-pin.test.ts` fails until the pin matches the regenerated
seam — **a stale pin is a red test, not a silent outage.** `tasks-validate`
enforces the same rule at CI time on every repo (the drift step's pinned-lag
assertion), so an adopter whose pin lags their seam gets the bump-the-pin
remedy instead of an unexplainable diff.

## The tag↔config agreement (gate-enforced)

`release.yml` creates the plain annotated tag `vX.Y.Z` (`git tag -a
"v${VERSION}"` — the tag names the exact published commit, spec invariant 1).
`release-please-config.json` must agree with it: it carries
`"include-component-in-tag": false`, so release-please searches that SAME plain
tag. When the two disagree, release-please searches a component-prefixed tag
(`arggon-manager-v0.5.0`), never finds the plain one, concludes its own merged
release PR is untagged, and aborts before opening the next release PR. That is
exactly what killed releases from 2026-10-02 to 2026-10-07 — and it stayed
invisible because the abort is a `logger.warn` inside a run that reported
`success`, not a failure.

Two gates keep the class out, and both are proven red (a gate never seen red is
not evidence):

- **`cli/src/release-config-agreement.test.ts`** fails if
  `include-component-in-tag` resolves to anything but the `false` that matches
  `release.yml`'s plain `v${VERSION}` — including the key being **absent** (the
  official schema default is `true`, the exact omission that shipped the
  outage). A fixture that flips the key to `true` goes red; so does the reverse
  drift of editing `release.yml`'s tag line back to a component prefix. Fix the
  config or the tag line — the next drift is a red test, not a silent dead
  pipeline.
- **`cli/release-abort-check.mjs`** runs in `release-please.yml` right after the
  action and fails the run when a MERGED release PR still carries
  `autorelease: pending` — release-please's own abort predicate
  (`src/manifest.ts`). It cannot go red on an ordinary push: no release PR is
  merged, and every already-merged one has had its label flipped to
  `autorelease: tagged` by `release.yml`'s tagging run (§The `autorelease`
  label lifecycle below). When it does redden, it names the stuck PR(s) and the
  one-command recovery. An aborted release can no longer masquerade as a green
  run.

## The `autorelease` label lifecycle (owned by `release.yml`)

release-please decides whether it may open the next release PR by reading a
**label**, so the transition between the two states is load-bearing:

- **`autorelease: pending`** — "this release PR is merged and its release is not
  tagged yet". Applied by release-please when it opens the release PR.
- **`autorelease: tagged`** — "this release is complete". Normally applied by
  release-please's own tagging path; in this repo, by `release.yml`.

While any **merged** release PR still carries `autorelease: pending`,
release-please reads it as a merged-but-untagged release and **aborts before
opening the next release PR** (`findMergedReleasePullRequests` → "There are
untagged, merged release PRs outstanding - aborting"). That abort is a
`logger.warn` inside a run that reports `success` — which is why this file
exists to document it.

Because `skip-github-release: true` opts this repo out of release-please's
tagging path (a `GITHUB_TOKEN`-created tag triggers no workflow, so `release.yml`
owns the tag), release-please never flips its own label: **`release.yml` owns the
flip**. `cli/release-label-flip.mjs` runs in the same run that creates the tag,
immediately after the tag↔version agreement assert, and moves every merged
`autorelease: pending` PR to `autorelease: tagged`. It is idempotent (nothing
pending → no-op: every ordinary push's rule-0 run and every rule-2 re-run) and
best-effort (any failure warns and exits 0 — a non-zero exit there would strand a
tagged release before the publish, and the backstop below is the detector).

The label tracks the **tag**, not the publish: the flip happens before the
release object, build and publish steps, and stays flipped if a later step
fails. That matches release-please's own tagging path (it flips when it tags),
and a failed publish is recovered by re-running the workflow, never by the label.

**The `skip-github-release: true` reconciliation.** Opting out of
release-please's tagging makes three pieces of its bookkeeping the repo's own,
each with a named owner: the tag↔config agreement
(`cli/src/release-config-agreement.test.ts`), the label lifecycle (this section,
`cli/release-label-flip.mjs`), and the abort surfacing that replaced "read the
warning inside a green run" (`cli/release-abort-check.mjs`).

### When a merged release PR is stuck on `autorelease: pending`

The next `release-please.yml` run goes **red** — that is the detection now, and
it no longer costs days of green runs. The backstop's message names the stuck
PR(s) and carries the recovery, one command per PR:

```bash
gh pr edit <n> --add-label "autorelease: tagged" --remove-label "autorelease: pending"
```

That is the exact command `cli/release-label-flip.mjs` runs, so the automation
and this instruction cannot drift. Observed end to end on 2026-10-12: #664
(`chore: release main`, merged 2026-10-09) sat on `autorelease: pending`; run
38282448930 went red naming it; the command above cleared it; run 38283343454
printed `release-abort-check: OK` and opened release PR #744.

The residual window is the gap between the tag step and the flip: a run that dies
there, or a flip that cannot reach GitHub, leaves the label pending — and the
backstop reddens on the next push to `main` naming it. That cannot regress to the
old five-day blindness.

## One release story: two axes (bug-seam-drift-gate-blocks-new-generated-seam-content)

The "release forgotten" refusals people hit — the drift gate red on a PR that
legitimately changed generated content (PR #605), and the version guard red on
a `files`/packaging change after the tag (#600) — are one confusion wearing two
hats: _does this change need a release?_ The answer is per-axis, and the axes
are not the same:

| Axis                         | Question                                                                                              | Gate                                                                                                   | Needs a release?                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Shipped package identity** | Do the published tarballs change? (`name`/`version`/`private`/`bin`/`files`/`dependencies`/`engines`) | `cli/version-guard.mjs` in the `cli` job: shipping fields changed while `refs/tags/v<version>` exists  | **Yes** — by design; that is the "release forgotten" signal. A #600-shaped refusal is correct, not a bug to route around. |
| **Repo-owned seam bytes**    | Do the committed generated files change?                                                              | `tasks-validate` drift gate — now **branch-local**: it compares them against this checkout's own build | **No** — a feature PR regenerates and commits its own seam and goes green.                                                |

The decision this records: **make the gate branch-aware** rather than demand
"cut a release first" for every seam-touching PR. The alternative was
available and cheaper to write — keep the pinned comparison and tell everyone to
release first — but it taxes every PR that touches generated content with a
release plus a re-pin, and its prescribed remedy is impossible for the case it
fires on (the pinned init is what deletes the newer content). The price paid is
one weaker claim, stated plainly: in this repo `tasks-validate` no longer proves
that the _pinned release_ reproduces the committed seam. What replaces it is the
pinned-lag assertion (the pin may never sit behind the seam) plus the
release-shaped `arggon validate` / `doctor` / `list`, which still run through
the pinned bin. Full rationale and the both-ways probe:
`ArggonManager/docs/ci.md` §Which generator the gate compares against.
