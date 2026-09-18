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

### 2026-09-18 @Arggon
W2 (plan-opencode2-009 T6–T8) is implemented on `feat/task-opencode-v2-plugin`; draft PR: https://github.com/Arggon/ArggonManager/pull/325. Item stays `in_progress` for coordinator review (W3/T9–T10 deliberately NOT started).

**Deliverables**
- `opencode/plugins/arggon/index.ts` — thin dependency-free V2 Promise plugin: `ctx.mcp.transform` registers `{type:"local",command:["arggon","mcp"]}` only when `editor.get("arggon")` is absent; every path try/catch, log-once + no-op; no rules/tools/commands/session hooks.
- Bundling via `cli/src/docs.ts` (`BUNDLED_PLUGINS`, mirroring `BUNDLED_SKILLS`): tier-1 dest `.opencode/plugins/arggon/index.ts`, never-overwrite + `x-generated` provenance (template `opencode/plugins/arggon/index.ts`); `stampGeneratedContent` emits the TypeScript first line `// arggon:generated template="opencode/plugins/arggon/index.ts"` (one shared stamp path).
- `cli/src/plugin-copy.test.ts` byte-parity test (mirrors `skill-copy.test.ts`); `cli/src/init-opencode.test.ts` extended (created / untouched→updated / modified→skip / --backup archive+regenerate / provenance / parity / TS marker); `.gitignore` ignores the derived copy.
- `npm run smoke:opencode` (`smoke/opencode-smoke.ts`) — 5 real headless `opencode run` fixtures; exits 0 with `skipped: opencode not installed` when absent; NOT part of `npm test`.
- Docs: one line in `docs/agents.md` §OpenCode V2 and the playbook Setup/Testing sections.

**Smoke transcript (opencode v2.0.7, deepseek-v4-flash; fixture-scoped transcripts kept under each fixture `.smoke-evidence/`)**
```
== fresh init: bundled plugin loads and registers MCP
  ok init bundles the plugin           ok bundled plugin starts with // marker
  ok session runs in the fixture       ok plugin loads in the runtime
  ok arggon MCP server registered      ok model executed arggon_next successfully
== adopter config: plugin registers MCP without opencode.jsonc
  ok no opencode.jsonc written         ok plugin registers arggon MCP (no config entry)
  ok model executed arggon_next successfully
== never clobber: adopter-configured arggon server keeps running
  ok session still succeeds            ok plugin loads in the runtime
  ok adopter command ran (sentinel)    ok adopter config bytes untouched
== failure isolation: broken sibling plugin never breaks the session
  ok session survives (ISOLATED)       ok failure logged, not fatal
  ok healthy arggon plugin still registers MCP   ok CLI unaffected
== plugin absent: CLI and configured MCP keep working
  ok session runs without the plugin   ok config-registered MCP still connects
  ok CLI unaffected
smoke:opencode passed — 5 scenarios, 0 failures
```
Key log/transcript lines: `msg="loading plugin" id=<fixture>/.opencode/plugins/arggon`; `message="mcp connected" server=arggon tools=9`; `tool_use execute {"code":"return await tools.arggon.arggon_next({})"}` → `{"ok":true,...,"command":"next"}`; `WARN failed to load plugin plugin.id=broken cause="...synthetic smoke failure"` with the session still exiting 0.

**Gates:** build ok · `npm test` 68 files / 1080 tests passed · `npm run lint` ok · `arggon validate` ok (0 warnings) · `arggon spec validate` ok (16 docs, 0 warnings).

**Parity drift demo:** baseline copy hash b5c7843…; drift appended → test regenerates back to b5c7843… (drift line gone); source edited (`arggon-drift-demo`) → copy follows; reverted → b5c7843…; drift + chmod 444 (unresyncable) → test FAILS with EACCES, chmod 644 → green.

**Finding for the coordinator (not filed):** on OpenCode 2.0.7 a static `import { Plugin } from "@opencode/plugin"` makes an auto-discovered plugin fail to load in a tree without `node_modules` (`Cannot find package '@opencode/plugin'`), while the plain default export loads and connects MCP fine. The shipped plugin uses a guarded dynamic import of `Plugin.define` with a plain-object fallback; if desired, a follow-up item can track upstream V2 resolution of `@opencode/plugin`.

**Notes / deviations:** two files outside the stated ownership list were necessarily touched — `cli/src/init.test.ts` (hardcoded `TIER1_DOCS` gained the new destination) and `.gitignore` (derived copy); `doctor.ts`/`doctor.test.ts` untouched (the fixture-layout asymmetry is handled in `docs.ts`: bundled sources count as current destinations even when an injected fixture omits the sibling `opencode/` tree). Known bug `bug-start-worktree-node-modules` hit on worktree start and recovered per the documented symlink workaround.

### handoff 2026-09-18 @Arggon — next: Coordinator review of draft PR #325 (W2). On approval: merge to opencode2; W3 (T9-T10) starts then on this item's plugin source: session<->item correlation + bounded context injection + session renam…
- branch: feat/task-opencode-v2-plugin
- open questions: @opencode/plugin static import fails on 2.0.7 without node_modules (guarded dynamic import used; follow-up item?); smoke harness model defaults to opencode-go/deepseek-v4-flash via OPENCODE_SMOKE_MOD…
