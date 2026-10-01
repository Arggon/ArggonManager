---
exploration_id: update-delivery-016
title: Update delivery and adopter install ergonomics
status: open
created: 2026-10-01
---

# Exploration: Update delivery and adopter install ergonomics (update-delivery-016)

Problem: how do adopters of `arggon-manager` learn that a new version exists,
get it installed with minimal friction, and how does this repo ship versions
without a manual, error-prone runbook? Investigated 2026-10-01 in code
(`cli/src/doctor.ts`, `cli/src/build-info.ts`, `.github/workflows/`,
`release.md`, `ArggonManager/docs/ci.md`, both `package.json` files) and
against current ecosystem sources. Feeds [ADR 0016](../adr/0016-adopter-upgrade-channel.md)'s
explicitly deferred "stage E": distribution of the tool itself.

Scope (settled with the maintainer, 2026-10-01): four bundles —
**(A)** release-pipeline automation, **(B)** in-product update channel,
**(C)** kernel↔CLI version-skew hardening, **(D)** non-npm distribution.
Primary adopters: agent-driven repos (CI-pinned installs) and human
maintainers (global installs), weighted equally.

## Classification

Greenfield — no existing release/update flow to read: the release pipeline is
a human runbook, not code, and the product has no update channel. Others will
depend on it (adopters' install/upgrade paths, the CI drift gate, the future
distribution ADR), so the full protocol applies; complexity discovered
mid-flight upgrades the classification, nothing downgrades it.

## Current mechanics (facts, not proposals)

- Two public npm packages since 0.4.0: `arggon-manager` (bin + templates +
  skills + `opencode/`) and `@arggondev/lib` (kernel); the root declares
  `"@arggondev/lib": "^0.4.0"` — a caret range on 0.x, so any 0.4.x lib
  release may be resolved for an already-published CLI (skew surface).
- Releasing is a **fully manual runbook** (`release.md`, executed verbatim for
  0.4.1 on 2026-10-01): manual double version bump (root + lib), manual
  CHANGELOG section, build → pack both → extract-and-inspect tarballs →
  publish lib first (registry propagation lag: retry, don't re-publish) → tag
  → global-install smoke. Recorded gotchas: stale `lib/dist` ships stale
  exports; a long-lived from-source install shadows the registry (its
  `--version` prints a git sha); parallel branches must rebase over the
  release commit (the CI version guard compares against tags).
- `.github/workflows/` has **no release workflow** (only `arggon.yml`,
  `auto-done.yml`, `ci.yml`); the CI version guard only enforces
  bump discipline for publish-relevant diffs.
- The product has **no update channel**: `doctor`'s `outdated` bucket compares
  on-disk docs against the _installed_ package's templates — it knows nothing
  about newer _published_ versions; `arggon --version` self-reports
  version + commit (write-build-info) but never consults the registry.
  `whatsnew --since <v>` is explicitly deferred (ADR 0016).
- Install surfaces today: `npm install -g arggon-manager` (floats `latest`);
  CI-pinned `npm install -g "arggon-manager@$ARGGON_VERSION"` + drift gate
  (committed seam must match the pin); pack-from-checkout for development.

## Frontier rounds

- **Round 1 (maintainer interview, 2026-10-01):** outcome/users — optimize for
  agent-driven repos and human maintainers equally; scope — all four bundles
  in play; constraints — update check must be an opt-out registry check
  (no phone-home beyond reading our own packument); rollout — CI release,
  human-triggered merge (release-please style), OIDC trusted publishing.
- **Round 2 (resolved from grounding):** data/interfaces — any new field is
  additive to the `--json` contract (`schemaVersion` unchanged; additive
  fields documented per the docs-maintenance table); failure/edge — see the
  edge-case table below; ops/security — publishing must drop the long-lived
  npm token in favor of OIDC; one workflow owns the release.

## Candidates

### Bundle A — release pipeline automation

- **A1. Status quo manual runbook.** Zero new machinery; every gotcha stays
  human-held (and gotchas recur: stale `lib/dist`, wrong publish order).
- **A2. One-command local release script.** Collapse the runbook into a
  scripted `npm run release` (bump, changelog check, pack, inspect, publish
  lib→cli, tag). Removes transcription errors but keeps the release
  machine-dependent and token-based.
- **A3. Release PR + CI publish (recommended).** A release-please-style
  manifest maintains a release PR from conventional commits; merging it bumps
  both packages, writes the CHANGELOG, tags, and a GitHub Actions workflow
  publishes lib-then-cli via **OIDC trusted publishing** (tokenless,
  automatic provenance), attaching the packed tarballs as GitHub Release
  assets (bundle D2 rides along). Alternates in the same family:
  release-it / changesets — release-please wins on: PR-as-release-proposal
  (matches this repo's review culture), npm workspace manifest support, and
  zero new runtime dependencies.

### Bundle B — in-product update channel

- **B1. Nothing (rely on npm).** `npm outdated -g` works but nobody runs it;
  CI-pinned adopters never hear about releases; agents get no signal.
- **B2. Hand-rolled bounded check (recommended).** ~50 lines, no new
  dependency: on an interval (default 24 h), read
  `https://registry.npmjs.org/arggon-manager/latest` in a detached,
  hard-timeout (≈2 s) fetch; cache the result under the OS temp dir; surface
  it as (a) a TTY-only, deferred one-line notice with the exact upgrade
  command, and (b) additive `--json` fields on `doctor`/`--version`
  (`update: { latest, current, cachedAt }`) — the agent-shaped channel.
  Honors `ARGGON_NO_UPDATE_CHECK=1` (and never runs when `CI` is set).
- **B3. `update-notifier` dependency.** Battle-tested (7.x, ~6k dependents)
  but adds a dependency chain to a deliberately dependency-light CLI
  (third-party runtime deps today: `commander` only, beside the first-party
  `@arggondev/lib` workspace package); its behavior (background child
  process, config caching) is more machinery than B2 needs.

### Bundle C — kernel↔CLI skew hardening

- **C1. Exact lib pin at release (recommended).** The release PR pins
  `"@arggondev/lib": "0.4.1"` (exact, caret removed) and bumps both files in
  lockstep; what you install is exactly what was tested. Cost is one extra
  rewrite per release, which the release automation (A3) owns anyway.
- **C2. Startup engine guard.** Keep the caret, add a runtime check that the
  resolved lib matches the CLI's tested minor. Moves complexity into every
  startup for a problem releases cause; rejected.
- **C3. Status quo caret.** Adopter installs silently pick up newer 0.4.x
  libs with untested kernel changes; rejected (skew is real under 0.x
  semver, where minors may break).

### Bundle D — non-npm distribution

- **D1. npm-only.** Registry outage/air-gapped adopters have no fallback
  except cloning the repo.
- **D2. GitHub Release assets (recommended, rides with A3).** Attach both
  packed tarballs to the release; document the
  `npm install -g <tarball>` variant (ci.md already documents the pack
  flow — the release page just hosts its output). Cheap, platform-neutral.
- **D3. Standalone binaries (node SEA / bun compile).** Removes the Node
  floor for adopters but doubles the build/test matrix and fights the
  templates/skills/opencode asset story; rejected for now.

## Criteria

1. **Adopter effort** — fewer steps, fewer surprises, no silent staleness.
2. **Agent ergonomics** — every signal must exist as additive `--json`.
3. **Supply-chain trust** — no long-lived publish tokens; provenance on.
4. **Maintenance cost** — no new runtime dependencies; one workflow, not N.
5. **Determinism** — what an adopter installs is what CI tested (skew).
6. **Privacy/offline safety** — the check reads our own public packument,
   honors opt-out, never blocks or fails a command.

## Findings

- npm **trusted publishing with OIDC is GA** (2025-07-31): tokenless publish
  from GitHub Actions, automatic provenance attestations, requires npm CLI
  ≥ 11.5.1 on the publisher; configurations created after 2026-09-03 default
  to staged publishing (`npm stage publish`) (source:
  [github.blog/changelog 2025-07-31](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/),
  [docs.npmjs.com/trusted-publishers](https://docs.npmjs.com/trusted-publishers),
  accessed 2026-10-01).
- **release-please** supports npm-workspace monorepos via manifest config
  (per-package release PRs / publish matrix) — reference:
  [open-feature/js-sdk release workflow](https://github.com/open-feature/js-sdk/blob/main/.github/workflows/release-please.yml)
  (accessed 2026-10-01).
- **update-notifier** (7.x, ~6k dependents) codified the ecosystem lesson:
  _automatic self-update was tried and rejected; notice-then-user-acts is the
  norm_ — async cached check, TTY-only, deferred message (source:
  [npmjs.com/package/update-notifier](https://www.npmjs.com/package/update-notifier),
  accessed 2026-10-01).
- Global installs have no semver range: `npm update -g` / reinstall target
  the `latest` dist-tag; `npm outdated -g` compares installed vs `latest`
  (source: [docs.npmjs.com](https://docs.npmjs.com/cli/v12/commands/npm-update),
  accessed 2026-10-01).
- Repo facts: release cadence 0.4.0 (2026-09-22) → 0.4.1 (2026-10-01); root
  depends on `@arggondev/lib: ^0.4.0` (skew surface); doctor's `outdated`
  bucket is template-relative only; `release.md` documents the lib-first
  publish order and its propagation-lag gotcha (repo, 2026-10-01).

## Edge-case hunt

| Dimension             | Hunted case                               | Resolution                                                                                                                                               |
| --------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hostile input         | registry returns non-JSON / HTML (proxy)  | parse-guard → treat as "no update known", never an error (spec AC)                                                                                       |
| error states          | 404 / yanked package                      | same as no-update; notice suppressed (spec AC)                                                                                                           |
| concurrency           | many CLI runs writing the cache           | atomic write (tmp + rename); cache is advisory only (spec AC)                                                                                            |
| failure/timeout       | offline / air-gapped machine              | hard ~2 s timeout, detached check; command never blocks or fails; `ARGGON_NO_UPDATE_CHECK=1` opt-out documented (spec AC)                                |
| perf                  | check adds startup latency                | interval-gated (24 h default), cached result, deferred/async; cold runs never wait (spec AC)                                                             |
| privacy               | what leaves the machine                   | a plain GET of our own public packument; no identifiers, no telemetry; exact behavior documented in README (spec AC)                                     |
| environment           | CI / npm-script contexts                  | notice suppressed when `CI` is set or stdout is not a TTY; `--json` fields always available (spec AC)                                                    |
| authn/authz           | credentials on the check path             | none — plain unauthenticated GET of a public packument; no credentials exist to leak; any authenticated registry path is a non-goal                      |
| platform              | from-source installs (sha in `--version`) | non-semver version → "cannot compare": no update notice, no false prompt (spec AC; release.md gotcha)                                                    |
| time/locale           | stale or clock-skewed cache timestamp     | `cachedAt` travels with the cache; unparseable/garbage timestamp counts as expired → re-fetch; no locale-sensitive formatting (spec AC)                  |
| persistence/migration | cache format changes across CLI versions  | cache file carries a format version key; unparseable or foreign-version cache = miss, re-fetch — never an error (spec AC)                                |
| upgrade/data-loss     | lib↔CLI skew on adopter install           | bundle C1 exact pin; release PR bumps both in lockstep (spec AC, lifted into the ADR/spec)                                                               |
| observability         | agents need the signal                    | additive `update` object on `doctor --json` / `--version --json`; docs table updated same PR (spec AC)                                                   |
| security              | publish credential theft                  | A3: OIDC trusted publishing, no stored `NPM_TOKEN`; tags remain the release of record (spec AC)                                                          |
| ops                   | workflow name drift breaks OIDC binding   | trusted-publisher config pins the workflow filename; renaming the workflow is part of the ADR's consequences (non-goal: runtime workflow-name detection) |

## Recommendation

Stage it, keeping every artifact additive:

1. **Stage 1 — pipeline (A3 + C1 + D2):** release-please manifest (root +
   lib) maintaining the release PR; the release PR pins the kernel exactly
   and writes the CHANGELOG; a `release.yml` workflow publishes
   lib-then-cli on merge via OIDC trusted publishing, tags, and attaches
   both tarballs as GitHub Release assets; `release.md` shrinks to the
   operator's exception manual.
2. **Stage 2 — update channel (B2):** bounded, opt-out registry check with
   cached result; TTY notice for humans; additive `update` fields on
   `doctor --json` / `--version` for agents; never in CI, never blocking.
3. **Non-goals:** automatic self-update; standalone binaries (D3); `whatsnew`
   command (stays deferred per ADR 0016); non-npm package managers.

The decision lands as its own ADR (distribution was deliberately left to a
future ADR by ADR 0016 — this exploration is the input to it).

## Decision

<!-- ADR reference placeholder: ArggonManager/docs/adr/0018-<slug>.md once the ADR lands. -->
