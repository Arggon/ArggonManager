# Release runbook

Cutting a release of ArggonManager — the version bump, the changelog entry, the
`vX.Y.Z` tag, and the npm publication of the two packages (`@arggon/lib` and
`arggon-manager`, ADR 0013).

## When to run it

When a wave of merged work on `main` should become a numbered release so
adopters' `arggonVersion` stamps (in every generated doc's x-generated state)
mean something. The native-first program (`plan-native-first-011`, waves W0–W7)
is the first wave that publishes the packages.

## Who decides what

- **Product owner only, never an agent:** publishing to npm, removing
  `private: true`, bumping `"version"`, and creating or pushing tags. Agents
  prepare the changelog, the docs and this checklist, run every verification
  that needs no publication, and stop before the first irreversible step.
- **Irreversible by policy:** a published version number can never be reused and
  tags on `main` are never moved or deleted. If a release is wrong, cut the next
  patch — the changelog is append-only and `npm unpublish` is not part of this
  process.

## Version bump rules

- **major** — convention/schema break: existing legacy `tasks/` trees need the
  `arggon migrate --layout` move to keep working.
- **minor** — new commands, new templates or template changes, methodology
  changes, or any new adopter-facing feature. (The native-first rebuild is a
  **minor** bump: new tools, commands, plugin/TUI surfaces and the layout.)
- **patch** — bug fixes with no adopter-facing surface change.

## Prerequisites

- Work on `main` (or a release PR merged to `main`).
- `CHANGELOG.md` updated (see step 2) — the adopter-facing notes, including any
  **default-path change** (e.g. the W3 removal of MCP auto-registration).
- The release PR is green: `npm test`, `npm run lint`, `npm run build`,
  `npm run check:plugin`, `arggon validate`, `arggon spec validate`,
  `npm run context:report -- --strict`.
- npm account with publish rights to both packages and a 2FA/token accepted by
  `npm publish`.

## Steps

1. Bump `"version"` in `package.json` (0.Y.Z). `@arggon/lib` versions in
   lockstep with the root; the root declares it as `^0.Y.Z`.
2. Turn the `## [Unreleased]` section of `CHANGELOG.md` into
   `## <version> (YYYY-MM-DD)` and list **adopter-facing** changes: templates,
   methodology, commands, plugin surfaces, fixes. Adopters and their agents read
   the changelog to decide whether to upgrade — keep it about what changed for
   them, not internal refactors.
3. Verify (from repo root):
   - `npm run arggon -- --version` prints the new version.
   - `npm test` / `npm run lint` / `npm run build` / `npm run check:plugin` all
     clean.
   - `arggon validate --json` and `arggon spec validate` ok.
   - `npm run context:report -- --strict` → all ADR 0006 bounds pass.
   - `arggon doctor --json` reports 0 modified / 0 drifted generated docs
     (acknowledged and adopter-owned docs are expected, not drift).
4. Merge the release PR to `main` and tag the release commit on `main`:
   `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. **Publish the two packages, in dependency order** (owner-run; see
   § Publishing to npm).
6. Post-release, in a follow-up PR: pin the generated CI recipe to the released
   seam — set `ARGGON_REF: vX.Y.Z` in
   `templates/docs/github/workflows/arggon.yml` and regenerate the committed
   `.github/workflows/arggon.yml` (`arggon init`) so adopters' drift gates
   compare against a fixed release instead of the moving branch ref.

## Publishing to npm

Both packages stay `private: true` until the release wave. The release PR
removes the flag from `package.json` (root) and `lib/package.json`
(`@arggon/lib`); then, from the tagged commit:

```bash
npm ci                                   # prepare builds lib/dist + dist/ + the plugin bundle
npm publish --workspace @arggon/lib      # kernel first
npm publish                              # arggon-manager (bin + templates + plugin)
```

Notes:

- The root package cannot resolve `@arggon/lib` from the registry before the
  kernel is published: publish `@arggon/lib` first (same version), and never
  publish the root alone.
- `npm pack` is the pre-release rehearsal and stays the documented install path
  until the registry has both packages (`ArggonManager/docs/ci.md`).
- Verify after publishing: `npm view @arggon/lib version`,
  `npm view arggon-manager version`, then in a scratch directory
  `npm install -g arggon-manager && arggon --version` — the one-liner replaces
  the two-tarball block in the docs (`README.md` § Install,
  `ArggonManager/docs/ci.md`) in the same follow-up PR as step 6.

## Verification

- `git tag` contains `vX.Y.Z`; `git rev-parse vX.Y.Z^{commit}` is a commit on
  `main`.
- Generated-doc stamps (`arggonVersion` in x-generated state) reflect the new
  version after regeneration.
- The registry serves both packages at the released version and a clean global
  install prints it.

## Rollback

There is no undo for a published tag or a published npm version — do not delete
or move tags on `main`, and do not `npm unpublish`. If the version is wrong, cut
the next patch release with a corrected number; the changelog is append-only.
A bad tarball that never worked can be deprecated (`npm deprecate`) while the
patch is prepared.
