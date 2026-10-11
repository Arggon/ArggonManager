---
type: task
status: in_progress
id: task-friction-capture-command
title: arggon friction capture and the local friction log
assignee: arggon-delivery-lead
branch: feat/task-friction-capture-command
parent: story-adopter-feedback
labels: [method]
priority: p1
created: "2026-10-02"
updated: "2026-10-11"
claimed_at: "2026-10-11T07:13:58.073Z"
worktree_path: /home/arggon/Projects/ArggonManager-task-friction-capture-command
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-capture-command.md
  Leaves live only under a story. id is the filename stem: task-friction-capture-command.
  CLI `arggon create task friction-capture-command` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon friction capture and the local friction log

## Context

Plan task T1 for [spec-friction-capture-020](../../../docs/specs/spec-friction-capture-020.md),
stage 1 of [ADR 0024](../../../docs/adr/0024-adopter-friction-channel.md).

Implements the `arggon friction` capture surface and the on-disk record: the
field table and per-field caps, `fingerprint = sha256(commandShape ‖ errorCode ‖
harness ‖ majorVersion)`, `reporterId = sha256(machineSalt ‖ repoAbsPath)`, and
the append-only JSONL log at `<stateBase>/arggon/friction.jsonl` honoring
`ARGGON_STATE_DIR` (the ADR 0019 worktree env contract). One `machineSalt` per
machine, generated once in the state dir, never leaves it.

`commandShape` normalization keeps the subcommand and flags and replaces
path/id/URL/token/SHA-looking values with a placeholder. `errorCode` is the
`error.code` the agent already holds from the failed envelope
(`START_FAILED`, `VALIDATE_FAILED`, …) — that is the "error class, not prose"
half of Sentry's fingerprinting rule.

The fingerprint is **never** derived from `narrative`: an LLM-authored sentence
is exactly the frequently-changing value that produces bad grouping.

The log is not the tracker. It is never staged, never committed, never visible
to `arggon validate`, and cannot become a task by accident.

## Acceptance

- [x] `arggon friction "<observation>" --command <shape> [--error <code>] [--harness <id>] [--evidence <file>] [--json]` exists and appends exactly one line per invocation.
- [x] Every field in the spec's table carries its documented cap; a capped field is truncated, never silently dropped.
- [x] `fingerprint` is `sha256(commandShape ‖ "\x1f" ‖ errorCode ‖ "\x1f" ‖ harness ‖ "\x1f" ‖ majorVersion)` hex-truncated to 16 chars, and no code path reads `narrative` to build it.
- [x] `reporterId` is stable for the same machine + repo and differs across machines; the salt is never written outside the state dir and never rendered.
- [x] `ts` is ISO-8601 UTC from the kernel clock; no code parses a locale or non-ISO timestamp.
- [x] Records carry `v: 1`; a reader skips an unknown `v` rather than failing the file.
- [x] Log path resolves per-OS via the established state base and honors `ARGGON_STATE_DIR`; the directory is created `mkdir -p`.
- [x] Empty observation fails with `FRICTION_FAILED` / `reason: "no-observation"`; an unwritable log fails with `reason: "log-unwritable"` plus the named path and leaves no partial line.
- [x] Append is one `write()` of a complete record under `O_APPEND`; two concurrent writers in two worktrees produce well-formed, non-interleaved lines (test).
- [x] RTL/CJK narrative round-trips verbatim through capture without reordering, escaping or mid-surrogate truncation (test).
- [x] Rotation: past 5000 lines the oldest are dropped on write (test).
- [x] Capture makes **no network request** — assert in a test that runs with the network denied.
- [x] `npm test`, `npm run build`, `npm run check:plugin` and `npm run lint` green.

## Notes

Sibling tasks `task-friction-redaction-at-write` and `task-friction-dedupe-and-report`
both depend on this one. `task-friction-trigger-carrier` must land **after** them:
an agent file naming a command that does not exist is worse than no trigger.

### 2026-10-06 @ses_ef169b774ffddLlcycmzGGeU5Q

### 2026-10-06 @arggon-delivery-lead — do not claim yet

**T1 is gated and stays `todo`.** Recording the reason here so the next agent does not read its unclaimed `todo` status as a green light.

ADR 0017 requires that no implementation task is claimed before a spec with clean `spec analyze`. PR #586 merged as `12df1ee0` and ADR 0024 was accepted on merge as `3d612032`, so the **renumber** half of the release condition is met. The **zero-NEW** half is not:

```
$ npm run arggon -- spec analyze --baseline ArggonManager/spec-analyze-baseline.json
5 new, 1 resolved, 5 unchanged, 10 total
exit code: 1
```

All 5 NEW findings are `[duplicate-doc-number]` and **none are caused by the adopter-friction chain** — they are `main`'s own pre-existing collisions (exploration-001, plan-001, plan-015, spec-001, spec-015), missing from the committed baseline because they predate it.

So the release condition fails on a defect that belongs to a different story. Two ways out, and the choice is the product owner's:

1. Renumber those five first — `task-renumber-colliding-doc-numbers` already owns it, and `task-release-pipeline-baseline-new-collisions` records that its completion is what unblocks the baseline. That is the honest route and it also turns `main` green again.
2. Re-save the baseline to record the five as known. **I would not recommend this as the first move**: it makes the gate green by widening the net rather than by fixing anything, and `main` currently exits 1, so the lane is red either way until one of these lands.

Until then T1 stays unreleased, and `task-spike-friction-volume-threshold` / the compliance spike stay behind their declared `depends_on` edges.

### 2026-10-11 @arggon-delivery-lead

### 2026-10-11 @arggon-delivery-lead — gate re-measured, still red; Wave A dispatched to clear it

`spec analyze --baseline ArggonManager/spec-analyze-baseline.json` on clean `main` today: **6 new, 1 resolved, 5 unchanged, exit 1**. Same 5 duplicate-doc-number pairs as the 2026-10-06 note, **plus a sixth NEW finding** that was not there then: DECISION-PENDING-EXPLORATION at `docs/explorations/exploration-methodology-improvements-014.md:163`.

T1 stays unreleased. Wave A (all file-disjoint from each other and from this task's future code):

1. `task-renumber-colliding-doc-numbers` — dependency bug (spec-analyze duplicate-doc-number detector) is done, so this item is claimable; it clears the 5 collisions.
2. `task-decision-pending-methodology-improvements-014` (new, filed today) — links ADR 0015 for C1; clears the sixth finding.
3. `task-spike-friction-tier-b-surface` — story's own research spike, touches only its item file.

Then `task-release-pipeline-baseline-new-collisions` re-baselines after the corpus is clean (NOT before, and never by widening the net). Only claim T1 when the zero-NEW condition holds on main again.

### 2026-10-11 @arggon-delivery-lead

### 2026-10-11 @arggon-delivery-lead — gate CLEARED: T1 released, claiming now

`spec analyze --baseline ArggonManager/spec-analyze-baseline.json` on clean main: **0 new, 0 resolved, 4 unchanged, exit 0**. The release condition from the 2026-10-06 note holds on both counts: the renumber half landed via PR #680 (task-renumber-colliding-doc-numbers) and the zero-NEW half via PRs #679 (decision fix), #686 (spec-deps-022 error path) and #690 (both baselines re-saved honestly, 2 closed findings dropped, 4 open ones persist).

T1 is claimed and dispatched. The story's remaining chain (task-friction-dedupe-and-report, task-friction-redaction-at-write) stays behind its declared depends_on until T1 merges.

### 2026-10-11 @Arggon
T1 landed on feat/task-friction-capture-command. Branch, files and per-box evidence below; the delivery lead reviews and flips.

## Design

- `lib/src/friction.ts` (new) — the record, the caps, `normalizeCommandShape`, the fingerprint/reporterId derivations, the salt, the append and the tolerant reader.
- `lib/src/operations.ts` — `frictionOperation`, the one envelope assembler; `lib/src/index.ts` re-exports the surface.
- `cli/src/cli.ts` — the `arggon friction` command wiring (JSON + human paths, no tracker loading).
- `skills/arggon-cli/SKILL.md` — the command added to the generated-commands region (mechanical listing; T6 owns the behavioral trigger block). `.convention.yml` x-generated checksum refreshed because the SKILL render moved.

### commandShape normalization

Split argv on whitespace; drop a leading `arggon`; keep flags (including `--flag=value`, where the value half is normalized separately); collapse every value-shaped token — anything containing `/` or `\\`, a dotted bare name, a long hex blob, a `gh[pousr]_`/`sk-`/`npm_`/`AKIA`/`JWT` token, a kebab-case id, a dashed digit group (dates), or an existing `<placeholder>` token — to one `<arg>`. A run of adjacent values collapses to one placeholder; plain words (`table`, `markdown`, `in_progress`, `p1`) survive. Idempotent, and the spec's own example (`start --worktree <id>`) converges with a pasted argv (`arggon start --worktree task-foo`) on one fingerprint.

### Where the salt lives

`<stateBase>/arggon/machine-salt` — 32 random bytes as hex, mode 0600, written `wx` (never overwritten; a loser of the creation race re-reads the winner's salt). `stateBase` is `ARGGON_STATE_DIR` when set, else the established `worktreeStateBase` mapping. The salt never reaches a record, the envelope, or stdout (asserted in both suites).

## Tests — 61 new, 2919 total green

lib/src/friction.test.ts (46) and cli/src/friction.test.ts (15).
