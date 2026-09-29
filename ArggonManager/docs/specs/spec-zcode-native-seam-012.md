---
spec_id: zcode-native-seam-012
title: ZCode native seam (MCP full surface + declarative plugin)
status: proposed
created: "2026-09-29"
---

# Spec: ZCode native seam (zcode-native-seam-012)

Decision record: [ADR 0014](../adr/0014-zcode-native-seam.md). Programme:
`native-zcode-integration` (tasks `task-mcp-full-surface`,
`task-zcode-plugin-seam`).

## Purpose

Make ArggonManager native to ZCode at the same bar as the OpenCode V2 seam,
using ZCode's own extension model: MCP as the only typed tool surface, a
declarative plugin for commands/agents/hooks, and hooks replacing the
per-agent permission DSL. The kernel stays the single logic path; no client
gets a bypass around the update rules.

## Invariants

- **One surface.** MCP behavior is identical regardless of how the server was
  registered (plugin `mcpServers` or manual `mcp.servers.arggon`); no
  client-conditional tool sets.
- **Kernel rules are absolute.** `arggon_update`/`arggon_start` run with agent
  playbook rules (no reopen of done/cancelled, no claim steal); the six new
  tools add no force path.
- **Envelope parity.** Every tool returns exactly the documented `--json`
  envelope of its CLI counterpart; tool schemas mirror CLI options
  (`mcp-parity.test.ts` maps them both ways).
- **Never overwrites.** `init --full` treats generated ZCode seam files with
  the same never-overwrite + provenance semantics as every other generated
  doc; adopter-edited files are skipped, not clobbered.
- **No shell assembly.** CLI-spawning tools pass argv arrays; hook scripts
  parse stdin JSON and exit 0/2 — nothing concatenates user input into a
  shell string.

## Synopsis

```bash
arggon mcp   # 15 tools: list create update comment handoff show next report validate
             # + priority sync import_issues start branch cleanup
```

New tools: `arggon_priority {dry_run}`, `arggon_sync {check?, write?, repo?}`,
`arggon_import_issues {repo?, dry_run, …}`, `arggon_start {id, assignee?,
worktree?, open_pr?}`, `arggon_branch {id}`, `arggon_cleanup {prune?}` —
the last four spawn the CLI (`arggon <command> --json …`) and return its
envelope; kernel failures surface as tool errors, the session continues.

Plugin (generated at `.zcode-marketplace/`): manifest + 11 commands
(`/arggon-*` referencing `mcp__arggon__*` calls) + 3 agents + `hooks/`
dispatch-scoped reviewer backstop and global git gates.

## Acceptance

- [ ] `arggon mcp` exposes 15 tools; option-surface parity test covers all of
      them; envelope parity tests cover the new tools
- [ ] `priority`/`sync` run in-process through the kernel operations
- [ ] `import_issues`/`start`/`branch`/`cleanup` spawn the CLI with argv
      arrays, bounded output, and a timeout; a killed child becomes a tool
      error, never a dead session
- [ ] Plugin seam generates with provenance, never overwrites, and its
      manifest paths stay inside the plugin root
- [ ] Reviewer backstop denies mutations only while a reviewer dispatch is
      in flight; global git gates deny for every session; both unit-tested
      against the script contract
- [ ] `docs/agents.md` init section documents the ZCode seam in the same PR
