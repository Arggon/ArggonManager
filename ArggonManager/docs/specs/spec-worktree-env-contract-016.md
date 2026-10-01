---
spec_id: worktree-env-contract-016
title: Worktree environment contract
status: proposed
created: 2026-10-01
---

# Spec: Worktree environment contract (worktree-env-contract-016)

Implements layer 1 of [ADR 0019](../adr/0019-worktree-runtime-isolation.md)
(decision recorded in [exploration-worktree-env-isolation-017](../explorations/exploration-worktree-env-isolation-017.md)):
give every `start --worktree` checkout a runtime environment that lets N
worktrees of the same project run concurrently without colliding, at zero
marginal cost, on all supported platforms (linux/macos/windows), requiring no
new tooling — no Docker, no network, no shell.

## Purpose

Per-item worktrees isolate *files*, not *runtime state*: fixed ports, shared
databases and singleton state dirs make parallel runs of the same project
collide. The kernel already computes a per-worktree identity (item id, repo
name, branch, path) when preparing a worktree; this spec turns that identity
into a **portable environment contract** a project's own code and compose
conventions can consume.

Invariants:

- **Never overwrites** an existing `.arggon.env` or `.env` in the worktree.
- **Never stages or commits** env files — the claim commit contains only the
  item file (existing rule, extended).
- **Never blocks the claim**: env preparation is best-effort; any failure is
  recorded in the receipt as a warning while the claim proceeds.
- **No Docker, no network, no shell** — the whole path is filesystem-only and
  portable across the three supported platforms.
- **Additive JSON only**: new receipt fields are additive; `schemaVersion`
  unchanged.

## Synopsis

No new command or flag. Behavior is added inside the existing
`arggon start <id> --worktree` (CLI) and `tools.arggon.start` (native MCP
surface) dependency-preparation path. Opt-out via the tracker
`.convention.yml`:

```yaml
x-worktree:
  env: false   # default: absent ⇒ enabled
```

### The env file

Path: `<worktree>/.arggon.env`. Format: `KEY=value` lines, UTF-8, LF, no
quoting. Written on worktree creation; **on attach, an existing file is left
byte-identical**.

| Key | Value |
| --- | --- |
| `ARGON_ITEM` | the item id — the exact name the OpenCode plugin already correlates sessions with (`opencode/plugins/arggon/index.ts` `ITEM_ENV`); the one deliberate non-`ARGGON_` prefix, kept for contract compatibility |
| `ARGGON_WORKTREE_ID` | `<repo>-<item-id>` (the worktree directory name) |
| `ARGGON_WORKTREE_PATH` | absolute worktree path |
| `ARGGON_WORKTREE_BRANCH` | the recorded working branch |
| `ARGGON_STATE_DIR` | per-OS state base + `/<repo>-<item-id>` suffix (created `mkdir -p`) |
| `ARGGON_CACHE_DIR` | per-OS cache base + `/<repo>-<item-id>` suffix (created `mkdir -p`) |

Per-OS bases follow the established platform conventions (XDG on Linux,
`~/Library` on macOS, `%LOCALAPPDATA%` on Windows — the
[env-paths](https://github.com/sindresorhus/env-paths) mapping), resolved by
the kernel; arggon invents no new scheme.

**`.env` seeding:** if the primary checkout has a `.env` and the worktree has
none, it is **copied** (never overwritten, never read for interpretation);
recorded in the receipt as `seededDotenv`.

**Gitignore probe:** start never edits `.gitignore`; it probes
`git check-ignore .arggon.env` read-only and reports the boolean. `arggon
init` gains `.arggon.env` in its generated `.gitignore` template.

### JSON shape (additive)

`preparation` (CLI `--json` envelope and native receipt) gains:

```json
"env": {
  "written": true,
  "path": "<worktree>/.arggon.env",
  "keys": ["ARGON_ITEM", "ARGGON_WORKTREE_ID", "…"],
  "seededDotenv": "<worktree>/.env",
  "gitignored": true,
  "warning": "only on written:false"
}
```

`written:false` with a `warning` (and no other fields guaranteed) covers:
opt-out via `x-worktree.env: false`, write failure, unreadable state. The
claim is never refused for any of these.

### Degradation

Adopters who read none of the keys are unaffected: no flag changes, no
output changes beyond the additive receipt field, no new files beyond
`.arggon.env` (+ a seeded `.env` when applicable). Projects pull the
convention in by reading the keys; nothing is pushed onto them.

## Acceptance

- [ ] Fresh `start --worktree` writes `.arggon.env` with exactly the six documented keys; a unit test asserts content shape (kernel-level, no CLI dependency).
- [ ] Attach re-run leaves an existing `.arggon.env` byte-identical (never-overwrite test).
- [ ] `.env` is copied from the primary checkout only when the worktree has none; an existing `.env` is never modified (test).
- [ ] `ARGGON_STATE_DIR`/`ARGGON_CACHE_DIR` resolve per-OS and the directories exist after start (test asserts existence, not location — location is platform-conventional).
- [ ] `preparation.env` appears in both surfaces (CLI `--json`, native `tools.arggon.start` receipt); `mcp-parity` and skill-copy tests stay green; `docs/json-output.md` documents the field.
- [ ] Env files are never staged or committed: the claim commit contains only the item file (`smoke:native-start-cold` leg).
- [ ] `x-worktree.env: false` skips the whole path and reports `written:false` + reason (test).
- [ ] `arggon init` generated `.gitignore` includes `.arggon.env` (init test updated).
- [ ] Docs updated in the same PR: `README.md` (worktree section), `ArggonManager/docs/json-output.md`, `ArggonManager/docs/agents.md` §4, `ArggonManager/docs/convention.md` (`x-worktree.env` key).
- [ ] `npm test` green; `npm run build` + `check:plugin` green; `npm run smoke:native-start-cold` green.
