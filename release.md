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
   to the exact released version (no caret — exact-to-exact once the first
   release PR has un-pinned the caret, see the exception below), drafts the
   `CHANGELOG.md` section, and syncs `package-lock.json` onto the
   PR branch. The PR touches exactly five files: both `package.json` files,
   `package-lock.json`, `CHANGELOG.md`, `.release-please-manifest.json`.
3. **Review + merge** — hand-edit the drafted `## [X.Y.Z] - YYYY-MM-DD`
   section to house style (`### Added` / `### Changed` / `### Fixed`, kernel-
   facing changes called out), verify the five-file diff, merge. Merging is
   the release. Merge the release PR **by itself**: the guard classifies the
   pushed HEAD commit, so a bump buried under later commits in the same push
   silently strands the release.
4. **`release.yml`** (the merge push) runs the ordered guard, then: annotated
   tag `vX.Y.Z` → GitHub Release (notes = the merged CHANGELOG section) →
   build → pack → extract-and-inspect → publish `@arggondev/lib` first, then
   `arggon-manager` (OIDC trusted publishing) → both tarballs attached to the
   release. Every published artifact self-reports the release commit
   (`write-build-info`).

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

## Exception: the first release PR un-pins the kernel (one-time)

release-please's extra-files JSON updater rewrites the version inside the
existing dependency string (`generic-json.ts` does a version-regex substring
replace), so the range prefix is preserved: today's `^0.4.0` becomes
`^0.4.2` in the first release PR, not `0.4.2`. The exact pin needs a one-time
bootstrap performed in that PR's review: edit the root dependency to the
exact `X.Y.Z` being released (the version guard is satisfied there — the
release PR bumps the version to an untagged number). From the second release
on the rewrite is exact-to-exact and fully machine-owned. A dependency-only
un-pin outside a release PR is blocked by design: the CI version guard treats
`dependencies` as publish-relevant and demands a version bump.

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
