# 0018 Update delivery and distribution channel

- Status: Proposed
- Date: 2026-10-01
- Deciders: Gonzalo Arganaraz
- Input: [exploration-update-delivery-016](../explorations/exploration-update-delivery-016.md) (2026-10-01)

## Context

ADR 0016 decided the methodology-docs upgrade channel but deliberately left
"distribution of the tool itself (npm package / release tarballs as the update
channel)" deferred behind its own future ADR. This ADR closes that gap.

Ground truth at decision time (2026-10-01, see the exploration for evidence):

- **Releasing is a manual runbook** (`release.md`, executed verbatim for
  0.4.1): double hand version bump (root + kernel), hand-written CHANGELOG,
  build → pack both packages → extract-and-inspect tarballs → publish
  lib-then-cli (registry propagation lag: retry, never re-publish) → tag →
  global-install smoke. Every gotcha (stale `lib/dist`, from-source installs
  shadowing the registry, rebasing over the release commit) is human-held.
  `.github/workflows/` has no release workflow; a related item
  (`task-ci-seam-pin-tracks-release`) tracks the manual `ARGGON_VERSION`
  re-pin the runbook needed after 0.4.1.
- **The product has no update channel**: `doctor`'s `outdated` bucket compares
  on-disk docs against the *installed* package's templates — nothing ever
  tells an adopter a newer *published* version exists; CI-pinned adopters and
  agents get no signal at all.
- **Version skew is real**: the root declares `"@arggondev/lib": "^0.4.0"`;
  under 0.x semver a minor may break, so a published CLI can resolve a newer,
  untested kernel at install time.
- **No non-npm fallback** exists for registry-restricted adopters.

Maintainer constraints (settled in the exploration's frontier interview,
2026-10-01): serve agent-driven (CI-pinned) and human (global install)
adopters equally; any update check reads only our own public packument and is
opt-out; release automation follows the release-PR model — a human-merged
release proposal, not auto-publish on push to main.

## Decision

Four bundles, as recommended by the exploration:

### 1. Release pipeline: release PR + CI publish via OIDC trusted publishing

A release-please-style manifest (root + lib) maintains the release PR from
conventional commits. Merging it is the release: it bumps both `package.json`
versions in lockstep, writes the CHANGELOG section, and tags. A
`.github/workflows/release.yml` then publishes **lib first, then the CLI**
via npm **OIDC trusted publishing** — no stored `NPM_TOKEN`, automatic
provenance attestations — and attaches both packed tarballs to the GitHub
Release. The workflow retries the lib publish through registry propagation
lag (the runbook's gotcha, now scripted) and verifies tag ↔ shipped version
agreement. `release.md` shrinks to the operator's exception manual.

Operational duties accepted:

- The npm trusted-publisher configuration (one per package) binds to the
  workflow filename; renaming `release.yml` is a breaking ops change and must
  be called out in the PR that does it.
- The publishing runner needs npm ≥ 11.5.1 (setup-node + `npm install -g
  npm@11.5.1` pattern). Trusted publishing is configured to allow direct
  `npm publish` for both packages; staged publishing (`npm stage publish` —
  the default for configurations created after 2026-09-03) is the upgrade
  path if the supply-chain bar rises, not the initial shape.
- `task-ci-seam-pin-tracks-release` (derive the seam's `ARGGON_VERSION` pin
  from the root version) lands with or before the pipeline, so publishing
  and pinning cannot diverge.

### 2. Skew hardening: exact kernel pin, bumped in lockstep

The release PR pins the kernel exactly (`"@arggondev/lib": "0.4.1"` — caret
removed) and bumps both files together. What an adopter installs is exactly
what CI tested; the release automation owns the extra rewrite, so the cost is
zero marginal toil. No startup guard is added.

### 3. Update channel: bounded, opt-out, agent-first

A hand-rolled check (~50 lines, **no new runtime dependency**): on an
interval (default 24 h) a detached, hard-timeout (~2 s) GET reads
`registry.npmjs.org/arggon-manager/latest`; the result is cached atomically
(tmp + rename) in the OS temp dir under a format-version key. Surfacing:

- **Humans (TTY):** a deferred one-line notice after the command's own
  output, with the exact upgrade command (`npm install -g
  arggon-manager@<latest>`). Suppressed when `CI` is set or stdout is not a
  TTY.
- **Agents (JSON):** additive `update: { latest, current, cachedAt }` fields
  on `doctor --json` and `--version --json` — no `schemaVersion` bump,
  documented in `ArggonManager/docs/json-output.md` in the same PR.

Guarantees: honors `ARGGON_NO_UPDATE_CHECK=1`; offline, malformed, or 404
responses are a silent "no update known" — the check never blocks, retries,
or fails a command; a non-semver installed version (from-source installs,
`--version` prints a sha) is "cannot compare" — no notice, no false prompt.
The privacy stance (a plain unauthenticated GET of our own packument, no
identifiers, opt-out) is documented in the README in the same PR.

### 4. Non-npm distribution: GitHub Release tarballs

The release workflow attaches the two packed tarballs to the GitHub Release;
`ArggonManager/docs/ci.md` documents the install-from-release-asset variant
alongside the registry one-liner. Platform-neutral, zero new build machinery.

### Non-goals

Automatic self-update (the ecosystem tried and rejected it; notice-then-act
is the norm); standalone binaries (node SEA / bun compile); the `whatsnew`
command (stays deferred per ADR 0016); non-npm package managers (brew and
friends).

## Consequences

- A release becomes: review + merge the release PR; CI publishes, tags, and
  attaches assets. Human duty shifts from runbook execution to review.
- The update channel adds a registry GET on adopter machines (interval-gated,
  opt-out) — visible, documented, and never load-bearing.
- `doctor --json` / `--version --json` grow additive fields; the JSON contract
  doc updates in the same PR as the implementation.
- The CI drift gate interplay is preserved: CI-pinned adopters still control
  when they move; the notice/JSON fields only inform.
- Implementation decomposes into two stories after this ADR: the pipeline
  (workflow + release-please manifest + exact pin + seam-pin fix) first, then
  the update channel (spec first — it is a new command-surface behavior with
  acceptance criteria lifted from the exploration's edge-case table).

## Alternatives considered

- **A1 status quo manual runbook** — gotchas recur and scale with cadence;
  rejected.
- **A2 one-command local release** — removes transcription errors but stays
  token-based and machine-bound; superseded by CI publishing.
- **release-it / changesets** — same family as release-please; release-please
  wins on PR-as-release-proposal (matches this repo's review culture), npm
  workspace manifest support, and zero new runtime dependencies.
- **B1 rely on npm (`npm outdated -g`)** — nobody runs it; CI-pinned adopters
  and agents get nothing; rejected.
- **B3 `update-notifier` dependency** — battle-tested, but a dependency chain
  plus background-process machinery for what is ~50 lines in a CLI whose
  third-party runtime deps are `commander` only; rejected.
- **C2 startup engine guard** — per-startup complexity for a problem releases
  cause; rejected in favor of the exact pin.
- **C3 status quo caret** — silent untested kernel skew; rejected.
- **D3 standalone binaries** — doubles the build/test matrix and fights the
  templates/skills/opencode asset story; rejected for now.
- **D1 npm-only** — no fallback for registry-restricted adopters; rejected.
