---
plan_id: update-channel-015
title: Plan for Bounded opt-out update channel
spec: ArggonManager/docs/specs/spec-update-channel-015.md
status: proposed
created: 2026-10-01
---

# Plan: Bounded opt-out update channel (update-channel-015)

Derived from `ArggonManager/docs/specs/spec-update-channel-015.md` (contract,
ADR 0018 §3). Each task carries a verifiable acceptance criterion and links
back to the spec. Design-only today: this plan is the implementation backlog
filed under `story-update-channel`; no `cli/src` change belongs to the spec PR.

**Packaging note:** no packaging change — no new runtime dependency (node
built-ins only; `commander` stays the only third-party runtime dep, review-bar
security item), no new bundled assets, no `package.json` field changes. The
acceptance proof is an empty dependency diff in the implementation PR.

## T1: Check module (pure core, `cli/src/update-check.ts`)

- Constants: `UPDATE_CHECK_URL` (exact spec URL), `UPDATE_CHECK_INTERVAL_MS` =
  86 400 000, `UPDATE_CHECK_TIMEOUT_MS` = 2000, cache file name
  `arggon-update-check.json` under `os.tmpdir()`, cache `formatVersion: 1`.
- Pure/IO-split functions: `readUpdateCache` (validity matrix of the spec §
  Cache: JSON object → `formatVersion === 1` → strict-semver `latest` →
  parseable ISO `fetchedAt` → `0 ≤ now − fetchedAt ≤ interval` → not >5 min in
  the future; any miss ⇒ `null`), `writeUpdateCacheAtomic` (same-dir
  `.tmp-<pid>-<random>` + rename; failures swallowed), `fetchLatest`
  (one GET, 2000 ms abort via `AbortController`, ≤65 536-byte body read,
  strict-semver guard on `response.version`; every bad outcome ⇒ `null`, never
  a throw), strict semver parse + numeric compare (`compareSemver`), env gates
  (`updateCheckEnabled`: `ARGGON_NO_UPDATE_CHECK` and `CI` non-empty = off;
  `isCi`), and the notice renderer (`formatUpdateNotice(current, latest)` —
  the exact one-line format of spec § Surfaces).
- **Acceptance:** unit tests cover the full validity matrix (each rejected
  shape individually: foreign formatVersion, garbage JSON, non-semver latest,
  unparseable / future / stale fetchedAt), the strict-semver rejection set
  (`0.5`, `0.5.0-beta`, `v0.5.0`, `""`), compare ordering incl. equal/current-
  newer, and the gate matrix; all failures are returns of `null`, never throws
  (spec invariants 1–3, AC 1/2/9/10/11).

## T2: Detached lifecycle + atomic write under concurrency

- Spawn the fetch detached from the triggering command (stdio-ignored child or
  equivalent) so the triggering command's exit does not kill it; the child
  performs
  `fetchLatest` then `writeUpdateCacheAtomic`; the parent never awaits it and
  at most one fetch fires per process. Cache writes only happen with a valid
  response; on `CI`/opt-out no child is spawned at all.
- **Acceptance:** an integration test runs a stub CLI command against a local
  registry stub, exits immediately, and the cache file is present and valid
  afterward (detached survival, AC 5/14); a 10-writer concurrency test on one
  real temp dir leaves a valid cache (AC 3); the blackholed-network case
  completes without changing command output/exit code (AC 4).

## T3: JSON surfaces (`doctor --json`, `--version --json`)

- `runDoctor`'s result gains the always-present `update: { latest, current, cachedAt }` (spec § Surfaces table; `current` from the package version —
  never `null`). The root `--version` handling learns `--json`: the standard
  success envelope `{ ok, schemaVersion: 1, conventionVersion, command: "version", version, update }` (human `--version` output byte-unchanged).
  Doctor human output unchanged (golden test). The check's read happens before
  the command's work; the fetch trigger honors the spec's gates (not `mcp`).
- **Acceptance:** envelope probes on initialized + non-initialized fixtures
  match the spec shapes key-for-key (absent-vs-unknown = all keys present,
  `null` when unknown); `--version` (no `--json`) output identical to pre-change
  (AC 12, AC 7).

## T4: Deferred notice

- After a successful (exit-0) non-`mcp`, non-`--json` command, print the
  rendered one-liner to **stderr** when: stdout is a TTY, `CI` unset/empty, a
  valid fresh cache exists, and `latest > current` with both strictly
  semver-comparable (cannot-compare ⇒ silent). Exactly once per invocation,
  after all of the command's own output, exit code untouched.
- **Acceptance:** a TTY-matrix test (each gate flipped) asserts presence/
  absence and the exact line format with real version values; `arggon mcp` and
  `--json` runs never emit it; failed commands never emit it (AC 13, AC 7).

## T5: Docs in the same PR (`ArggonManager/docs/json-output.md` + README)

- `json-output.md`: additive `update` rows in the `doctor` section, a new
  `version` command section (envelope of spec § Synopsis), and `version` added
  to the envelope-table `command` enum — additive only, `schemaVersion`
  unchanged, with the absent-vs-unknown (`null` = unknown, keys never omitted)
  semantics stated.
- `README`: the update channel paragraph — exact network behavior (one
  unauthenticated GET of our own packument, no identifiers — AC 6), the
  `ARGGON_NO_UPDATE_CHECK` opt-out, the `CI` behavior, the notice and its
  gates, and the cache file location/format.
- **Acceptance:** grep of `update`, `version`, `ARGGON_NO_UPDATE_CHECK`,
  `cachedAt` across both docs matches the implemented behavior; `json-output.md`
  `command` enum contains `version`; docs-only drift check (`grep` the new
  fields/flags) finds no statement the code makes false.

## T6: Gates, smoke, status flip (closes the spec)

- Run: `npm test`, `npm run lint`, `npm run build`, `arggon validate --json`,
  `arggon spec validate`, and `arggon spec analyze --baseline ArggonManager/spec-analyze-baseline.json` (exit 0 — no NEW findings; the
  committed baseline is the gate reference).
- Smoke evidence for the review verdict (blocking bar): against a local
  registry stub on a fixture tree — cold run (no cache): command unchanged,
  cache appears after exit; warm run: notice line on TTY, `update` fields in
  both JSON envelopes; then the hostile/404/`CI`/opt-out probes of spec AC
  1/2/7. Expected vs observed recorded in the verdict.
- Flip spec + plan `status: implemented` in the same PR.
- **Acceptance:** all gates green; smoke evidence in the verdict; spec AC 1–15
  each mapped to a test or probe in the PR description.
