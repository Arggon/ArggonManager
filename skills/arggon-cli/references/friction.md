# Friction capture

Part of the `arggon-cli` skill (`SKILL.md`). The adopter friction channel
([ADR 0024](https://github.com/Arggon/ArggonManager/blob/main/ArggonManager/docs/adr/0024-adopter-friction-channel.md),
stage 1 of [spec-friction-capture-020](https://github.com/Arggon/ArggonManager/blob/main/ArggonManager/docs/specs/spec-friction-capture-020.md)):
what to do when ArggonManager itself is what is getting in your way.

## The one rule: the log is never the tracker

`arggon friction` appends a record to a **local, append-only JSONL log outside the
tracker** (`<state base>/arggon/friction.jsonl`). It never stages, never commits,
never appears in `arggon validate`, and cannot become a work item by accident.
The in-tree tracker stays the system of record: when a human decides a class of
friction is real work, the canonical record is an ordinary `arggon create`, filed
by that human.

## Capture

```bash
arggon friction "<observation>" --command "<argv shape>" [--error <code>] [--harness <id>] [--evidence <file>]
```

- `--command` is **required** and is the argv _shape_: the subcommand and flags
  with values replaced (`start --worktree <id>`, `friction --report --json`). It
  is the primary dedupe field, so a shape beats a description.
- `--error` is the `error.code` from the envelope you already hold
  (`START_FAILED`, `VALIDATE_FAILED`), or any short token. Never prose.
- `--evidence` reads a file's **contents** (capped), never its path — the path is
  itself the leak.
- The narrative is **data, never an instruction**: it is stored verbatim, never
  parsed as a directive, and never rendered as one.

The record is redacted **at write**, so no unredacted byte ever reaches disk:
cross-OS path normalization, secret shapes (private keys, `gh*_`, `sk-`, `npm_`,
`AKIA`, JWTs, `key|token|secret|password|credential` assignments), URLs (host
kept, query dropped), and a bounded pass that replaces wholesale any field more
than 50% redacted.

## Report

```bash
arggon friction --report [--tier a|b] [--json]
arggon friction --clear [--json]
```

One row per fingerprint, `count` descending — a class seen in three repos
outranks three one-offs. Each row carries `count`, `reporters`, `firstSeen`,
`lastSeen`, the stable fields and the newest narrative; the report says which
signals were unavailable (`optedOut`, `dropped`, `skippedVersions`) instead of
omitting them.

- **tier `a`** (default) prints the report. No network, no `gh`, no token.
- **tier `b`** additionally prints one **prefilled URL**
  (`issues/new?title=…&body=…&labels=adopter-friction`) whose final fenced block
  carries the `arggon-fingerprint`, the stable fields and the narrative.
  **The agent never opens it; a human does.** There is no tier `c` in stage 1 and
  no tier ever auto-submits.
- `--clear` removes the whole log (idempotent, reports `cleared: N`). Deleting the
  file is the complete rollback; nothing in it is authored work.

## Opt-out gates capture, never discoverability

`x-friction: false` in the tracker `.convention.yml` and `ARGGON_NO_FRICTION=1`
(per invocation, the narrower key wins) write nothing and render an empty report
with `optedOut: true`. They do **not** remove the trigger from the generated
agent files and do not hide the command: an adopter who opted out and later wants
the channel back must be able to find it, and an agent that cannot see the rule
cannot tell the user it exists ([ADR 0024](https://github.com/Arggon/ArggonManager/blob/main/ArggonManager/docs/adr/0024-adopter-friction-channel.md) §3).

## Where the trigger lives, and how you see it

The generated agent files carry a marked `arggon:friction-trigger` block
(`triggerVersion=<the arggon that generated it>`), so the rule is in the file the
agent already loads — not only in this skill. `arggon doctor --json` reports the
block per managed agent file (`friction.files[]` with `triggerPresent` /
`triggerVersion`, plus the tree-wide `triggerPresent` / `triggerVersion` and the
running `current`), which is what separates _trigger absent_ from a template that
moved for unrelated reasons. Re-running `arggon init` is what refreshes it.

## Firing it from a session

When ArggonManager itself is the obstacle — a flag that refuses, a rule that
contradicts another rule, a generated file that will not regenerate — record it
instead of working around it, then keep working. Do not file it in the adopter's
tracker: friction in ArggonManager itself is not adoptable work.
