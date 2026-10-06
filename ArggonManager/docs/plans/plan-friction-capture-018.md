---
plan_id: friction-capture-018
title: Plan for Adopter friction capture, dedupe and redacted report
spec: ArggonManager/docs/specs/spec-friction-capture-020.md
status: proposed
created: 2026-10-02
---

# Plan: Adopter friction capture, dedupe and redacted report (friction-capture-018)

Derived from `ArggonManager/docs/specs/spec-friction-capture-020.md` (stage 1 of
[ADR 0024](../adr/0024-adopter-friction-channel.md)). Each task carries a
verifiable acceptance criterion and links back to the spec.

No implementation task may be claimed before `arggon spec analyze` reports no
**NEW** findings (ADR 0017).

## Tasks

### T1: `arggon friction` capture + the local log

- New command with the spec's field table, caps, `fingerprint` derivation and
  `reporterId`; append-only JSONL at `<stateBase>/arggon/friction.jsonl`,
  honoring `ARGGON_STATE_DIR`; `machineSalt` generated once in the state dir.
- **Acceptance:** the hostile-input, limits, time/locale, persistence and
  environment/platform criteria in the spec pass as unit tests on the record
  writer; `--json` emits `FRICTION_FAILED`/`no-observation` for an empty
  observation and `log-unwritable` with the named path otherwise.

### T2: Redaction at write time

- The spec's four-step redaction pass (path normalization → secret shapes →
  URLs → bounded/50% rule), applied in the capture path so no unredacted byte
  is ever persisted.
- **Acceptance:** the hostile-input criterion passes end-to-end through
  `arggon friction --evidence <file>` and the persisted line is redacted, not
  just the rendered report.

### T3: Fingerprint dedupe + the report renderer

- `--report` with one row per fingerprint, sorted count-desc then fingerprint,
  with `count`, `reporters`, `firstSeen`, `lastSeen`, `dropped`,
  `skippedVersions`; the 50-row cap with an explicit "and N more classes" line.
- **Acceptance:** two log fixtures (one class ×3, two classes ×1 with prose that
  differs but error codes that do not) produce the documented grouping and
  ordering; an unknown `v` record is skipped with `skippedVersions` reported.

### T4: Tier B prefilled URL + opt-out keys

- `--tier a|b`; tier B emits the `issues/new?title=…&body=…` URL with the
  `arggon-fingerprint` fenced block and **no YAML front matter**; `x-friction:
false` and `ARGGON_NO_FRICTION=1` write nothing and report `optedOut: true`
  without hiding the command.
- **Acceptance:** tier `b` output parses as a URL whose `title` starts
  `[adopter-friction] ` and whose `body` carries the fingerprint; the command
  succeeds with no `gh` on `PATH`; both opt-out keys produce `optedOut: true` and
  an empty log.

### T5: Surface parity + JSON contract docs

- `tools.arggon.friction` and the `arggon_friction` MCP tool; `doctor --json`
  gains the additive `friction` block; `docs/json-output.md` documents both.
- **Acceptance:** `cli/src/mcp-parity.test.ts` green; `json-output.md` rows for
  `friction` and `doctor.friction` land in the same PR; no `schemaVersion` bump.

### T6: The behavioral carrier change (trigger + doctor visibility + skill)

- Marked trigger block in `templates/docs/opencode/agents/arggon-worker.md` and
  `arggon-coordinator.md`; `doctor` reports `triggerPresent`/`triggerVersion` per
  file; `skills/arggon-cli/references/friction.md` + `SKILL.md` routing, kept
  byte-equal to `.agents/skills/`; `EVALS.md` gains a case that derives
  `friction --report` from the **agent file alone**.
- **Acceptance:** `cli/src/skill-copy.test.ts` green; the new eval case passes;
  `docs/agents.md`, `README.md` and `docs/convention.md` (`x-friction`) updated
  in the same PR; the PR description and an item comment state the impact class
  as **behavioral**.

## Ordering

`T1` → (`T2`, `T3` in parallel) → `T4` → `T5` → `T6`.

T6 is last because the trigger text must not point at a command that does not
exist yet — an agent file naming a missing command is worse than no trigger.

## Spikes (not tasks — they answer unknowns, they build nothing)

- `task-spike-friction-trigger-compliance` — does an embedded trigger fire more
  reliably than the `deftai` skill did? Gates stage 2 and tier C.
- `task-spike-friction-tier-b-surface` — Issues vs Discussions for the prefilled URL.
- `task-spike-friction-volume-threshold` — what volume would justify stage 3
  automation, if ever. Depends on the compliance spike.

## Out of scope for this plan

Tier C (`gh` upstream pre-search, comment-on-existing, `--yes`), rolling issues
per fingerprint, maintainer-side aggregation of adopter reports, and the eval-FAIL
producer. All are stage 2 or later per ADR 0024.
