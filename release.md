# Release runbook — publishing `arggon-manager` + `@arggondev/lib`

How this repo ships a version to npm and adopts it (executed verbatim for
0.4.1 on 2026-10-01). The authoritative packaging facts live in the two
`package.json` files; this file is the operator procedure.

## 0. Prerequisites

- `main` green in CI (all three lanes) and `npm run arggon -- validate` ok.
- You are an npm owner (`npm whoami` → `arggondev`); both packages publish to
  the public registry.
- The **CI version guard**: any publish-relevant `files`/packaging change
  requires a version bump, and the bumped version must **not** already be a git
  tag. Decide the number first: bug fixes → patch, new surface → minor.

## 1. Version + changelog (one `chore(release)` commit on `main`)

- Bump `package.json` **and** `lib/package.json` (the kernel is published
  separately; the root depends on it via `^x.y.z`, which picks up the new
  lib).
- Write the `CHANGELOG.md` section for the new version — summarize
  `git log vX.Y.Z..main --oneline --no-merges` into Fixed/Changed, don't
  enumerate. Note kernel-facing changes explicitly (adopters consume
  `@arggondev/lib`).
- Commit `chore(release): X.Y.Z — ...`, push.

## 2. Build + pack + inspect

```bash
npm run build
rm -rf /tmp/arggon-packs && mkdir -p /tmp/arggon-packs   # pack does not mkdir
npm pack --workspace lib --pack-destination /tmp/arggon-packs
npm pack --pack-destination /tmp/arggon-packs
```

Inspect **contents, not file lists**: extract both tarballs and check —

- lib: the new kernel exports actually exist in `package/dist/*.js` (grep the
  symbols), `package.json` version correct;
- root: `package/dist/cli.js`, `package/templates/`, `package/skills/`,
  `package/opencode/` present, version correct, **zero test-helper leaks**
  (`test-spawn`, `test-tmp`, `pack-fixtures` are all excluded).

## 3. Publish (lib first — the root resolves it from the registry)

```bash
npm publish --workspace lib
npm publish
```

Registry propagation lags minutes — `npm view <pkg> version` may still show
the old version; retry rather than re-publishing.

## 4. Tag + adopt

```bash
git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z
npm install -g arggon-manager@X.Y.Z
arggon --version        # expect: X.Y.Z (<release commit sha>, main)
arggon doctor && arggon validate   # on a real tracker
```

`write-build-info` runs during the pre-pack build, so the published artifact
self-reports the exact release commit.

## Gotchas (all hit at least once)

- Building is not optional before packing: a stale `lib/dist` ships stale
  kernel exports, and the pre-commit/CI typecheck is what catches it.
- A long-lived machine install can be an old **from-source** copy
  (`arggon --version` shows a git sha instead of a plain version) — the
  registry install replaces it.
- The tarball's `prepare` is blocked by npm; the warning is benign (the build
  is already in the tarball).
- Parallel branches that touch publish-relevant fields must rebase over the
  release commit (the guard compares against tags, not branches).
- **Re-pin the seam check**: after publishing, bump `ARGGON_VERSION` in
  `.github/workflows/arggon.yml` to the released version — CI validates the
  committed seam against what that version generates, and a stale pin turns
  `tasks-validate` red on main and every open PR (hit at 0.4.1: the init
  regeneration was 0.4.1-shaped while the pin said 0.4.0). The pin is a
  literal on purpose (`task-ci-seam-pin-tracks-release`): deriving it from
  `package.json` would install the bumped version between the step-1 bump
  and the step-3 publish, before the registry has it — guaranteed red on
  main and on every PR. The re-pin is enforced by
  `cli/src/ci-seam-pin.test.ts` — a stale pin is a red test naming this
  step, not a silent outage.
