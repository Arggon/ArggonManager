---
spec_id: friction-capture-018
title: Adopter friction capture, dedupe and redacted report
status: proposed
created: 2026-10-02
---

# Spec: Adopter friction capture, dedupe and redacted report (friction-capture-018)

Implements **stage 1** of [ADR 0021](../adr/0021-adopter-friction-channel.md)
(decision recorded in
[exploration-adopter-feedback-channel-019](../explorations/exploration-adopter-feedback-channel-019.md)):
a local, bounded, structured friction record with a stable-fields-only
fingerprint and a **redacted** report a human acts on — with a generated-agent
trigger so the channel is discoverable, and a `doctor` block that reports the
trigger's per-file `triggerVersion` and distinguishes _trigger absent_ from
generic template drift.

## Purpose

The product reaches the adopter and nothing comes back; the two friction
protocols in `ArggonManager/docs/labs/` are maintainer-side and single-machine,
and this tracker already carries 10 repeat reports of the same failure classes.
Stage 1 makes friction **capturable and deduplicable at the point it happens**,
with a human gate before anything leaves the machine. It ships the local half
only: no tier auto-submits, and tier C (`gh`-mediated upstream dedupe) is out of
scope pending the compliance spike.

Invariants:

- **The friction log is never the tracker.** It lives outside the repo, is never
  staged or committed, never appears in `arggon validate`, and cannot become a
  task by accident.
- **Redaction happens before render.** A record is redacted when it is written,
  so no unredacted byte exists on disk to leak from a later bug or a
  `--report` bug.
- **Whitelisted capture.** Only declared fields are persisted. There is no
  "capture everything and scrub later" path.
- **The narrative is data, never an instruction.** Passed through verbatim,
  never parsed, never rendered as a directive.
- **No tier auto-submits.** The agent's job ends at a redacted report or a
  prefilled URL a human opens. `docs/agents.md` §0 is never violated.
- **Local-only.** Capture writes one file and makes no network request. The only
  outbound anything is tier B's URL, which a human opens in their own browser.
- **Additive JSON only.** New envelope fields are additive; `schemaVersion`
  stays `1`.

## Synopsis

```bash
arggon friction "<observation>" --command <shape> [--error <code>] [--harness <id>] [--evidence <file>]
arggon friction --report [--tier a|b] [--json]
arggon friction --clear [--json]
```

No subcommands: `--report` and `--clear` are mutually exclusive with a capture
position. Native surface parity: `tools.arggon.friction` and the `arggon_friction`
MCP tool carry the same arguments and the same envelope.

### The record

One JSONL line, append-only. `v` is the format version.

```json
{
  "v": 1,
  "ts": "2026-10-02T14:18:08.885Z",
  "fingerprint": "9f2c…",
  "reporterId": "4b1a0c7e2f55",
  "commandShape": "start --worktree <id>",
  "errorCode": "START_FAILED",
  "harness": "opencode",
  "arggonVersion": "0.5.0",
  "os": "linux",
  "arch": "x64",
  "node": "22.12.0",
  "narrative": "…",
  "evidence": "…"
}
```

| Field                                    | Rule                                                                                                                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v`                                      | `1`. Readers **must** skip a record whose `v` they do not know rather than fail the whole file.                                                                                                                  |
| `ts`                                     | ISO-8601 UTC from the kernel clock, never a parsed locale string.                                                                                                                                                |
| `fingerprint`                            | `sha256(commandShape ‖ "\x1f" ‖ errorCode ‖ "\x1f" ‖ harness ‖ "\x1f" ‖ majorVersion)`, hex, truncated to 16 chars. **Never derived from `narrative`.**                                                          |
| `reporterId`                             | `sha256(machineSalt ‖ repoAbsPath)`, truncated to 12 hex chars. `machineSalt` is 32 random bytes generated once in the state dir and never leaves it. Identifies _same machine, same repo_ — never _which_ repo. |
| `commandShape`                           | Required. argv normalized: subcommand and flags kept, values that look like paths, ids, URLs, tokens or SHAs replaced with a placeholder. Capped 200 chars.                                                      |
| `errorCode`                              | Optional; the `error.code` from the envelope the agent already has (e.g. `START_FAILED`, `VALIDATE_FAILED`), else free-form, capped 64. Never prose.                                                             |
| `harness`                                | Optional, capped 32. Defaults to `unknown`.                                                                                                                                                                      |
| `arggonVersion` / `os` / `arch` / `node` | Whitelisted environment facts, each capped.                                                                                                                                                                      |
| `narrative`                              | Required free text, capped 2000 chars, redacted at write.                                                                                                                                                        |
| `evidence`                               | Optional file **contents**, capped 4000 chars, redacted at write. Never a path — the path itself is the leak.                                                                                                    |

### Fingerprint discipline

The fingerprint is built from stable structured fields **only**, never from the
narrative, following Sentry's grouping rule that a frequently-changing value
(`{{ error.value }}` — here an LLM-authored sentence) "can produce really bad
groups". Two observations with the same `commandShape` + `errorCode` +
`harness` + major version are the same friction class even if the prose differs;
two observations with different error codes are not, however similar the prose.

### Dedupe and ordering

Within the log, records sharing a fingerprint are one class. `--report` renders
one row per fingerprint sorted by **count descending, then fingerprint
ascending** — the maintainer's attention is the scarce resource, so a class seen
repeatedly outranks a one-off. Each row shows `count`, `reporters` (distinct
`reporterId`s **present in this log** — stage 1 is one machine, so this is
normally `1`; the field exists so stage-2 aggregation needs no schema change and
so a human merging two reports can count distinct reporters without either side
learning a repo name), `firstSeen`, `lastSeen`, the stable fields, and the
newest narrative.

### Redaction (at write, not at render)

Applied in this order, longest-first, children before parents:

1. **Cross-OS path normalization** → one canonical placeholder, so all of
   `C:\Users\a\b`, `c:/Users/a/b`, `\\?\C:\Users\a\b`, `/c/Users/a/b` and
   `/private/var/folders/x` collapse to the same token.
2. **Secret shapes**: `-----BEGIN … PRIVATE KEY-----` blocks (whole block),
   `gh[pousr]_[A-Za-z0-9]{20,}`, `sk-…`, `npm_…`, `AKIA…`, JWTs
   (`eyJ…`.`…`.`…`), and any `key|token|secret|password|passwd|credential`
   assignment with a value of 8+ chars.
3. **URLs** → host preserved, query and fragment dropped.
4. **Bounded** replacement: at most 20 substitutions per field; a field whose
   redaction rate exceeds 50% is replaced by `[redacted: >50% of field]`, because
   a field that is mostly secret is not safe to publish in any part.

### The report and its tiers

`--report` prints a markdown block. `--tier` selects:

- **`a` (default)** — the report only, to stdout. Works with no `gh`, no token,
  no network. This is the default because it is the only tier with no failure
  mode.
- **`b`** — additionally prints one **prefilled URL**:
  `https://github.com/Arggon/ArggonManager/issues/new?title=…&body=…&labels=adopter-friction`
  with the title `[adopter-friction] <one-line ≤120 chars>` and the body a
  human-readable report whose final fenced block carries `arggon-fingerprint`,
  the stable fields, and the narrative. **No YAML front matter**: GitHub Issue
  Forms parse query params, and no surveyed project parses front matter out of
  an issue body. The agent never opens the URL; a human does.

Tier `c` (`gh`, upstream pre-search, comment-on-existing) is **not in this spec**.

### Opt-out

`x-friction: false` in the tracker `.convention.yml` (tree-wide; an unknown
nested key is ignored per the extension policy) and `ARGGON_NO_FRICTION=1`
(per invocation). Opting out writes nothing and renders an empty report with
`optedOut: true`. It **does not** remove the trigger from the generated agent
files and does not hide the command — per ADR 0021 §3.

### The trigger and its visibility

`templates/docs/opencode/agents/arggon-worker.md` and `…/arggon-coordinator.md`
gain a marked block:

```markdown
<!-- arggon:friction-trigger begin triggerVersion=<arggonVersion> -->

Friction in ArggonManager itself is not adoptable work — do not work around it
and do not file it in this repo's tracker. Record it instead:
`arggon friction "<one line>" --command "<argv shape>" --error <code>`
<!-- arggon:friction-trigger end -->
```

`arggon doctor --json` gains an additive `friction` block reporting whether each
managed agent file carries the block and at which `triggerVersion`:

```json
"friction": { "triggerPresent": true, "triggerVersion": "0.5.0", "current": "0.5.0", "files": 2 }
```

**Why a dedicated block, and not the existing `outdated` bucket** (ADR 0021 §2).
Visibility is already covered: `doctor.ts` re-renders the current template for
every `config.generated` entry in every local state — untouched, modified,
**acked** and acked-drifted — and the generated agent files are in that map, so
editing the worker template alone already surfaces a missing trigger as an
outdated managed doc. An earlier draft of this spec claimed the opposite (that
"without this block the channel's absence is invisible"); that was wrong and the
ADR now says so. What the block uniquely buys is narrower and still real:

1. **a per-file `triggerVersion`**, so "the trigger is present at 0.5.0" stays
   distinguishable from "the current template is 0.6.0" — one boolean against a
   template that also moves for unrelated reasons cannot say which; and
2. **separating _trigger absent_ from generic template drift**, which is the
   observable `task-spike-friction-trigger-compliance` needs to tell "never seen"
   from "seen and ignored".

If stage 1 has to be minimal, the cuttable part is `triggerVersion` and `files` —
**not** the block. Documented in `ArggonManager/docs/json-output.md` in the same
PR.

### Degradation

No flag changes elsewhere, no new files in the repo, no output change on any
existing command except the additive `doctor.friction` block. The state dir
honors `ARGGON_STATE_DIR` (the ADR 0019 worktree env contract) and otherwise the
established per-OS state base; the log path is
`<stateBase>/arggon/friction.jsonl`, created `mkdir -p`. An adopter who reads
none of this is unaffected.

## Acceptance

Mapped one-to-one from the exploration's 13 hunted dimensions; each resolves to a
criterion, a non-goal below, or a spike.

- [ ] **Hostile input** — a pasted command or evidence file containing a
      credential is persisted only with every secret shape replaced; path forms
      for the same path across Windows/POSIX/MSYS collapse to one placeholder;
      a field that is more than 50% secret is replaced wholesale. — tests:
      private-key block, `ghp_`/`sk-`/`npm_`/`AKIA`/JWT shapes,
      `password=` assignment, `C:\Users\a\b` vs `/c/Users/a/b` vs
      `\\?\C:\Users\a\b`, a 60%-secret field.
- [ ] **Empty / error states** — `arggon friction` with no observation is a named
      error (`FRICTION_FAILED`, `reason: "no-observation"`), never an empty
      record; `--report` on an empty log succeeds with `count: 0`; a missing
      `gh` degrades tier `b` to tier `a` without an error (stage 1 requires no
      `gh` at all, so this holds by construction).
- [ ] **Concurrency / idempotency** — two workers in two worktrees appending the
      same class produce two well-formed lines with equal fingerprints and no
      interleaved or truncated record; append is `O_APPEND` on a single
      `write()` per record; re-running an identical capture is **not** deduped at
      write time (repeats are signal — the report's `count` is what carries them).
      The tracker mutation lock does not apply: this file is not in the tracker.
- [ ] **Failure / retry** — an unwritable state dir fails with
      `reason: "log-unwritable"` and the named path, and never leaves a partial
      line; a write is atomic (one `write()` of a complete record); `--clear`
      is idempotent on an already-empty log and on a missing file, reporting
      `cleared: 0` rather than an error. Stage 1 makes **no network request at
      all**, so there is no timeout to govern (upstream dedupe is stage 2).
- [ ] **Auth** — no tier requires `gh`, a token, a session, or any credential;
      there is no authenticated code path in this spec to test. CI behaves
      identically to a laptop except that no URL is opened for it.
- [ ] **Limits / quota** — every field carries the cap in the table above;
      `--report` renders at most 50 rows and then an explicit
      `… and N more classes` line rather than truncating silently; the log is
      rotation-bounded: at 5000 lines the oldest are dropped on write and the
      drop is reported by the next `--report` (`dropped: N`). Maintainer
      attention is the scarce resource, so ordering is by count.
- [ ] **Limits of local-only dedupe — the honest boundary of stopping at tier B** —
      fingerprint dedupe is **local**: it collapses repeats inside one log and
      nothing else. It cannot see an issue a human already filed upstream, so a
      class that is already in the maintainer's tracker is re-emitted as a "new"
      local class and the human may file it twice. This is a **deferred
      capability, not a postponed one** — upstream pre-search needs the network
      plus `gh`, which _is_ tier C, gated on
      `task-spike-friction-trigger-compliance` (ADR 0021 §1 Stage 2). Stage 1
      therefore ships a report honest about its own blindness: it states that
      dedupe scope is local-only and never implies upstream coverage.
- [ ] **Time / locale** — `ts` is ISO-8601 UTC from the kernel clock; no code
      parses a locale or non-ISO timestamp; a narrative containing RTL or CJK
      text round-trips verbatim through capture, redaction and report without
      being reordered, escaped or truncated mid-surrogate-pair.
- [ ] **Persistence / migration / rollback** — records carry `v`; a reader skips
      an unknown `v` and reports `skippedVersions` instead of failing; deleting
      the file (or `--clear`) is the complete rollback and needs no migration,
      because the log is cache-like and holds nothing the user authored as work.
- [ ] **Observability** — `--report` states which optional signals were
      unavailable (`optedOut`, `dropped`, `skippedVersions`, `reporterCount`
      basis) rather than omitting them silently; `--json` carries the same fields;
      every non-happy path names its `reason` and the remediation.
- [ ] **Security / threat model** — the persisted record is already redacted, so
      there is no unredacted intermediate to leak; **non-goal: the tool never
      reads or processes an inbound issue body**, so Arggon adds no instance of
      the untrusted-input class behind CVE-2026-54316 / GHSA-wpqr-6v78-jr5g /
      Clinejection; the narrative is fenced and labelled as untrusted data in any
      rendered output.
- [ ] **Environment / platform** — path redaction normalizes Windows, MSYS and
      POSIX forms before matching (this repo already carries
      `bug-crlf-provenance-breakage`); the log is JSONL so no line-ending
      semantics apply; the state dir follows the established per-OS base and
      honors `ARGGON_STATE_DIR`; capture works air-gapped, and the whole capture
      path is filesystem-only.
- [ ] **Upgrade / data loss** — a newer `arggon` reading an older log keeps every
      record it understands and reports the rest; an older `arggon` reading a
      newer log skips unknown `v` records; worst case is "start fresh", which
      loses only cache-like friction history, never user-authored work.
- [ ] **Adopter trust** — the trigger fires only for friction in ArggonManager
      itself, never for the adopter's own product defects; the default tier is
      `a` (nothing leaves the machine); an adopter who sets
      `x-friction: false` or `ARGGON_NO_FRICTION=1` records nothing.
- [ ] **Surfaces stay in parity** — CLI `--json`, `tools.arggon.friction` and
      `arggon_friction` MCP produce the same envelope fields;
      `cli/src/mcp-parity.test.ts` stays green; `ArggonManager/docs/json-output.md`
      documents `friction` and `doctor.friction` in the same PR.
- [ ] **Carrier discipline** — `skills/arggon-cli/SKILL.md` and the new
      `references/friction.md` stay byte-equal to their bundled copies under
      `.agents/skills/` (modulo the generated marker, enforced by
      `cli/src/skill-copy.test.ts`); the PR description and a comment on this
      item state the impact class as **behavioral**
      (`docs/agents.md` §Changing the methodology itself); `EVALS.md` gains an
      eval case covering `arggon friction --report` derivation **without** the
      new reference being visible to the deriving agent — proving the trigger
      text alone carries the workflow, which is the `deftai` lesson turned into
      a regression test.
- [ ] **Gates** — `npm test`, `npm run build`, `npm run check:plugin`,
      `npm run lint` and `arggon validate` are green.

## Non-goals

- **No automatic publication.** No tier auto-submits; the agent never opens an
  issue, a human does. (ADR 0021 §4.)
- **No tier C** — `gh`-mediated upstream pre-search, comment-on-existing, or any
  `--yes`. Deferred to stage 2, gated on
  `task-spike-friction-trigger-compliance`. Consequently **stage 1 cannot detect
  that a friction class already exists upstream** — see the local-only-dedupe
  limits criterion above; that blindness is the concrete cost of the boundary,
  not an oversight.
- **No rolling issue per fingerprint** and no unattended aggregation
  (`ripple/xrpl-wasm-stdlib#311` pattern) — a maintainer-side automation,
  forbidden by the ADR.
- **No phone-home.** One local file; the only outbound anything is tier B's URL,
  opened by a human.
- **Nothing written to the tracker.** No `arggon create`, no staged file, no
  `validate` visibility.
- **No reading of inbound issue bodies**, and no maintainer-side automation that
  consumes them.
- **No change to the in-tree-tracker doctrine** (`docs/agents.md` §0 stands) and
  no change to the labs protocols, which keep filing through `arggon create`.
- **Not the evals harness.** `skills/arggon-cli/evals/` stays a skill-completeness
  harness; an eval FAIL becomes a stage-2 _producer_, not a channel (ADR 0021
  §5).
