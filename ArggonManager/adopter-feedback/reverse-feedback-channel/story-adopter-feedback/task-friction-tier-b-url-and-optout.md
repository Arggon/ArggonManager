---
type: task
status: in_progress
id: task-friction-tier-b-url-and-optout
title: Tier B prefilled publish URL and the friction opt-out keys
assignee: arggon-delivery-lead
branch: feat/task-friction-tier-b-url-and-optout
parent: story-adopter-feedback
labels: [method]
priority: p2
created: "2026-10-02"
updated: "2026-10-11"
claimed_at: "2026-10-11T17:12:43.982Z"
depends_on: [task-friction-dedupe-and-report]
worktree_path: /home/arggon/Projects/ArggonManager-task-friction-tier-b-url-and-optout
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-tier-b-url-and-optout.md
  Leaves live only under a story. id is the filename stem: task-friction-tier-b-url-and-optout.
  CLI `arggon create task friction-tier-b-url-and-optout` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Tier B prefilled publish URL and the friction opt-out keys

## Context

Plan task T4 for [spec-friction-capture-020](../../../docs/specs/spec-friction-capture-020.md).

Tier B is the load-bearing piece of the whole design: it is what lets the
recommended channel exist **without** violating `docs/agents.md` §0 ("Do not open
new GitHub issues"). The agent's job ends at emitting a prefilled URL; a human
clicks submit. `ce-ai#426`'s tiered output dissolves the auth objection the same
way — no `gh`, no token.

Convergent evidence: `mastepanoski/ce-ai#426` (shipped),
`chriscase/ContextDesk#325` (shipped), `jedbjorn/subfloor#543` (published the
architecture, declined the automation).

**No YAML front matter** in the body: GitHub Issue Forms parse query params, and
no surveyed project parses front matter out of an issue body — front matter is a
file-format convention for in-tree Markdown, not a GitHub issue convention. The
machine-readable part is a fenced `arggon-fingerprint` block plus a stable title
prefix so a later `gh issue list --search` finds it.

Opt-out semantics are the ADR 0024 §3 ruling and are easy to get wrong: the keys
gate **capture**, never **discoverability**.

## Acceptance

- [x] `--tier a` (default) prints the report only and works with no `gh` on `PATH`, no token and no network (test with `PATH` stripped).
- [x] `--tier b` additionally prints `https://github.com/Arggon/ArggonManager/issues/new?title=…&body=…&labels=adopter-friction`.
- [x] The URL's `title` starts `[adopter-friction] ` and is ≤120 chars after the prefix.
- [x] The URL's `body` is human-readable markdown ending in a fenced `arggon-fingerprint` block carrying the fingerprint and the stable fields; it contains **no YAML front matter** (test asserts).
- [x] No tier auto-submits; no code path writes to GitHub. (Non-goal, ADR 0024 §4.)
- [x] `x-friction: false` in `ArggonManager/.convention.yml` → records are not written, `--report` renders empty with `optedOut: true`, exit 0 (test).
- [x] `ARGGON_NO_FRICTION=1` → same (test).
- [x] Opting out does **not** remove the trigger text from generated agent files and does not make the command undiscoverable — asserted by a test that the agent-file carrier is untouched by the opt-out.
- [x] An unknown nested key inside `x-friction` is ignored (extension policy); a scalar `x-friction` is a parse error (test both).
- [x] `arggon friction --clear` removes the whole log, is idempotent on an empty or missing file, and reports `cleared: 0` rather than an error.
- [x] `--report` and `--clear` are mutually exclusive with a capture position, and the conflict is a named error.

### 2026-10-11 @arggon-maker
Maker evidence for the standards reviewer — task-friction-tier-b-url-and-optout (plan task T4 of spec-friction-capture-020, the load-bearing half of ADR 0024). PR: https://github.com/Arggon/ArggonManager/pull/724 (branch `feat/task-friction-tier-b-url-and-optout`). All 11 acceptance boxes are ticked in the live section; evidence per box below.

## The URL construction (encoding rules)

`--tier b` prints exactly
`https://github.com/Arggon/ArggonManager/issues/new?title=…&body=…&labels=adopter-friction`
(params in that order, `lib/src/friction-publish.ts`):

- **Encoding**: `encodeURIComponent` per param VALUE, joined with `&`. Not `URLSearchParams` — that is the form encoding and spells a space `+`, while GitHub's prefill contract is percent-encoding. A narrative carrying `&`, `=`, `#` or `?` therefore cannot forge a param, and a newline rides as `%0A`.
- **Title**: `[adopter-friction] ` prefix + the top-count class summary, capped at 120 chars AFTER the prefix (marker inclusive), so the stable search key survives a long `--command` shape. Empty log → `no friction recorded (0 records)`; opted-out tree → `opted out — nothing captured (…)`.
- **Body**: human-readable markdown (counts, local-only dedupe boundary, reporters basis, untrusted-narrative note, one fenced narrative per class) whose FINAL fenced block is `arggon-fingerprint` — one stanza per class with `fingerprint`, `count`, `reporters`, `commandShape`, `errorCode`, `harness`, `majorVersion`, `firstSeen`, `lastSeen`, `arggonVersion`, `os`, `arch`, `node`. No YAML front matter, asserted.
- **Length bound**: whole URL ≤ 6000 chars (spike-measured 414 ceiling ~8.2 KB). Classes drop off the TAIL (lowest counts) and the drop is stated in the body (`… and N more classes not included … Run arggon friction --report locally`), never silent. At most 10 classes in the body; narrative capped 400 chars per class there.
- **Label**: `labels=adopter-friction` per the acceptance's URL constant. Caveat recorded in code + PR: an outside adopter lacks the triage permission for the `labels` param to land, so it is best-effort until the repo-side Issue Forms template (ops change, below).

## The opt-out semantics as implemented (keys, precedence, what each gates)

Two keys, one meaning (`lib/src/friction-optout.ts` + `lib/src/convention.ts`):

1. `x-friction: false` in `ArggonManager/.convention.yml` — tree-wide. Scalar spelling is the documented one; the mapping spelling (`x-friction:` + nested `capture:`) is accepted alongside so the section reads like its `x-*` siblings. An unknown nested key is IGNORED (extension policy). A non-boolean scalar (`yes`, `'false'`, `nope`) is a parse error — a quoted boolean denotes the STRING "false", and reading an opt-out out of a string is how an opted-out tree captures anyway.
2. `ARGGON_NO_FRICTION=1` — per invocation; empty value reads as unset (mirrors `ARGGON_NO_UPDATE_CHECK`, spec-update-channel-023: `opt-out = value !== ""`).

**Precedence**: the per-invocation key WINS over the tree-wide one, mirroring `--no-commit` over `x-tracker.auto-commit` (the narrower scope is the one the operator just typed). There is deliberately NO per-invocation opt-IN: a tree that opted out at the config level re-enables by editing the config, never by an ambient variable.

**What it gates**: CAPTURE only, never DISCOVERABILITY (ADR 0024 §3). Opted out → no record is written (not even the state dir), the capture envelope reports `optedOut: true` and exits 0, `--report` renders empty with `optedOut: true` and the named remediation, and `--tier b` still emits a well-formed URL whose title/body state the opt-out. The trigger text is NOT removed from generated agent files and the command stays on `--help` (asserted by a carrier test). `--clear` is NOT gated (a rollback the operator asked for is not capture).

## Acceptance-box evidence (all 11, each ticked in the live section)

1. `--tier a` default, report only, PATH-stripped — `cli/src/friction-tier-b.test.ts` "tier a (default)" (PATH `""`, all proxy vars blackholed, tokens emptied): report printed, no `issues/new`, no `tier b`, exit 0. Explicit `--tier a` likewise. Live re-run below.
2. `--tier b` prints the URL — same file, "tier b" describe; URL starts with the exact base and carries `labels=adopter-friction`; report comes first.
3. Title prefix + ≤120 after prefix — asserted on the built URL (`params.title`), unit-pinned with a 400-char `commandShape`.
4. Body markdown, final `arggon-fingerprint` fence, no YAML front matter — asserted (`body.startsWith("---")` false; no `---` line anywhere; last fence's info string is `arggon-fingerprint`; body ends ```` ``` ````). Stable fields asserted per stanza.
5. No tier auto-submits; no code path writes to GitHub — source-level guard test scans the four friction modules for `node:http|undici|node-fetch`, `fetch(`, `"gh"`, `api.github|graphql`; plus the envelope-shape test (publish carries only `body`/`tier`/`title`/`url`; no `issue`/`number`/`html_url`/`created_at`/`api.github` anywhere in the envelope).
6. `x-friction: false` → nothing written, `--report` empty with `optedOut: true`, exit 0 — CLI test (config fixture `version: 5\nx-friction: false\n`): capture envelope `optedOut: true`, no `record`, zero log lines, state dir never created; human report states `optedOut: true`; `--json` report `{ optedOut: true, count: 0, rows: [] }`.
7. `ARGGON_NO_FRICTION=1` → same — CLI test; live re-run below.
8. Opt-out leaves the carrier discoverable — CLI test writes the spec's trigger block verbatim into a generated agent file, runs capture + report, asserts the file bytes and the repo file-set are unchanged, and `friction --help` still lists `--report`.
9. Unknown nested key ignored / scalar parse error — `cli/src/convention.test.ts` "x-friction" describe: mapping + `future-option: 7` ignored; `x-friction: yes` / `'false'` / `nope` and `capture: yes` all throw `must be a boolean`.
10. `--clear` — removes log + drop counter, `cleared: N`; idempotent on missing/empty with `cleared: 0` and no state dir created; machine salt survives; unit tests in `lib/src/friction.test.ts` + CLI tests.
11. Named conflicts — `report-and-capture-mutually-exclusive`, `clear-and-capture-mutually-exclusive`, `report-and-clear-mutually-exclusive`, plus `tier-without-report` and `unknown-tier` for the tier rules; each asserted on both channels.

## Live PATH-stripped evidence (built dist/cli.js, `env -i PATH=""`, empty GH_TOKEN/GITHUB_TOKEN, all proxies blackholed, fixture state dir + seeded 2-record log)

- `friction --report` → report, no URL, exit 0 (expected: tier a is the report only; observed as expected).
- `friction --report --tier b` → report, then the URL line; title decodes to `[adopter-friction] start --worktree <arg> — START_FAILED (×2 of 1 class)`; body ends with the `arggon-fingerprint` fence; `labels=adopter-friction`; exit 0.
- `friction --report --tier c --json` → exit 1, `{"reason":"unknown-tier","report":true,…}`.
- cwd in a fixture tree with `ArggonManager/.convention.yml` = `version: 5\nx-friction: false\n`: capture → `{"optedOut":true,…}` exit 0, no log file on disk; `--report` → `optedOut: true` remediation line, exit 0.
- `ARGGON_NO_FRICTION=1` capture → `optedOut: true`, exit 0.
- `--clear --json` → `cleared: 3`; again → `cleared: 0`; `machine-salt` survives.

## Issue Forms template disposition (spike amendment 1)

NOT in this diff. The item's acceptance pins the URL constant to `?title=…&body=…&labels=adopter-friction` and does not require the repo-side template, so per the maker boundary it is recorded as the named OPS CHANGE in the PR description: create the `adopter-friction` label, add `.github/ISSUE_TEMPLATE/adopter-friction.yml` (Issue Forms, claude-code's `bug_report.yml` pattern: `title: "[adopter-friction] "`, `labels: ["adopter-friction"]`), and only then consider emitting `&template=adopter-friction.yml&`. Notably `arggon init` deliberately never writes `.github/ISSUE_TEMPLATE` (asserted in `cli/src/init-docs.test.ts`), so the template is a maintainer ops change, not a generated file. Spike amendment 2 (the carve-out sentence in the trigger block) feeds `task-friction-trigger-carrier` (todo) — the trigger block itself has not landed, so there is nothing to carve out of here. MCP surface, `json-output.md` and `doctor.friction` are T5 (`task-friction-surface-parity-and-docs`) — untouched.

## Gates (declared order)

- `npm run build` → ok (postbuild bundle: 47 modules inlined, 540,886 bytes; `dist/cli.js` rebuilt).
- `npm test` → 143 files, 3104 tests, all passed.
- `npm run check:plugin` → exit 0 AFTER the commit (the gate compares the committed bundle to a fresh build; verifying it pre-commit is meaningless on a dirty tree). Committed bundle is byte-identical to the rebuild.
- `npm run lint` → exit 0. Prettier `--check` clean on every touched file (no format churn).
- `arggon validate` → ok (0 warnings, convention v5). `arggon doctor --json` reports no generated-doc drift (the `x-generated` checksum for `skills/arggon-cli/SKILL.md` was refreshed for the moved command region, same discipline as T2).

Impact class: behavioral (ADR 0024 §2 / docs/agents.md §Changing the methodology itself) — the agent-facing skill carrier gained the `--report [--tier a|b]` / `--clear` wording in its generated-commands region, with the bundled `.agents/skills` copy byte-equal (skill-copy + skill-generated-commands tests green).

### handoff 2026-10-11 @arggon-maker — next: Delivery lead reviews PR #724 (gates green, 11/11 acceptance ticked); on merge flip the item to done and take the Issue Forms ops change.
- branch: feat/task-friction-tier-b-url-and-optout
- open questions: Owner may prefer the Discussions fallback (one repo setting, named on the spike item); T5 owns MCP parity/json-output/doctor.friction; add &template= after the ops change lands.
- [ ] `--tier a` (default) prints the report only and works with no `gh` on `PATH`, no token and no network (test with `PATH` stripped).
- [ ] `--tier b` additionally prints `https://github.com/Arggon/ArggonManager/issues/new?title=…&body=…&labels=adopter-friction`.
- [ ] The URL's `title` starts `[adopter-friction] ` and is ≤120 chars after the prefix.
- [ ] The URL's `body` is human-readable markdown ending in a fenced `arggon-fingerprint` block carrying the fingerprint and the stable fields; it contains **no YAML front matter** (test asserts).
- [ ] No tier auto-submits; no code path writes to GitHub. (Non-goal, ADR 0024 §4.)
- [ ] `x-friction: false` in `ArggonManager/.convention.yml` → records are not written, `--report` renders empty with `optedOut: true`, exit 0 (test).
- [ ] `ARGGON_NO_FRICTION=1` → same (test).
- [ ] Opting out does **not** remove the trigger text from generated agent files and does not make the command undiscoverable — asserted by a test that the agent-file carrier is untouched by the opt-out.
- [ ] An unknown nested key inside `x-friction` is ignored (extension policy); a scalar `x-friction` is a parse error (test both).
- [ ] `arggon friction --clear` removes the whole log, is idempotent on an empty or missing file, and reports `cleared: 0` rather than an error.
- [ ] `--report` and `--clear` are mutually exclusive with a capture position, and the conflict is a named error.

### 2026-10-11 @arggon-delivery-lead
### 2026-10-11 @arggon-delivery-lead — review verdict: APPROVED, merge (PR #724)

Reviewed against engineering.md §Review bar. Architecture/boundaries: tier B stays an emission surface — `encodeURIComponent` (form encoding's `+` would break the prefill contract) with a 6000-char bound well past the spike's measured 414 ceiling and tail drops stated in the body; a source-level guard test scans all four friction modules for HTTP/fetch/`gh`/API-host so "no code path writes to GitHub" is enforced structurally, not by review; opt-out semantics implement the ADR 0024 §3 ruling exactly — the keys gate CAPTURE, never DISCOVERABILITY (opted-out report is empty-but-successful with `optedOut: true`, trigger text and `--help` untouched, `--clear` ungated as a requested rollback) — and the env var's precedence over the tree-wide key mirrors the repo's own `--no-commit`-over-`x-tracker.auto-commit` idiom. Evidence travels: PATH-stripped/`env -i` runs for tiers a/b/c, the opt-out write-nothing run, the `--clear` count sequence, and 3104 tests. Scope stayed on the item: the Issue Forms template is the named ops change in the PR (correctly not invented into the diff), MCP/json-output/doctor untouched, and the spike's amendment 2 is routed to T6 rather than absorbed. The maker also audited and repaired the inherited partial work it found in the worktree (missing import, misleading `tier-without-report` reason, template-implying comments) — that is the right use of a fresh pair of eyes on stranded work. Impact class stated behavioral.
