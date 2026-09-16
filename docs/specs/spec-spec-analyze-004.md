---
spec_id: spec-analyze-004
title: spec analyze: ambiguity scan + spec consistency (report-only)
status: implemented
created: 2026-09-15
---

# Spec: spec analyze (spec-analyze-004)

## Purpose

Specs pass `arggon spec validate` (structure) yet stay ambiguous: vague
quantifiers, missing error paths, untestable requirements — agents implement
guesses. Spec Kit's `/clarify` + `/analyze` loop (github.com/github/spec-kit,
retrieved 2026-09-15) proved checklist-driven ambiguity scanning plus
spec/plan consistency checks valuable before implementation starts. This spec
adds `arggon spec analyze`: a read-only report over the spec corpus.
Invariants:

- **Report-only, pure read** — `spec analyze` NEVER edits any file. Structural
  validators (`spec validate`) stay the gate; `analyze` only reports.
- **Findings never fail the run** — a report full of warnings still exits 0;
  only structural failures (an unreadable file) exit non-zero.
- Same checklist for humans and agents; deterministic, no AI in the CLI.

## Synopsis

```bash
arggon spec analyze [--spec <path>]   # report-only scan; exit 0 even with findings
arggon spec analyze --json            # v1 envelope with findings arrays
```

- Default scope: every `docs/specs/*.md` under the repo root (parent of
  `tasks/`). `--spec <path>` scans a single file (absolute or cwd-relative,
  also outside `docs/specs/`).
- **Ambiguity checklist** (per spec, each hit = one finding with a line number
  when known; the term lists live in `cli/src/spec.ts` and stay small):
  - `vague-quantifier` — the eight vague terms on the documented
    `VAGUE_TERMS` list (warn).
  - `todo-marker` — uppercase placeholder markers, to-do / to-be-defined /
    fix-me style, matched case-sensitively (warn).
  - `no-error-path` — no failure/error section or paragraph: neither a
    heading nor a body line mentioning error/failure semantics (warn).
  - `no-acceptance` — missing an Acceptance criteria section (warn;
    `spec validate` already errors on this — analyze reports it as context).
  - `untestable-acceptance` — the Acceptance section carries no `- [ ]` /
    `- [x]` checklist items, i.e. nothing verifiable (warn).
- **Consistency check** (needs the whole corpus, skipped with `--spec`):
  - `spec-orphaned` — a spec with `status: implemented` whose `spec_id` is
    cited by no item body under `tasks/` and referenced by no plan (warn).
  - `plan-spec-missing` — a plan whose `spec:` frontmatter points at a file
    that does not exist (warn; mirrors `PLAN_SPEC_NOT_FOUND` as a report).
- Finding shape: `{ file, kind, line?, severity, message }` — `file` posix,
  repo-relative; `severity` is `info` or `warn` (all current checks are
  `warn`; `info` is reserved for future downgrades).
- Exit codes: `0` always on a completed scan, findings or not; `1` on
  structural failure (unreadable file) reusing `SPEC_FAILED` — no new error
  code.

### Baselines (`--save-baseline` / `--baseline`)

The multi-wave refactor gate ("no NEW findings vs the previous wave") is
mechanical, not manual JSON diffing. Both flags are options on the existing
`spec analyze` command (no new subcommands); they are mutually exclusive in
one run — a run either writes a snapshot or compares against one.

- **Snapshot format**: `{ schemaVersion, conventionVersion, count, findings }`
  where `findings` merges ambiguity + consistency findings sorted
  deterministically by file, kind, line (null-safe), severity, message. No
  timestamps or volatile fields: a re-run over unchanged specs produces a
  byte-identical, pretty-printed file, so committed baselines diff cleanly in
  git.
- **Comparison identity**: two findings match only when ALL of
  file/kind/line/severity/message are equal. New = in current, not in
  baseline; resolved = in baseline, not in current; unchanged = in both.
  Comparison is set-based, independent of findings order.
- **Exit-code policy**: a `--baseline` run with >= 1 NEW finding exits `1`
  (this is the wave gate — a regression); zero new findings exits `0`;
  resolved findings are good news and never fail the run; `--no-fail-on-new`
  opts out (report-only). Without `--baseline`, behavior is unchanged (exit 0
  with findings; only structural failures exit 1). Rationale: the plain
  analyze contract ("findings never fail") stays intact for reporting; the
  gate exists ONLY where a caller has declared a reference point. Structural
  failures (missing/invalid snapshot, unreadable spec) still exit 1 with
  `SPEC_FAILED`. With `--json`, a failing gate still emits a success envelope
  (`ok: true`) carrying the additive `baseline` payload — the exit code
  carries the gate, so `--json` pipelines branch on `status`/`baseline.failed`
  and CI on the exit code.
- **Recommended wave-gate flow**: save the baseline once at wave 0 and commit
  it, then run `spec analyze --baseline <file>` per PR/wave — non-zero exit =
  regression, fix or (deliberately) re-save the baseline.

## Contrato JSON

`--json` envelope: `{ ok: true, schemaVersion, conventionVersion,
command: "spec", findings: { ambiguity: Finding[], consistency: Finding[] } }`.
Structural failures emit `failJson` with `error.code: "SPEC_FAILED"` and exit
code 1, same as `spec validate`. Findings never set `ok: false`.

## Acceptance

- [ ] Ambiguity scan hits on a crafted vague fixture (quantifier, placeholder marker, no error path, untestable acceptance)
- [ ] A complete, concrete spec scans clean (zero findings)
- [ ] Consistency: implemented spec with no citing task/plan is reported; plan with missing spec target is reported
- [ ] `--json` shape matches the contract; exit code is 0 with findings and 1 with SPEC_FAILED on an unreadable file
- [ ] No file is ever written by `spec analyze` (pure read, covered by a test)
