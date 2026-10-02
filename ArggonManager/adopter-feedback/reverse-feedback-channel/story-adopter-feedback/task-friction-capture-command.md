---
type: task
status: todo
id: task-friction-capture-command
title: arggon friction capture and the local friction log
parent: story-adopter-feedback
labels: [method]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
---

<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-friction-capture-command.md
  Leaves live only under a story. id is the filename stem: task-friction-capture-command.
  CLI `arggon create task friction-capture-command` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# arggon friction capture and the local friction log

## Context

Plan task T1 for [spec-friction-capture-017](../../../docs/specs/spec-friction-capture-017.md),
stage 1 of [ADR 0020](../../../docs/adr/0020-adopter-friction-channel.md).

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

- [ ] `arggon friction "<observation>" --command <shape> [--error <code>] [--harness <id>] [--evidence <file>] [--json]` exists and appends exactly one line per invocation.
- [ ] Every field in the spec's table carries its documented cap; a capped field is truncated, never silently dropped.
- [ ] `fingerprint` is `sha256(commandShape ‖ "\x1f" ‖ errorCode ‖ "\x1f" ‖ harness ‖ "\x1f" ‖ majorVersion)` hex-truncated to 16 chars, and no code path reads `narrative` to build it.
- [ ] `reporterId` is stable for the same machine + repo and differs across machines; the salt is never written outside the state dir and never rendered.
- [ ] `ts` is ISO-8601 UTC from the kernel clock; no code parses a locale or non-ISO timestamp.
- [ ] Records carry `v: 1`; a reader skips an unknown `v` rather than failing the file.
- [ ] Log path resolves per-OS via the established state base and honors `ARGGON_STATE_DIR`; the directory is created `mkdir -p`.
- [ ] Empty observation fails with `FRICTION_FAILED` / `reason: "no-observation"`; an unwritable log fails with `reason: "log-unwritable"` plus the named path and leaves no partial line.
- [ ] Append is one `write()` of a complete record under `O_APPEND`; two concurrent writers in two worktrees produce well-formed, non-interleaved lines (test).
- [ ] RTL/CJK narrative round-trips verbatim through capture without reordering, escaping or mid-surrogate truncation (test).
- [ ] Rotation: past 5000 lines the oldest are dropped on write (test).
- [ ] Capture makes **no network request** — assert in a test that runs with the network denied.
- [ ] `npm test`, `npm run build`, `npm run check:plugin` and `npm run lint` green.

## Notes

Sibling tasks `task-friction-redaction-at-write` and `task-friction-dedupe-and-report`
both depend on this one. `task-friction-trigger-carrier` must land **after** them:
an agent file naming a command that does not exist is worse than no trigger.
