---
spec_id: native-first-011
title: Native-first ArggonManager surface
status: implemented
created: "2026-09-19"
---

# Spec: Native-first ArggonManager surface (native-first-011)

## Purpose

Contract for the native-first rebuild decided in
[ADR 0011](../adr/0011-native-first-architecture.md). It replaces the ADR 0010
generated seam with native OpenCode surfaces over the same git-native tracker.

Invariants:

- **Git-native data** — the `ArggonManager/` tracker (Markdown + convention)
  is the only source of truth; runtime storage is a rebuildable cache.
- **One logic path** — tools, commands, hooks and the headless adapter all call
  the kernel library; no rule logic outside it.
- **Failure isolation** — every plugin path is feature-detected and wrapped; a
  failure logs once and no-ops; sessions never break.
- **Never overwrite** — generated artifacts keep provenance and adopter
  ownership (`init` semantics).
- **Context budget** — ADR 0006 limits hold; the item block stays ≤ 1024 UTF-8
  bytes; tool schemas are measured per wave.
- **Exclusive runtime** — OpenCode V2 is the target; non-OpenCode clients are
  out of scope (MCP is a conditional adapter, not shipped by default).
- **Pinned runtime** — OpenCode 2.0.12 (playbook refresh filed as
  `task-playbook-opencode-2-0-12`).

## Synopsis

```text
# Daily UX (inside OpenCode V2)
/arggon-next, /arggon-start, ...       native commands driving native tools
arggon_list / arggon_create / ...      native tools, namespace `arggon` (Code Mode)
Ctrl+P → arggon board panel             TUI surface for status/board

# Bootstrap + CI (headless, no model)
npx arggon-manager init                generate/refresh the seam (provenance)
npx arggon-manager validate --json     CI gate
npx arggon-manager doctor --json       installation/health report
```

### Tools

Native tools are registered with `ctx.tool.transform` under the `arggon`
namespace with `options.codemode: true`. Their inputs and outputs mirror the
documented `--json` envelopes (`ArggonManager/docs/json-output.md`); kernel failures surface
as tool errors, never as throws through hooks.

| Tool                                  | Kernel                  |
| ------------------------------------- | ----------------------- |
| `arggon_list`, `arggon_show`          | `list`, `show`          |
| `arggon_create`, `arggon_update`      | `create`, `update`      |
| `arggon_next`, `arggon_report`        | `next`, `report`        |
| `arggon_validate`                     | `validate`              |
| `arggon_comment`, `arggon_handoff`    | `comment`, `handoff`    |
| `arggon_priority`                     | `priority`              |
| `arggon_sync`, `arggon_import_issues` | `sync`, `import-issues` |

### Commands

Native commands replace the CLI-driving prompt templates:
`/arggon-{next,start,done,handoff,review,status,spec,adr,explore,playbook,adopt}`.
Commands drive tools, never the headless adapter; `$ARGUMENTS` follows the V2
commands contract; commands may select `agent`, `model` or `subagent`.

### Agents and permissions

The coordinator/worker/reviewer roles are unchanged. The review bar stays
encoded as permissions (reviewer `edit` denied); the coordinator gets a
subagent allow-list. Kernel invariants (never steal a claim, never reopen
`done`/`cancelled`) are enforced by the kernel regardless of permissions;
permissions are defense in depth, not the rule source.

### Worktrees

Item worktrees use the worktree domain (`ctx.worktree.create/list/remove`),
named `<repo>-<id>`, recorded as `worktree_path` (tracker state) and removed by
cleanup once the item is done and the branch is merged. Git remains the
substrate; the domain supplies inventory and lifecycle. Branch creation and
deletion stay part of the start/cleanup lifecycle, with branch state read
through `ctx.vcs`.

### TUI

Board and status surfaces live in TUI panels/routes registered by the plugin
(`session.panel`, sidebar slots) with commands to open them. The static HTML
board remains available as an optional artifact.

### Context and hygiene

The session `context` hook injects the bounded item block; a detected claim
renames the session; a post-commit check warns when `validate --json` fails.
All paths are feature-detected and non-blocking.

### Config seam and plugin

`init` generates `opencode.jsonc` **without the MCP stanza** (formatter +
compaction retention + optional permission defaults) and vendors a
**single-file, dependency-free** plugin build under `.opencode/plugins/arggon/`
with the generated marker. The npm package is the distribution source; adopter
trees do not need `node_modules` for the plugin to load.

### Distribution

Two npm packages ([ADR 0013](../adr/0013-lib-package-split.md), amending
[ADR 0011](../adr/0011-native-first-architecture.md) §5): **`@arggondev/lib`** is
the kernel package (items, rules, paths and the `--json` envelopes; no runtime
dependencies, no printed output, no bundled assets), and **`arggon-manager`**
ships the headless bin + plugin and depends on `@arggondev/lib` through the
workspace. The vendored plugin stays a **single-file, dependency-free bundle
built from `@arggondev/lib`** (never an npm dependency of adopter trees), so a
fresh `init` still needs no `node_modules`. The `init`/`validate`/`doctor`
headless surfaces stay in the `arggon-manager` bin, and the kernel entry is the
versioned boundary the native tools (W2/W3) consume.

### Headless adapter

`init`, `validate`, `doctor` (plus `list`/`show --json` for diagnostics) stay
in the packaged bin for bootstrap and model-less CI. Every other capability is
reachable through native tools. The `--json` envelopes remain the contract
(`ArggonManager/docs/json-output.md`). The headless artifact is transitional: the criteria
for moving to candidate A (fully native, no adapter) are recorded in ADR 0011.

### Data contract

`ArggonManager/` follows `ArggonManager/docs/convention.md`; runtime storage
keys are namespaced and
cache-only (for example `arggon:session-item:<sessionID>`), never
authoritative.

### Layout

The tracker root is `ArggonManager/` and all product docs live under
`ArggonManager/docs/` ([ADR 0012](../adr/0012-tracker-root-layout.md)). Legacy
`tasks/` trees are auto-detected: the kernel keeps operating on them and the
migration command moves the tree and docs (idempotent, provenance-safe), with
`validate` reporting the legacy location. No hard break.

### Migration

From the ADR 0010 surface: re-running `init` refreshes the generated plugin,
commands, agents and skill. A pre-existing MCP stanza in an adopter config is
left untouched (reported by `doctor` with removal guidance). Convention
migrations keep using the kernel.

### Testing and evidence

Kernel unit tests; tool contract tests (tool output ≡ `--json` envelope);
headless smoke scenarios per wave (`opencode run`); `context:report --strict`
as the ADR 0006 gate; CI green required for every wave.

## Acceptance

- [ ] A fresh `init` in an empty repo yields a working native surface (tools,
      commands, agents, TUI panels, vendored plugin) with no MCP stanza and no
      `node_modules` requirement.
- [ ] Every tool's output matches its declared contract (parity test vs
      `ArggonManager/docs/json-output.md`).
- [ ] Claim → worktree → review → done runs end-to-end through native surfaces
      in headless smoke.
- [ ] The headless adapter covers bootstrap + CI (`init`, `validate`, `doctor`,
      `--json`) without a model.
- [ ] Context budgets re-measured within ADR 0006 limits; item block ≤ 1024 B.
- [ ] Migration from an ADR 0010 tree is idempotent and never overwrites
      adopter files.
- [ ] Legacy `tasks/` trees are auto-detected and migrate to `ArggonManager/`
      without a hard break.
- [ ] Distribution: two packages (`@arggondev/lib` kernel + `arggon-manager`
      bin/plugin), and the prebuilt plugin loads without dependencies.
