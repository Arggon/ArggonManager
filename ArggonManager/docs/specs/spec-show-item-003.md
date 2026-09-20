---
spec_id: show-item-003
title: arggon show <id> — progressive-disclosure read path
status: implemented
created: 2026-09-14
adr: ArggonManager/docs/adr/0006-token-context-efficiency.md
---

# Spec: arggon show <id> — progressive-disclosure read path (show-item-003)

## Purpose

Today there is NO `arggon show <id>`: agents read whole item files via the
filesystem, and every comment appended by `arggon comment` (~226 B) grows that
read unbounded — paid on every read, forever. ADR 0006 (token-context
efficiency) calls for a structural read path with bounded output by default.

Invariants:

- **Pure read.** `show` never writes: no lock, no frontmatter or body
  mutation, no tracker auto-commit, exit 0 on success.
- **Bounded by default.** The default output is compact: frontmatter fields +
  the item body's last N comments (default N=3, documented). Full body
  (including ALL comments) is the explicit `--body` opt-in.
- **One kernel.** CLI and MCP (`arggon_show`) call the same `runShow`;
  the parity harness covers `show` from day one.

## Synopsis

```bash
arggon show <id>                      # compact: meta + last 3 comments
arggon show <id> --meta               # frontmatter only, no body/comments
arggon show <id> --tail-comments 10   # compact with a different tail size
arggon show <id> --body               # full body incl. ALL comments (explicit unbounded opt-in)
arggon show <id> --json               # standard envelope {ok, schemaVersion, conventionVersion, command:"show", ...}
```

Flag precedence is simple and total: `--meta` (meta only) > `--body` (full
body) > `--tail-comments N` (compact with N) > default (compact with 3).
Combining flags is NOT an error; the highest-precedence flag wins.

### JSON payload

```json
{
  "ok": true, "schemaVersion": 1, "conventionVersion": 0, "command": "show",
  "item": { ...contract WorkItem fields... },
  "body": "<full markdown body>",           // only with --body
  "comments": [ {"date": "...", "author": "...", "lines": ["..."]} ]  // omitted with --meta
}
```

`comments` carries the SAME tail selection as the human output (last N under
the default/`--tail-comments`; ALL under `--body`; absent under `--meta`).

### Errors

Unknown id (and missing `tasks/`, unreadable items) fail with
`error.code: "SHOW_FAILED"` (added to the documented enum in
ArggonManager/docs/json-output.md), exit non-zero.

### Comment grammar

A comment is a body section exactly as `arggon comment` appends it:
`### YYYY-MM-DD @<author>` heading followed by text lines until the next
`### <date> @<author>` heading or end of body. Anything before the first
comment heading is the item's prose body.

## Acceptance

- [ ] Default `show` on an item with many comments emits only the last 3 (bounded output)
- [ ] `--meta` emits frontmatter fields only; `--body` emits the full body with all comments
- [ ] `--tail-comments N` overrides the default tail size
- [ ] Unknown id fails with `SHOW_FAILED` (exit non-zero, `ok:false` envelope under `--json`)
- [ ] `--json` envelope follows the standard shape with `command: "show"`
- [ ] MCP `arggon_show` parity-tested via the standing parity harness (`show` in PARITY_COMMANDS)
- [ ] Pure read: no file writes, no lock, exit 0 on success
- [ ] Docs: README command list + example; ArggonManager/docs/json-output.md `show` section + SHOW_FAILED (additive)
