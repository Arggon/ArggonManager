# Release runbook

Cutting a release of ArggonManager (no npm publishing — releases are the version bump, the tag, and the changelog entry).

## When to run it

When a wave of merged work on `main` should become a numbered release so adopters' `arggonVersion` stamps (in every generated doc's x-generated state) mean something.

## Version bump rules

- **major** — convention/schema break: existing `tasks/` trees or generated docs need migration to keep working.
- **minor** — new commands, new templates or template changes, methodology changes, or any new adopter-facing feature.
- **patch** — bug fixes with no adopter-facing surface change.

## Prerequisites

- Work on `main` (or a release PR merged to `main`).
- `CHANGELOG.md` updated (see step 2).

## Steps

1. Bump `"version"` in `package.json` (0.Y.Z).
2. Add a `## <version> (YYYY-MM-DD)` section to `CHANGELOG.md` listing **adopter-facing** changes: templates, methodology, commands, fixes. Adopters and their agents read the changelog to decide whether to upgrade — keep it about what changed for them, not internal refactors.
3. Verify (from repo root):
   - `npm run arggon -- --version` prints the new version.
   - `npm run validate -- ok` / `npm test` / `npm run lint` / `npm run build` all clean.
   - `npm run arggon -- doctor --json` reports 0 modified / 0 drifted generated docs.
4. Merge to `main` and tag the release commit on `main`: `git tag vX.Y.Z && git push origin vX.Y.Z`.

## Verification

- `git tag` contains `vX.Y.Z`; `git rev-parse vX.Y.Z^{commit}` is a commit on `main`.
- Generated-doc stamps (`arggonVersion` in x-generated state) reflect the new version after regeneration.

## Rollback

There is no undo for a published tag — do not delete or move tags on `main`. If the version is wrong, cut the next patch release with a corrected number; the changelog is append-only.
