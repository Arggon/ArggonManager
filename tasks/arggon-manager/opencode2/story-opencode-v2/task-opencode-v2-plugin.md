---
type: task
status: in_progress
id: task-opencode-v2-plugin
title: "Optional OpenCode V2 plugin: MCP auto-registration and item context"
assignee: Arggon
branch: feat/task-opencode-v2-plugin
parent: story-opencode-v2
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-18"
claimed_at: "2026-09-18T01:35:48.435Z"
depends_on: [task-opencode-v2-adr, task-opencode-v2-spec]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-opencode-v2-plugin
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2/story-opencode-v2/task-opencode-v2-plugin.md
  Leaves live only under a story. id is the filename stem: task-opencode-v2-plugin.
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Optional OpenCode V2 plugin: MCP auto-registration and item context

## Context

W2 + W3 of [plan-opencode2-009](../../../../docs/plans/plan-opencode2-009.md)
(T6–T10). The plugin is the only layer that can provide **ambient** behavior:
zero-config MCP discovery, session ↔ work-item correlation, bounded item
context per model call, session ergonomics and hygiene signals. Per
[ADR 0010](../../../../docs/adr/0010-opencode2-native-architecture.md) the
plugin contributes ambient behavior only — the MCP server remains the tool
surface, every state transition still goes through the kernel, and the plugin
is optional and failure-isolated.

## Acceptance

- [ ] **Skeleton + bundling (W2):** source `opencode/plugins/arggon/index.ts`
      bundled by `init` to `.opencode/plugins/arggon/` with a generated marker
      and an `x-generated` provenance entry; byte-parity test against the
      bundled copy (mirrors `skill-copy.test.ts`); init re-runs refresh
      untouched copies and skip modified ones.
- [ ] **MCP auto-registration:** `ctx.mcp.transform` registers the arggon
      server only when `editor.get("arggon")` is absent (never clobbers a
      configured server); a pre-existing config is respected.
- [ ] **Failure isolation:** every plugin path is wrapped so any failure logs
      and no-ops; CLI and MCP keep working with the plugin broken or absent;
      no-op outside ArggonManager trees.
- [ ] **Smoke harness:** scripted `opencode run` evidence (`npm run
      smoke:opencode`) asserting skill discovery, agents/commands visibility,
      MCP registration, context injection and a full next → start → done cycle
      on a fixture; transcripts stored as review evidence.
- [ ] **Session correlation + context (W3):** resolves the active item from
      observed `arggon` calls (storage map), VCS branch fallback and env
      override; injects a bounded `arggon show --json`-shaped block through
      `session.hook("context")`; present after compaction (per-call injection);
      measured block size within the documented bound.
- [ ] **Session ergonomics + hygiene (W3):** renames the session to the claimed
      item id; surfaces the worktree path for `session_move` guidance;
      optional warning on failing `arggon validate --json` after a shell commit
      (never blocking; pre-commit/CI stay authoritative).
- [ ] Docs updated in the same PRs (playbook, `docs/agents.md`), and no rule
      logic exists in the plugin beyond calling the kernel.

## Notes

- Waves T6–T10 can land as separate PRs; the acceptance above is the union.
- Deliberately excluded: native plugin tools duplicating MCP, a plugin worktree
  strategy (`arggon start --worktree` stays authoritative), `experimental.ws.*`
  hooks.
- Depends on task-opencode-v2-spec for the bundling/generation contract.
