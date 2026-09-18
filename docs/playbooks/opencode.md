---
playbook_id: opencode
version: 2.0.7
researched: 2026-09-18
status: current
---

# OpenCode V2 playbook (opencode)

Technology playbook: the chosen version and the current best practices for
OpenCode **V2** in this repo.

**Research record (2026-09-17):** local `opencode v2.0.7`. Sources are the **V2**
docs only — https://opencode.ai/v2/docs/ (**accessed 2026-09-17**) — plus the
[exploration](../explorations/exploration-opencode-v2-native-009.md) and
[ADR 0010](../adr/0010-opencode2-native-architecture.md). Do not consult V1 docs
or the V1 schema for V2 work.

## Setup

- Install per https://opencode.ai/v2/docs/ (accessed 2026-09-17); verified local
  version: `opencode --version` → `v2.0.7` (2026-09-17).
- `arggon init` generates the tier-1 seam: `opencode.jsonc` **only when the repo
  has no OpenCode config of its own** (`opencode.json(c)` at the root or
  `.opencode/opencode.json(c)`), plus `.opencode/agents/arggon-{coordinator,worker,reviewer}.md`
  and `.opencode/commands/arggon-{next,start,done,handoff,review,status}.md` —
  never overwriting modified files (contract:
  [spec-opencode-seam-010](../specs/spec-opencode-seam-010.md)).
- MCP (https://opencode.ai/v2/docs/mcp-servers/): V2 does not use `.mcp.json`
  as a registration mechanism — register the server under `mcp.servers` as
  `{ "type": "local", "command": ["arggon", "mcp"] }`; the generated
  `.mcp.json` still serves other clients (e.g. Claude Code). Check with
  `opencode mcp list` / `/mcps`.
- Skills (https://opencode.ai/v2/docs/skills/): `.agents/skills` is auto-discovered,
  so the bundled `arggon-cli` (and `arggon-upgrade`) load with no config.
  Discovery order: `.claude/skills` → `.agents/skills` → global
  `~/.config/opencode/skills` → project `.opencode/skills` → explicit `skills`
  entries.
- Instructions (https://opencode.ai/v2/docs/instructions/): `AGENTS.md` is the
  only instruction mechanism (global plus every in-scope project `AGENTS.md`,
  combined). V2 **ignores `CLAUDE.md`** — the generated shim serves other tools,
  not V2 — and accepts but does not load the `instructions` config array.

## Conventions

- **Never invent V2 fields from the V1 schema.** V2 server names live under
  `mcp.servers` (never directly under `mcp`), servers switch off with `disabled`
  (there is no `enabled`), and V1-era keys (`autoupdate`, `tools`, `maxSteps`,
  `permission`) are wrong here. `https://opencode.ai/config.json` is the
  field-level source of truth.
- Config precedence (https://opencode.ai/v2/docs/config/): files merge farthest
  → closest, direct `opencode.json(c)` then `.opencode/opencode.json(c)`, so
  **every `.opencode` config overrides every direct config**. Hence the seam
  writes the root config and skips (reporting `opencode.jsonc` in `skipped[]`)
  when any adopter config exists, instead of adding an overriding one.
- Keep `.agents/skills/arggon-cli` as the single skill copy: a same-ID skill
  under project `.opencode/skills` would override it.
- File-based agents/commands: `.opencode/agents/*.md` (`mode: primary|subagent`,
  ordered `permissions` — last match wins) and `.opencode/commands/*.md` (only
  `.md` discovered; project files replace same-named global commands). Generated
  prompts drive the `arggon` CLI/MCP; they never restate the rules
  (https://opencode.ai/v2/docs/agents/, https://opencode.ai/v2/docs/commands/).

## Testing

- Repo gates: `npm test` covers seam generation, never-overwrite/skip, JSONC
  validity and skill bundling parity; `arggon validate` covers tracker state.
- Fixture smoke: `arggon init` in a temp tree creates the seam; a second run
  leaves an edited `opencode.jsonc` byte-identical (adopter-owned); a tree with
  its own `opencode.json` reports the config skip and writes no `opencode.jsonc`.
- V2 session smoke: `opencode mcp list` shows `arggon` connected, the
  `arggon-cli` skill is discoverable and the `/arggon-*` commands are listed,
  and `arggon_next` resolves the next claimable item. Transcripts are the review
  evidence (ADR 0008 spirit); a scripted headless harness is planned.

## Security

- The MCP surface is a local stdio server (`arggon mcp`): no listener, no ports.
  The `_meta.sessionID` V2 sends on tool calls is opaque correlation only —
  never authentication (https://opencode.ai/v2/docs/mcp-servers/).
- Command shell blocks (`` !`…` ``) run outside the agent's tool-permission flow
  and argument placeholders expand before execution: never place untrusted
  arguments in one. The generated commands use no shell blocks
  (https://opencode.ai/v2/docs/commands/).
- Remote MCP servers and HTTP skill catalogs are untrusted: keep secrets out of
  config (`{env:NAME}` substitution; OAuth credentials stay outside the
  project) and prefer safe same-origin catalog paths.
- `.opencode/**` artifacts are reviewable code: read prompts and permissions
  before trusting a session to them.

## Upgrade policy

- Re-research when `arggon playbook status` flags this file stale (default 90
  days) and on every new 2.x minor — 2.0.x is young, hooks/API can drift. Read
  the V2 docs and the config schema, never V1 docs, then
  `arggon playbook refresh opencode --version <v>`.
- Field or shape changes land in `cli/src/docs.ts` + `templates/docs/opencode*`
  (and their tests) in the same PR as the refresh; no doc statement may
  contradict the shipped seam.
- Do not build on documented-inert V2 features (`instructions` array, agent
  `request` overlays, session sharing, `username`) — see the exploration's
  inert-surface table. The optional vendored plugin stays version-pinned and
  thin per [ADR 0010](../adr/0010-opencode2-native-architecture.md).
