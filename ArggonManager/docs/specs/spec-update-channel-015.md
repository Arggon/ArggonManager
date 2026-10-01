---
spec_id: update-channel-015
title: Bounded opt-out update channel
status: proposed
created: 2026-10-01
---

# Spec: Bounded opt-out update channel (update-channel-015)

## Purpose

The product has no update channel: `arggon doctor`'s `outdated` bucket compares
on-disk docs against the *installed* package's templates, and `arggon --version`
self-reports version + commit without ever consulting the registry — so an
adopter (human or agent, CI-pinned or globally installed) is never told that a
newer *published* version exists. [ADR 0018](../adr/0018-update-delivery-and-distribution-channel.md)
§3 decides the fix: a bounded, opt-out, agent-first check, hand-rolled
(~50 lines, **no new runtime dependency** — the CLI's only third-party runtime
dependency stays `commander`). This spec is the reviewable contract for that
check; acceptance criteria are lifted row-by-row from the edge-case table in
[exploration-update-delivery-016](../explorations/exploration-update-delivery-016.md)
(§ Edge-case coverage maps every row to a criterion, a non-goal, or another
bundle).

Invariants, in shorthand: **the check never blocks, retries, or fails a
command**; **no new runtime dependency**; **opt-out honored**
(`ARGGON_NO_UPDATE_CHECK`); **no network on CI machines**; **`--json` stdout
stays exactly one JSON object** (a notice never interleaves with it); **the
registry response is untrusted input** (validated before use, never interpolated
raw into human output); **schemaVersion stays `1`** (both new JSON pieces are
additive). Failures of every kind — offline, timeout, non-JSON body, 404,
garbage cache — degrade to "no update known", never to an error.

## Synopsis

No new command. Two existing surfaces grow, one human line appears:

```bash
arggon doctor --json
#   ... existing envelope fields unchanged, plus:
#   "update": { "latest": "0.5.0", "current": "0.4.1",
#               "cachedAt": "2026-10-01T09:30:00.000Z" }   (fields always present; null = unknown)

arggon --version --json
#   NEW envelope (plain text today):
#   { "ok": true, "schemaVersion": 1, "command": "version",
#     "conventionVersion": 5, "version": "0.4.1 (bd3be214, main)",
#     "update": { "latest": "0.5.0", "current": "0.4.1", "cachedAt": "..." } }

arggon <any command>          # interactive, non-CI, exit 0 → after the command's own output, on stderr:
#   arggon update available: 0.4.1 → 0.5.0 — run: npm install -g arggon-manager@0.5.0
```

Environment gates (all exact, testable values):

| Gate                        | Effect                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARGGON_NO_UPDATE_CHECK` set to a non-empty value | No registry GET, no cache write. `opt-out = value !== "" `; `ARGGON_NO_UPDATE_CHECK=1` is the documented form. Cache *reads* are unaffected (they touch no network). |
| `CI` set to a non-empty value | The registry GET never runs and no cache entry is written. The notice is suppressed. The JSON `update` fields are still present and report a fresh local cache if one exists, otherwise explicit unknown (`null`). |
| stdout is not a TTY         | Notice suppressed (agents, pipes). JSON fields unaffected. Does **not** gate the GET.                                                                     |
| `--json` set                | Notice suppressed unconditionally (JSON stdout must stay exactly one object), on every command including `doctor`.                                        |
| command is `arggon mcp`     | Neither the GET nor the notice runs (stdio JSON-RPC protocol surface — any extra byte corrupts the protocol).                                             |
| command exited non-zero     | Notice suppressed (a failing command is not an upgrade-ad slot). The GET trigger is unaffected.                                                            |

## Design

### Check lifecycle: interval-gated, detached, hard-timeout

1. **Command path (synchronous, local-only):** at CLI start (before the
   command's own work), read the cache file (§ Cache) from the OS temp dir. This
   is one `stat` + small file read — no network, no locks, no retries. The
   command then proceeds exactly as without the feature.
2. **Fetch trigger:** if the check is enabled (opt-out and `CI` gates above),
   the command is not `mcp`, and no valid cache entry exists, spawn the fetch.
3. **The fetch is detached:** it is never awaited by the triggering command and
   is not killed by the command's exit — a detached child process (stdio
   ignored) or an equivalent mechanism. Consequence: the cache is populated for
   *future* commands, never by waiting on the current one. A cold run (no
   cache) completes without waiting and shows no notice; the next run within
   the interval window sees the fetched entry. The implementation owns the
   mechanism, subject to this observable contract and to the invariants above.
4. **The GET:** one plain `GET https://registry.npmjs.org/arggon-manager/latest`
   (exact URL; the package is `arggon-manager`). No query parameters, no body,
   no credentials, no custom identifier headers — nothing that could leak more
   than "this IP asked for this public document". Hard timeout: **2000 ms**
   (the "~2 s" of ADR 0018 §3) via request abort; the interval default is
   **86 400 000 ms (24 h)** — a named constant in the implementation module
   (`UPDATE_CHECK_INTERVAL_MS`), not user-configurable (§ Non-goals). The fetch
   fires at most once per process, and only when the cache holds no valid
   entry.
5. **Response handling (untrusted input):** read at most 65 536 bytes of the
   body; parse as JSON; take `response.version`. The entry is usable only when
   `version` is a non-empty string matching `^\d+\.\d+\.\d+$` (strict semver,
   no prerelease/build suffix — `latest` is npm's stable dist-tag). Any other
   outcome — non-2xx status (404/yanked), non-JSON or HTML body (proxy), a
   `version` that fails the strict pattern, truncation, timeout, or any network
   error — exits silently: no notice, no JSON value, **no cache write**. No
   retry, ever.
6. **Cache write:** on a valid response, write atomically (§ Cache). A write
   failure (read-only temp dir, full disk) is silent — the cache is advisory.

### Cache: location, format, atomicity, validity

- **Location:** a single file, `arggon-update-check.json`, directly in
  `os.tmpdir()`. Nothing else is ever written; the repo tree is never touched.
- **Format (version 1):** `{ "formatVersion": 1, "latest": "0.5.0",
  "fetchedAt": "2026-10-01T09:30:00.000Z" }` — `latest` strict semver,
  `fetchedAt` ISO-8601 UTC. The `formatVersion` key is the migration contract:
  a cache file whose `formatVersion` differs from the running CLI's expected
  value (`1`) is a **miss** — overwritten by the next successful fetch, never
  an error (§ Edge-case coverage, persistence row).
- **Atomicity:** write to a temp file in the same directory
  (`arggon-update-check.json.tmp-<pid>-<random>`), then `rename` onto the final
  name. Concurrent CLI runs therefore see either the old or the new complete
  file, never partial content; the last successful rename wins and the cache is
  advisory only (no process ever waits on another's write).
- **Validity rule (all must hold, checked on every read):** parseable JSON
  object → `formatVersion === 1` → `latest` matches `^\d+\.\d+\.\d+$` →
  `fetchedAt` parses as an ISO-8601 date → `0 ≤ now − fetchedAt ≤ 86 400 000`
  → and `fetchedAt` is not more than 300 000 ms (5 min) in the future (clock
  skew / garbage timestamp = expired). Any failure ⇒ the entry is treated as
  absent: JSON fields report `null` (explicit unknown), no notice, and (when
  the check is enabled, non-CI) a fetch is triggered. An expired-but-valid
  entry is never deleted on the read path — it is replaced by the next
  successful fetch.

### Surfaces

#### Agent surface: additive JSON fields (no `schemaVersion` bump)

Both payloads carry an `update` object that is **always present** with all
three keys **always present** — `null` is the explicit "unknown" value; keys
are never omitted (absent-vs-unknown is decided by shape, not by `in` checks):

| Field      | Type            | Meaning                                                                                                                                                             |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `latest`   | `string \| null` | Newest published version known from a valid cache entry; `null` when no valid entry exists (absent, expired, foreign format, or the check never ran — e.g. CI with no cache). |
| `current`  | `string`        | The installed package's own version string (`package.json` version — the same string `arggon --version` starts with, without build metadata). Always a string; never `null`. |
| `cachedAt` | `string \| null` | ISO-8601 UTC `fetchedAt` of the cache entry `latest` came from; `null` iff `latest` is `null`. The consumer judges freshness by comparing it with now — no locale-sensitive formatting anywhere. |

- `doctor --json`: the `update` object is added to the existing doctor payload
  on every doctor invocation — initialized or not (`root: null` trees report it
  too; the check is install-level, not tree-level). All existing fields, the
  exit-0 charter, and `DOCTOR_FAILED` semantics are unchanged.
- `--version --json`: today the root `--version` flag prints plain text and
  `--json` is ignored. This spec defines the JSON surface: the standard success
  envelope — `{ ok: true, schemaVersion: 1, conventionVersion, command:
  "version", version, update }` where `version` is the same string the human
  flag prints (build version incl. git identity) and `conventionVersion` is
  read from the tracker `.convention.yml` walk-up from cwd (`0` when absent,
  like `hello`). `arggon --version` without `--json` prints exactly what it
  prints today. This is a **new** payload, not a shape change of an existing
  one — additive within `schemaVersion: 1`, documented in
  `ArggonManager/docs/json-output.md` (new `version` command section + the
  `command` enum) in the same PR as the implementation.
- The `update` fields are **reported, never load-bearing**: no command's
  behavior, exit code, or output depends on them.

#### Human surface: the deferred one-line notice

- Printed to **stderr** (stdout stays parseable) **after** the command's own
  output, only when **all** hold: the command exited 0; stdout is a TTY; `CI`
  is unset/empty; `--json` is not set; the command is not `mcp`; a **valid**
  cache entry exists; `current` parses as strict semver and `latest > current`
  (strict semver comparison, numeric by major/minor/patch — a from-source or
  newer-than-published install compares `>=` and stays silent).
- Exact text (single line, values are the validated semver strings — the cache
  value can never contain anything else, so the line cannot be injected through
  the cache):

  ```
  arggon update available: <current> → <latest> — run: npm install -g arggon-manager@<latest>
  ```

- "Deferred" means it never precedes or interleaves with the command's own
  output; the notice is the last thing the process writes. It never changes the
  exit code, and it never appears more than once per invocation.
- Doctor's human report is **unchanged** — the generic notice already covers
  interactive doctor runs; adding a second in-report line would duplicate it.

### Version comparison

- `current` = `package.json` version of the running install (always a string;
  the reader's `0.0.0` fallback is itself strict semver and comparable).
- `latest` (when known) is strict semver by construction (§ validity rules).
- Comparison: numeric `major.minor.patch`. If `current` does not match the
  strict pattern (custom/tampered installs; defensive — npm-enforced
  `package.json` versions always match), the state is **cannot-compare**: no
  notice, and the JSON still reports both strings so an agent can decide.
- Prerelease-aware comparison is out of scope (§ Non-goals).

### Hard invariants (the never-list)

1. Never blocks a command: the command path performs no network I/O and never
   awaits the fetch. An offline or blackholed machine cannot make any command
   slower to a human degree, fail, or change its output because of this check.
2. Never retries, never queues: at most one fetch attempt per process; a failed
   attempt leaves no state that would alter the next command.
3. Never fails a command: every failure above the CLI is silent
   ("no update known"); the check contributes no error path to any command.
4. Never writes outside `arggon-update-check.json` (and its same-directory
   temp file) in the OS temp dir.
5. Never runs the GET on a CI machine (`CI` non-empty) — shared runners get no
   network call and no cache write; the JSON fields report explicit unknown.
6. Never prints the notice into `--json` stdout, into `arggon mcp`'s stdio
   protocol, or before/interleaved with a command's own output.
7. Never interpolates an unvalidated registry or cache value into human output.
8. Never adds a runtime dependency: node built-ins only (fetch/http, fs, os,
   path, child_process).
9. Never bumps `schemaVersion` for these additive fields.

## Edge-case coverage

Every row of the exploration's edge-case table
([exploration-update-delivery-016](../explorations/exploration-update-delivery-016.md)),
disposed:

| Dimension             | Hunted case                                   | Disposition                                                                                                                             |
| --------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| hostile input         | registry returns non-JSON / HTML (proxy)      | **AC 1** — parse-guard: treated as "no update known", silent, no cache write                                                             |
| error states          | 404 / yanked package                          | **AC 2** — same as no-update-known; notice suppressed, JSON `null`                                                                       |
| concurrency           | many CLI runs writing the cache               | **AC 3** — atomic write (temp + rename, same dir), last rename wins, readers see complete files only; cache is advisory                  |
| failure/timeout       | offline / air-gapped machine                  | **AC 4** — detached fetch with a 2000 ms hard abort; the command never blocks or fails; `ARGGON_NO_UPDATE_CHECK` documented in README in the implementation PR |
| perf                  | check adds startup latency                    | **AC 5** — interval-gated (24 h), cached result; the command path reads one local small file; cold runs never wait (no network on the command path) |
| privacy               | what leaves the machine                       | **AC 6** — a plain unauthenticated GET of our own packument only; no query params, no body, no identifier headers, no telemetry; exact behavior documented in README in the same PR |
| environment           | CI / npm-script contexts                      | **AC 7** — `CI` set ⇒ no GET, no cache write, notice suppressed; non-TTY stdout ⇒ notice suppressed; JSON `update` fields always present (explicit unknown without a fresh cache) |
| authn/authz           | credentials on the check path                 | **AC 8** — none exist to leak: no credentials are ever read, sent, or stored; authenticated registry paths are a non-goal (NG 3)          |
| platform              | from-source installs (sha in `--version`)     | **AC 9** — a non-strict-semver comparison state is cannot-compare: no notice, no false prompt; JSON still reports the strings            |
| time/locale           | stale or clock-skewed cache timestamp         | **AC 10** — `cachedAt` travels with the entry; unparseable or >5-min-future timestamp = expired ⇒ miss + re-fetch; ISO-8601 UTC only, never locale-formatted |
| persistence/migration | cache format changes across CLI versions      | **AC 11** — `formatVersion` key; unparseable or foreign-version cache = miss ⇒ re-fetch, never an error                                   |
| upgrade/data-loss     | lib↔CLI skew on adopter install               | **Out of this spec** — owned by ADR 0018 §2 (exact kernel pin) and the release-pipeline story                                            |
| observability         | agents need the signal                        | **AC 12** — additive `update` object on `doctor --json` and `--version --json`; `ArggonManager/docs/json-output.md` updated in the same PR |
| security              | publish credential theft                      | **Out of this spec** — owned by ADR 0018 §1 (OIDC trusted publishing, release-pipeline story)                                            |
| ops                   | workflow name drift breaks OIDC binding       | **Out of this spec** — pipeline concern (ADR 0018 §1); the update channel has no runtime workflow awareness                              |

## Non-goals

1. **Automatic self-update** — notice-then-user-acts only (ADR 0018 §Non-goals;
   the ecosystem norm per the exploration).
2. **The `whatsnew` command** — stays deferred per ADR 0016.
3. **Authenticated registry paths / private registries** — the check is a plain
   unauthenticated GET of the public `arggon-manager` packument; nothing else.
4. **Check-on-CI** — CI machines never run the GET (invariant 5); there is no
   override flag to force it.
5. **A user-configurable interval** — 24 h is a constant; an override is a new
   config surface that ADR 0018 did not decide. (Testing manipulates
   timestamps/cache files, not a flag.)
6. **Prerelease-aware comparison** — `latest` is the stable dist-tag; installs
   reporting a prerelease `current` fall into cannot-compare (no notice).
7. **A notice line inside `doctor`'s human report**, or any notice on failed
   commands — the single generic deferred notice is the whole human surface.
8. **A channel for `@arggondev/lib`** — the kernel rides the CLI's releases;
   skew is bundle C1's problem (exact pin), not the channel's.

## Acceptance

- [ ] **AC 1 — hostile body:** a registry response that is non-JSON / HTML / over 65 536 bytes / carrying a non-strict-semver `version` results in no notice, `update.latest === null`, and no cache write; the command's own output and exit code are unchanged (fixture registry stub per case).
- [ ] **AC 2 — 404 / yanked:** a 404 (or any non-2xx) response is identical to AC 1's outcome — silent, `null` fields, no cache write, no retry.
- [ ] **AC 3 — concurrent writers:** N parallel CLI runs against one temp dir leave a parseable, valid cache file (each write is temp-file + rename in the same directory); no reader ever observes partial content; a writer's failure to write is silent and non-fatal.
- [ ] **AC 4 — offline/timeout:** with the network blackholed and an empty cache, `arggon --version` and `arggon doctor` complete with output identical to an online run, no notice, no error, and no multi-second wait attributable to the check (the 2000 ms abort lives in the detached fetch, off the command path).
- [ ] **AC 5 — interval + cache:** with a valid fresh cache entry present, no fetch is triggered (asserted via the stub registry receiving zero requests) and the command path performs only the local cache read; with no valid entry and the check enabled, exactly one detached fetch is triggered per invocation.
- [ ] **AC 6 — privacy:** the emitted request is `GET https://registry.npmjs.org/arggon-manager/latest` with no query string, no body, no credentials, and no identifier headers (stub-registry assertion); the README shipped in the implementation PR documents the exact network behavior, the opt-out variable, and the cache file.
- [ ] **AC 7 — environment matrix:** `CI=""`+TTY → notice possible; `CI=1` → no GET (stub sees nothing), no cache write, notice suppressed, JSON fields present (`null` without a fresh cache); non-TTY stdout → notice suppressed with the GET unaffected; `--json` → notice never printed on any command.
- [ ] **AC 8 — no credentials:** no code path reads npm/auth state or sends any credential (code inspection + the AC 6 stub assertion that the request carries no auth headers).
- [ ] **AC 9 — cannot-compare:** with `current` not matching `^\d+\.\d+\.\d+$` (simulated), no notice is printed even when a fresh cache holds a greater `latest`; `update.current` still reports the string; `current >= latest` (equal or newer install) prints no notice.
- [ ] **AC 10 — timestamps:** `cachedAt` is the entry's ISO-8601 UTC fetch time; an unparseable `fetchedAt`, or one >5 min in the future, or older than 24 h ⇒ miss (JSON `null`s; fetch triggered when enabled); no locale-dependent formatting anywhere in the surfaces.
- [ ] **AC 11 — format version:** a cache file with `formatVersion: 999`, invalid JSON, or wrong shape is a miss — overwritten by the next successful fetch, never an error to any command.
- [ ] **AC 12 — JSON surfaces:** `doctor --json` gains the always-present 3-key `update` object on initialized and non-initialized trees alike; `arggon --version --json` emits the exact envelope of § Synopsis (`command: "version"`, build-version string, `update` object); `arggon --version` (no `--json`) is byte-identical to today; `schemaVersion` stays `1`; `ArggonManager/docs/json-output.md` documents both in the same PR.
- [ ] **AC 13 — notice UX:** on an eligible run (exit 0, TTY stdout, non-CI, no `--json`, valid cache, `latest > current`) the process writes exactly one stderr line, `arggon update available: <current> → <latest> — run: npm install -g arggon-manager@<latest>`, after all of the command's own output, without changing the exit code; every gate in § Synopsis flips it off.
- [ ] **AC 14 — invariants hold:** no new runtime dependency lands (package.json diff empty of dependencies); the only file written is the cache (temp-dir inspection); a fetch-triggering run on a cold cache never waits on the fetch (the detached child, not the command, owns the 2000 ms window).
- [ ] **AC 15 — unit + integration tests travel with the implementation** (validity matrix, gate matrix, atomic-write test on a real temp dir, strict-semver rejection set, envelope probes), and smoke evidence (expected vs observed against a local registry stub) lands in the review verdict.
