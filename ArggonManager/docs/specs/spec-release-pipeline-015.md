---
spec_id: release-pipeline-015
title: "Release pipeline: release PR + OIDC publish + exact kernel pin + tarballs"
status: proposed
created: 2026-10-01
---

# Spec: Release pipeline (release-pipeline-015)

Design contract for [ADR 0018](../adr/0018-update-delivery-and-distribution-channel.md)
§1 (release PR + OIDC publish), §2 (exact kernel pin) and §4 (GitHub Release
tarballs) — bundles A3 + C1 + D2 of
[exploration-update-delivery-016](../explorations/exploration-update-delivery-016.md).
It replaces the manual runbook (`release.md`, executed verbatim for 0.4.1)
with two workflows. Implementation is `task-release-workflow`, which is
gated on this spec (`spec analyze` with no NEW findings) and on
`task-ci-seam-pin-tracks-release` (lands with/before the pipeline, per
ADR 0018 §1). Input interplay sources: `release.md`, `ArggonManager/docs/ci.md`,
`.github/workflows/ci.yml` + `arggon.yml`, `cli/version-guard.mjs`, both
`package.json` files.

## Purpose

A release becomes: review + merge a machine-maintained release PR; CI does
the rest. The pipeline must remove every human-held gotcha the runbook
records (stale `lib/dist`, wrong publish order, propagation lag, the manual
`ARGGON_VERSION` re-pin) without new runtime dependencies and without stored
npm tokens.

Invariants (any implementation must hold all of them):

1. **Never publish without tag↔version agreement** — the root tag `vX.Y.Z`
   names the exact commit being published and matches the root
   `package.json` version `X.Y.Z`; the kernel version equals the CLI
   version (lockstep) at the same commit.
2. **No stored npm token** — publishing authenticates via npm OIDC trusted
   publishing only (`permissions: id-token: write`); no `NPM_TOKEN` secret
   exists in any workflow.
3. **lib-first publish order with propagation retry** — `@arggondev/lib`
   publishes before `arggon-manager`; between them the registry is polled
   (retry, never re-publish) through the propagation lag the runbook §3
   records.
4. **Exact kernel pin written in lockstep** — the release automation rewrites
   the root's `"@arggondev/lib"` dependency to the exact released version
   (caret removed) in the same release PR that bumps both versions.
5. **Both tarballs attached** — the packed `arggon-manager-*.tgz` and
   `@arggondev/lib-*.tgz` are attached to the version's GitHub Release.
6. **The publish workflow file is named `release.yml`** — the npmjs.com
   trusted-publisher configuration binds to that filename; renaming it is a
   breaking ops change called out in the renaming PR (ADR 0018 §1 duty).
7. **A release exists only as a human-merged release proposal** — no
   workflow bumps versions, tags, or publishes except on the merge of a
   release PR maintained by the manifest flow (ADR 0018: "merging it is the
   release"; maintainer constraint: "a human-merged release proposal, not
   auto-publish on push to main").

## Synopsis

Two workflows, no new runtime dependencies:

```text
Release-As: X.Y.Z commit to main            (human proposes; C2)
  └─ release-please.yml ── release PR       (bumps both package.json versions
       (GITHUB_TOKEN)                        to X.Y.Z, exact kernel pin via
                                             extra-files (C1), lockfile sync,
                                             CHANGELOG draft; skip-github-release)
Human review + hand-edit CHANGELOG + merge  (the release decision)
  └─ release.yml ── tag vX.Y.Z + GitHub Release + build + pack + inspect
       (push main, guarded; C3)              + publish lib → CLI via OIDC
                                             trusted publishing + upload tarballs
```

Files owned: `release-please-config.json`, `.release-please-manifest.json`,
`.github/workflows/release-please.yml`, `.github/workflows/release.yml`
(name fixed), one-time `repository` fields in both `package.json` files;
`release.md` shrinks to the exception manual. No new npm dependencies; the
only new secrets surface is the absence of one (no `NPM_TOKEN`).

## Settled choices (exactly one each, with rationale)

### C1. Exact-pin mechanism: release-please `extra-files` JSON updater — not the `node-workspace` plugin

The root package entry in `release-please-config.json` carries:

```json
"extra-files": [
  { "type": "json", "path": "package.json",
    "jsonpath": "$.dependencies['@arggondev/lib']" }
]
```

release-please's GenericJson updater writes the released version — exact,
no range operator — into the root's dependency on the kernel.

**Rationale.** The `node-workspace` plugin cannot produce an exact pin. Its
dependency rewrite goes through `newVersionWithRange`
(`src/updaters/node/package-json.ts`, accessed 2026-10-01), which preserves
the old spec's range prefix (`^`, `~`, `>=`, …): today's `"^0.4.0"` would
become `"^0.4.2"` — exactly the silent-skew surface ADR 0018 §2 rejects
(an exact spec would stay exact, but only after a one-time hand-unpin
bootstrap; the extra-files updater needs no bootstrap and keeps the whole
rewrite machine-owned, which is the ADR's stated reason the pin is free:
"the release automation owns the extra rewrite"). Rejected: `node-workspace`
(range-preserving, above); combining both (two writers to the same JSON
field, application order undefined); a post-hoc caret-stripping step in the
manifest workflow (a second writer fighting release-please's own PR-branch
management).

Implementation notes (verify at implementation time; they do not change the
choice): the jsonpath key must be bracket-quoted because the package name
contains `@` and `/`; the GenericJson updater re-serializes the file, so the
release PR's `package.json` diff must stay limited to the `version` and
dependency fields (AC A4).

### C2. Release proposal under non-conventional history: a `Release-As: X.Y.Z` trailer on a commit to main (empty commit allowed)

A release is proposed by pushing a commit to main whose body carries the
trailer, typically:

```bash
git commit --allow-empty -m "chore(release): X.Y.Z" -m "Release-As: X.Y.Z"
```

release-please then opens/updates the release PR for exactly `X.Y.Z`, for
both manifest packages: each package scans the same main history since its
own last release, and the `RELEASE AS` note forces a `CustomVersionUpdate`
regardless of the commit's other content, so both packages are proposed at
`X.Y.Z` together (lockstep). The flow **does not depend on adopting
conventional commits**: `feat:`/`fix:` commits improve the generated
CHANGELOG draft but are never required — this repo's history
(`chore(tasks): …`, `docs: …`, squash merges) proposes releases fine.

**Rationale.** This is release-please's documented manual override — README,
"How do I change the version number?": a commit to main with
`Release-As: x.x.x` in the commit body makes release-please open the release
PR for that version, empty-commit example included (accessed 2026-10-01);
the versioning strategy checks every commit for the `RELEASE AS` note first
(`src/versioning-strategies/default.ts`) and forces the version. It also
keeps the human decision the runbook has today (choose the number:
bug fix → patch, new surface → minor) while the automation does the
transcription. Fallback, kept out of the happy path: per-package
`"release-as": "X.Y.Z"` in the manifest config (documented as "ignoring
conventional commits") — rejected for the happy path because the config is
sticky ("once the release PR is merged you should either remove this or
update it", manifest-releaser.md) — a forgotten key silently pins every
later release. Rejected: requiring conventional commits (checklist
constraint); a hand-rolled PR that edits both package.json files (loses the
machine-owned exact pin, CHANGELOG draft and manifest bookkeeping — the
transcription-error class the runbook suffers).

### C3. `release.yml` trigger: `push` to `main`, self-guarded to release commits — not tag push, not release published

`release.yml` runs `on: push: branches: [main]`. Its first step decides
release vs no-op: let `V` be the root `package.json` version at the pushed
commit (`github.sha`).

- tag `v(V)` does **not** exist → this push is a release: proceed;
- tag `v(V)` exists and points at `github.sha` → idempotent re-run
  (complete remaining steps; safe under the `concurrency` group — also the
  recovery path for "Re-run failed jobs" and for a publish that failed
  before the trusted-publisher config existed);
- tag `v(V)` exists pointing elsewhere → **fail loudly** (a shipped version
  is being re-shipped; agreement gate);
- any other push to main (tracker flips, docs, fixes) → exit 0 without
  publishing.

**Rationale.** Both "obvious" triggers are structurally unavailable, verified
2026-10-01: (a) release-please creates the tag and GitHub Release using the
workflow's `GITHUB_TOKEN` (the checklist-mandated default), and GitHub's
recursion rule says "events triggered by the `GITHUB_TOKEN` will not create a
new workflow run" (docs.github.com, *Triggering a workflow*) — so
`release: published` and tag-push on those objects never fire `release.yml`;
making them fire needs a stored PAT or GitHub App key, a long-lived repo
credential against the exploration's supply-chain criterion. (b) Composing
`release.yml` as a `workflow_call` child of the manifest workflow breaks
trusted publishing: npm "validation checks the calling workflow's name
instead of the workflow that actually contains the publish command"
(docs.npmjs.com/trusted-publishers, accessed 2026-10-01) — the trusted
publisher would have to bind `release-please.yml`, violating the
`release.yml` naming invariant (ADR 0018 §1 binds it explicitly). With
`release.yml` as the top-level owner of tag + GitHub Release + publish: the
only event is the human's merge of the release PR (real push, no recursion
involved), tag creation and asset upload share one run (no release-object
race), and the tag↔version agreement is enforced at the only gate that could
violate it. This preserves the ADR's decided semantics — nothing publishes
without a human-merged release proposal; the invariant-7 non-goal
("auto-publish on push to main") means versioned artifacts shipping without
a merged proposal, which the guard makes impossible (only a version bump
beyond the latest `v*` tag — i.e. a release PR's merge — fires the release
path).

**Ownership consequence** (deviation from the task-release-workflow
checklist's original wording, reconciled in the mirrored checklist):
`release-please.yml` maintains the release PR only
(`skip-github-release: true` — the documented manifest-PR mode); `release.yml`
owns tag + GitHub Release (notes from the merged CHANGELOG section) +
publish + tarball assets.

### C4. CHANGELOG section format: the existing Keep-a-Changelog style, hand-edited in the release PR

`CHANGELOG.md` stays in the repo's existing style — `## [X.Y.Z] - YYYY-MM-DD`
headings with `### Added` / `### Changed` / `### Fixed` sections (Keep a
Changelog 1.1.0, as the file header declares; 0.4.1's section is the format
exemplar). release-please's generated section is a **draft**: the manifest
config maps `changelog-sections` onto the Keep-a-Changelog category names so
the draft lands close, and the human edits the new section in the release PR
before merge (content and headings), per the release-PR-as-review model.
Hand edits persist across releases: release-please tracks the last released
version in `.release-please-manifest.json` and prepends the new section
without rewriting older content. If `changelog-sections` proves not to
affect the `node` release type's draft (verify at implementation), the hand
edit is the normalization point and this choice is unchanged — the
acceptance criterion is on the merged section (A6), not the draft.

**Rationale.** The changelog is a reviewed artifact today (the runbook §1
summarizes instead of enumerating and calls out kernel-facing changes
explicitly — adopters consume `@arggondev/lib`), and the maintainer
constraint is PR-as-review; adopting the generator's native format
(`### Bug Fixes`, `### Features`, compare-links) would fork the house style
or force post-merge rewriting outside review. Rejected: release-please
native headings (style drift; loses the kernel-facing-callout practice);
`skip-changelog: true` plus fully hand-written sections (loses the draft,
the version-boundary bookkeeping and the release-notes source release.yml
extracts).

## Surfaces

| File | Status | Content |
| --- | --- | --- |
| `release-please-config.json` | new | manifest config: packages `.` (`arggon-manager`) and `lib` (`@arggondev/lib`); `release-type: node`; `skip-github-release: true`; `changelog-sections` mapped to Keep-a-Changelog categories; root `extra-files` exact-pin updater (C1) |
| `.release-please-manifest.json` | new | per-package last-released versions (`"."` → current root version, `"lib"` → current kernel version; both `0.4.1` at adoption) — updated inside each release PR |
| `.github/workflows/release-please.yml` | new | `googleapis/release-please-action@v4` with `config-file` + `manifest-file`; `on: push: branches: [main]`; default `GITHUB_TOKEN`; `permissions: contents: write, pull-requests: write`; plus the lockfile-sync step (below) |
| `.github/workflows/release.yml` | new — **name fixed** | `on: push: branches: [main]`; `permissions: contents: write, id-token: write`; `concurrency` group serializing release runs; guard (C3) → tag → GitHub Release → build → pack → inspect → publish lib→CLI (OIDC) → upload tarballs |
| `package.json` / `lib/package.json` | edited once | gain a `repository` field (see Interplay) |
| `release.md` | shrunk | operator's exception manual (A14) |
| `ArggonManager/docs/ci.md` | edited | install-from-release-asset variant (A15) |

Workflow inputs: none. The released version is read from the tree at
`github.sha` — nothing to mistype, no dispatch inputs.

## Flow (happy path)

1. **Propose** — maintainer pushes the `Release-As: X.Y.Z` empty commit to
   main (C2).
2. **release-please.yml** (that push): opens/updates the release PR — bumps
   both `package.json` versions to `X.Y.Z`, rewrites the root's kernel
   dependency to the exact `X.Y.Z` (C1), drafts the CHANGELOG section (C4),
   updates `.release-please-manifest.json`, and syncs `package-lock.json`
   (see Edge: lockfile) onto the PR branch.
3. **Human review** — verify the PR touches exactly those five files; hand-
   edit the CHANGELOG section to house style; merge. The existing CI version
   guard passes naturally (bumped version is not yet a tag).
4. **release.yml** (the merge push): guard passes → annotated tag `vX.Y.Z`
   at HEAD → GitHub Release `vX.Y.Z` with the merged CHANGELOG section as
   notes → `npm ci` → `npm run build` (fresh `lib/dist`; `write-build-info`
   stamps the release commit so the artifact self-reports it, per runbook
   §4) → create the pack destination directory first (`npm pack
   --pack-destination` does not create it — runbook/ci.md gotcha) → pack
   both packages → extract-and-inspect both tarballs (kernel exports present
   in `dist/*.js`; root ships `dist/`, `templates/`, `skills/`, `opencode/`;
   zero test-helper leaks; versions correct) → **before any publish** →
   upgrade npm on the runner (≥ 11.5.1) → publish `--workspace lib` (OIDC;
   provenance automatic) → poll `npm view @arggondev/lib version` until
   `X.Y.Z` is visible (bounded retry; propagation lag — retry, never
   re-publish) → publish the root → upload both tarballs to the release.
5. `release.md` has shrunk to the exception manual; the update channel
   (story-update-delivery, stage 2) reads the result.

### Edge cases (each resolves to an acceptance criterion, a non-goal, or a named owner)

| Hunted case | Resolution |
| --- | --- |
| `package-lock.json` desyncs the release PR (root dep spec + lib version change) — `npm ci` red, PR unmergeable | release-please does not update lockfiles (googleapis/release-please#1993, open); the manifest workflow syncs it: after the action updates the PR, the same run checks out the PR branch, runs `npm install --package-lock-only`, commits and pushes the lockfile to the PR branch (A12) — machine-owned, so release-please's own later branch updates are re-synced on the next run |
| Trusted-publisher misconfiguration (filename/repo mismatch) surfaces only at publish time — npm does not validate on save | publish fails closed with an authentication error AFTER tag+release exist; recovery documented in `release.md`: fix the npmjs.com config, re-run the workflow (idempotent guard path completes the publish) (A14, A17) |
| Partial failure: lib published, CLI publish failed | both publish steps are individually idempotent — a publish that fails because the version already exists at `X.Y.Z` on the registry is treated as success, so a re-run completes without unpublishing anything (A8) |
| Propagation lag exceeds the bounded poll | the run fails after the bound; operator re-runs (guard path); the retry exists to prevent re-publish, not to wait forever (A8) |
| Tag/race: two pushes to main in quick succession (release merge + tracker flip) | `concurrency` group serializes; the second run sees `v(V)` at HEAD and completes idempotently (A5) |
| Direct push bumps the version onto an already-tagged number | `release.yml` guard fails loudly (tag exists elsewhere); the PR-only CI version guard may have been bypassed, so this is the backstop (A5) |
| Both packages proposed independently (only one side has changes) | out of scope by design: proposals are Release-As whole-lockstep proposals; the AC verifies both packages land at the same version in the PR (A2); per-package independent releases are a non-goal |
| Runner npm too old for trusted publishing | the workflow installs npm ≥ 11.5.1 explicitly before publishing (the runner pattern from the cited release-please reference workflows); Node on the runner must be ≥ 22.14.0 per npm docs (A7) |
| `repository.url` missing — trusted publishing from GitHub requires it to exactly match the repo | neither package.json has a `repository` field today (repo fact, 2026-10-01): the pipeline adds it to both before the first automated publish (A13) |
| CHANGELOG hand edit confuses the next release-please run | the manifest file, not the changelog, carries the last version; the A6 acceptance pins the heading format the next run's diff is reviewed against; a mis-positioned generated section is fixed by hand in that release PR (the PR diff makes it visible) |
| Release window tasks-validate red (derived pin = unpublished version) | resolved by the task-ci-seam-pin-tracks-release semantics this spec requires (Interplay); not implemented in this pipeline's own diff |

## Interplay

- **CI version guard** (`cli/version-guard.mjs`, PR-only, publish-relevant
  fields `name/version/private/bin/files/dependencies/engines`, fails when
  the bumped version is already a git tag): the release PR changes
  `package.json` (version + the exact kernel dependency) → the guard demands
  the version bump, which is present and not yet tagged → green. Ordinary
  post-release commits don't touch publish-relevant fields → no-op. The
  guard is unchanged by this pipeline.
- **Drift gate + `ARGGON_VERSION` pin** (`tasks-validate` in
  `.github/workflows/arggon.yml`): the pin is **derived** from the root
  `package.json` version — `task-ci-seam-pin-tracks-release`, landing
  with/before this pipeline per ADR 0018 §1. Required semantics this spec
  fixes for that derivation: when the derived version is **not yet on the
  registry** (the release PR itself; main between the release merge and
  publish + propagation), `tasks-validate` installs the latest published
  release for `arggon validate` and **skips the drift-gate comparison** with
  a printed reason — there is nothing meaningful to compare an unpublished
  pin against; in steady state (derived version == published) today's strict
  comparison is unchanged. This replaces the runbook's manual re-pin step
  and the 0.4.1-class interim red. The committed seam continues to be
  regenerated by template-changing PRs (dev-run `arggon init`), as today;
  the between-releases red while committed templates run ahead of the pinned
  release is existing, accepted behavior this spec does not change.
- **`task-ci-seam-pin-tracks-release`** owns the derivation implementation
  above; this spec is the design it implements. `task-release-workflow` must
  not land before it (ADR 0018 §1: "so publishing and pinning cannot
  diverge").
- **One-time human step (npmjs.com)**: create trusted publishers for **both**
  packages — `arggon-manager` and `@arggondev/lib` — each bound to
  repository `Arggon/ArggonManager`, **workflow filename `release.yml`**,
  no environment, and **direct `npm publish` allowed**: configurations
  created after 2026-09-03 default to stage-only publishing, so allowing
  direct publish is an explicit selection (ADR 0018 accepted direct publish
  as the initial shape; staged publishing is the upgrade path). Publishing
  stays inert — fails closed — until this setup exists (A17). Optional
  hardening after the first trusted publish (non-blocking): restrict
  token-based publishing per the npm docs.
- **Tarball consumers**: `ArggonManager/docs/ci.md` documents the
  install-from-release-asset variant next to the registry one-liner and the
  pinned-checkout flow (A15) — ADR 0018 §4's non-npm fallback.

## Acceptance

- [ ] A1 `release-please.yml` + `release-please-config.json` +
      `.release-please-manifest.json` exist as specified; evidence (action
      run or `release-please` CLI dry-run on a scratch clone) shows a
      Release-As `X.Y.Z` commit producing a release PR touching exactly:
      both `package.json` files, `package-lock.json`, `CHANGELOG.md`,
      `.release-please-manifest.json`
- [ ] A2 the release PR bumps BOTH packages to the same `X.Y.Z`, and a
      proposal with zero conventional `feat:`/`fix:` commits since the last
      release still produces it (C2 verified — no conventional-commit
      dependency)
- [ ] A3 the root `dependencies["@arggondev/lib"]` value in the release PR
      is exact (no `^`/`~`/range operator) (C1 verified)
- [ ] A4 the PR's `package.json` diff is limited to `version` +
      `dependencies["@arggondev/lib"]` (no re-serialization churn), and the
      bracket-quoted jsonpath resolves the `@`-containing key
- [ ] A5 `release.yml` is named exactly `release.yml`; fixture-or-dry-run
      evidence for the guard's four paths: untagged version → release path;
      tag at HEAD → idempotent complete; tag elsewhere → loud failure;
      unchanged version → exit 0 without publishing (C3 verified)
- [ ] A6 the merged CHANGELOG section matches the house format
      (`## [X.Y.Z] - YYYY-MM-DD`, Keep-a-Changelog `### Added`/`### Changed`/
      `### Fixed`), is hand-edited in the release PR, and a subsequent
      release leaves older sections byte-identical (C4 verified)
- [ ] A7 `release.yml` publishes via OIDC only: no `NPM_TOKEN` anywhere,
      `permissions` include `id-token: write`, npm ≥ 11.5.1 installed on the
      runner before publish, Node ≥ 22.14, provenance left automatic (no
      `--provenance` flag needed)
- [ ] A8 lib-first order with a bounded `npm view` propagation poll between
      the two publishes; both publish steps treat "version already present
      at `X.Y.Z`" as success (re-run safe); no step ever re-publishes an
      existing version (invariant 3)
- [ ] A9 before any publish, the workflow asserts tag↔version agreement:
      `v(X)` ↔ root version `X` at the published commit AND root version ==
      lib version; mismatch fails the run without publishing (invariant 1)
- [ ] A10 the run creates the annotated tag at the merged release commit and
      the GitHub Release carrying the merged CHANGELOG section as notes, and
      attaches BOTH packed tarballs (invariant 5)
- [ ] A11 tarball inspection runs before any publish and fails the run on:
      missing kernel export symbols, missing root artifacts
      (`dist/`/`templates/`/`skills/`/`opencode/`), test-helper leak
      (`test-spawn`/`test-tmp`/`pack-fixtures`), version mismatch — the
      runbook §2 checks, scripted
- [ ] A12 the release PR carries a synced `package-lock.json` (`npm ci`
      green on the PR) and the sync is automated in `release-please.yml`
      (issue #1993 workaround per the Edge table)
- [ ] A13 both `package.json` files carry a `repository` field whose URL
      exactly matches the GitHub repository before the first automated
      publish
- [ ] A14 `release.md` is the operator's exception manual: the one-time
      npmjs.com trusted-publisher setup (human; both packages; workflow
      filename `release.yml`; direct publish allowed), misconfiguration
      recovery (publish-time auth failure → fix config → re-run), partial-
      failure re-run semantics, propagation-lag retry rationale,
      rebase-over-release-commit gotcha, from-source-install shadow,
      pack-destination `ENOENT` note; the manual bump/pack/publish steps are
      removed
- [ ] A15 `ArggonManager/docs/ci.md` documents the install-from-release-asset
      variant alongside the registry one-liner (ADR 0018 §4)
- [ ] A16 both workflow YAMLs pass a linter (actionlint or equivalent) in the
      implementing PR; CI lanes green; offline-as-possible smoke evidence
      (guard paths, pack + inspect) with expected-vs-observed in the PR
- [ ] A17 the implementing PR states that publishing stays inert (fails
      closed) until the human completes the npmjs.com trusted-publisher
      setup, and that renaming `release.yml` is a breaking ops change

## Non-goals

- Auto-publish without a human-merged release proposal — no timer, no
  automatic version bump, no release PR from ordinary commits (invariant 7;
  ADR 0018 constraint).
- Conventional-commit adoption as a flow requirement (C2 exists precisely so
  it is not).
- Standalone binaries (node SEA / bun compile) — ADR 0018 non-goal.
- The `whatsnew` command — deferred per ADR 0016.
- Non-npm package managers (brew and friends) — ADR 0018 non-goal.
- Staged publishing (`npm stage publish`) as the initial shape — the
  documented upgrade path if the supply-chain bar rises (ADR 0018 §1).
- Per-package independent releases — every release is lockstep (ADR 0018 §1
  "bumps both `package.json` versions in lockstep"); a kernel-only or
  CLI-only change still releases both.
- A separate GitHub Release for `@arggondev/lib` — one repo release per
  version carries both tarballs; the kernel's release of record is its npm
  publish plus that release.
- A startup engine guard — rejected by ADR 0018 §2 (alternative C2).
- Runtime detection of the publishing workflow's filename — the name is
  pinned by the trusted-publisher config; renames are breaking and must be
  called out (ADR 0018 §1 duty).

## Sources (all accessed 2026-10-01)

- Repo facts: [ADR 0018](../adr/0018-update-delivery-and-distribution-channel.md);
  [exploration-update-delivery-016](../explorations/exploration-update-delivery-016.md);
  `release.md`; `ArggonManager/docs/ci.md`; `.github/workflows/ci.yml` +
  `arggon.yml`; `cli/version-guard.mjs`; root + `lib/package.json` (no
  `repository` field; `"@arggondev/lib": "^0.4.0"`; committed
  `package-lock.json`; tags `v0.4.0`, `v0.4.1`).
- release-please (github.com/googleapis/release-please, `main`): README
  "How do I change the version number?" (`Release-As` body trailer, empty
  commit); `docs/manifest-releaser.md` (config options incl.
  `release-as`, `skip-github-release`, `changelog-sections`, `extra-files`;
  `node-workspace` plugin description); `docs/customizing.md` (extra-files
  JSON updater / GenericJson); `src/updaters/node/package-json.ts`
  (`newVersionWithRange` preserves range prefixes); 
  `src/versioning-strategies/default.ts` (`RELEASE AS` note forces the
  version); issue #1993 (root `package-lock.json` not updated).
- release-please-action README (github.com/googleapis/release-please-action,
  `v4`): `config-file`/`manifest-file` inputs, per-package
  `release_created`/`tag_name` outputs, `gh release upload` asset pattern.
- npm docs — [Trusted publishing with OIDC](https://docs.npmjs.com/trusted-publishers)
  (page last edited 2026-09-30): npm ≥ 11.5.1 and Node ≥ 22.14.0;
  `id-token: write`; workflow-filename binding; calling-workflow validation
  for `workflow_call`/`workflow_dispatch`; post-2026-09-03 configs default
  to stage-only (direct publish is an explicit selection); automatic
  provenance (no `--provenance` flag); `repository.url` must match the repo;
  ENEEDAUTH troubleshooting; up to 10 trusted publishers per package.
- GitHub docs — [Triggering a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow):
  events triggered by `GITHUB_TOKEN` do not create workflow runs (recursion
  rule); PAT/App-token escape hatch (rejected here — stored credential).
