---
type: task
status: done
id: task-opencode-v2-plugin
title: "Optional OpenCode V2 plugin: MCP auto-registration and item context"
assignee: Arggon
branch: feat/task-opencode-v2-plugin
parent: story-opencode-v2
labels: []
priority: p3
created: "2026-09-18"
updated: "2026-09-19"
depends_on: [task-opencode-v2-adr, task-opencode-v2-spec]
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

- [x] **Skeleton + bundling (W2):** source `opencode/plugins/arggon/index.ts`
      bundled by `init` to `.opencode/plugins/arggon/` with a generated marker
      and an `x-generated` provenance entry; byte-parity test against the
      bundled copy (mirrors `skill-copy.test.ts`); init re-runs refresh
      untouched copies and skip modified ones.
- [x] **MCP auto-registration:** `ctx.mcp.transform` registers the arggon
      server only when `editor.get("arggon")` is absent (never clobbers a
      configured server); a pre-existing config is respected.
- [x] **Failure isolation:** every plugin path is wrapped so any failure logs
      and no-ops; CLI and MCP keep working with the plugin broken or absent;
      no-op outside ArggonManager trees.
- [x] **Smoke harness:** scripted `opencode run` evidence (`npm run
      smoke:opencode`) asserting skill discovery, agents/commands visibility,
      MCP registration, context injection and a full next → start → done cycle
      on a fixture; transcripts stored as review evidence.
- [x] **Session correlation + context (W3):** resolves the active item from
      observed `arggon` calls (storage map), VCS branch fallback and env
      override; injects a bounded `arggon show --json`-shaped block through
      `session.hook("context")`; present after compaction (per-call injection);
      measured block size within the documented bound.
- [x] **Session ergonomics + hygiene (W3):** renames the session to the claimed
      item id; surfaces the worktree path for `session_move` guidance;
      optional warning on failing `arggon validate --json` after a shell commit
      (never blocking; pre-commit/CI stay authoritative).
- [x] Docs updated in the same PRs (playbook, `docs/agents.md`), and no rule
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

### 2026-09-18 @Arggon
### 2026-09-18 @Arggon — W3 complete (plan-opencode2-009 T9–T10), draft PR #327
W3 landed on `feat/task-opencode-v2-plugin`; PR: https://github.com/Arggon/ArggonManager/pull/327. Item stays `in_progress` for coordinator review (no merge, no done flip).

**Deliverables**
- `opencode/plugins/arggon/index.ts` — W2 MCP auto-registration unchanged; W3 adds: item resolution (`ARGON_ITEM` env → per-session `ctx.storage` map set from observed tool executions — shell `arggon show|update|comment|handoff|branch|start`, `arggon_*` MCP calls, Code Mode `execute` code — → VCS branch `feat/<id>`/`fix/<id>`); bounded injection via `session.hook("context")` from `arggon show <id> --meta --json` (`execFile` arg array), cached 5 s, block ≤ **1024 B** (per-field clipping + line-bound truncation), marker-deduped per call; session rename on claim (`ctx.session.update({sessionID,title})` on 2.0.7, where `ctx.session.rename` is absent); `worktree_path` surfaced as `session_move` guidance; after a shell `git commit`, `arggon validate --json` failure logs a bounded warning (never blocking). Every path try/catch + log-once; no `tasks/`, no resolution or no CLI → silent.
- `opencode/plugins/arggon/index.test.ts` — 14 unit tests for the pure helpers. Placed next to the plugin (not `cli/src`): `tsc` rootDir is `cli/src` and the plugin must stay out of the CLI build graph (TS6059; no `@opencode/plugin` types by design). `vitest.config.ts` includes `opencode/**/*.test.ts`; rationale documented in the test header.
- `smoke/opencode-smoke.ts` — 6 new headless scenarios (11 total): branch injection + rename, storage-map correlation on a non-matching branch, `ARGON_ITEM`, silence when nothing resolves, silence without `tasks/`, post-commit validate warning. W2's 5 scenarios stay green; skip path intact; still out of `npm test`.
- `docs/playbooks/opencode.md` — W3 behavior (bounded, optional, degraded) + 2.0.7 probes.

**2.0.7 probe (real sessions, `--print-logs`)**
- `ctx.session.hook("context")` present; event `{sessionID, model, system[], messages, options, agent, tools}`; pushing a text part into `system` reaches the model.
- `ctx.tool.hook("execute.before"/"execute.after")` present; shell event `{tool:"shell",sessionID,agent,messageID,id,input:{command},status:"completed",result}`.
- `ctx.storage.{get,set,remove,scan}` present (roundtrip + scan verified).
- `ctx.session.rename` **absent** → `ctx.session.update({sessionID,title})` performs the rename (title persisted, verified via `opencode session list`); `ctx.session.get`/`move` present.
- `ctx.vcs.get()` returns `{location, data:{branch:{}}}` — empty branch even with remotes; `ctx.vcs.branches` absent (`ctx.vcs.branch.list()` has no "current") → `git rev-parse --abbrev-ref HEAD` fallback.
- `ctx.shell.hook("create.before")` present (unused: `execute.after` covers the commit check).

**Measured block size:** 181–204 B (bound 1024 B; ≈ 45–51 tokens at 4 chars/token). Exact lines: `[arggon] context: injected item task-smoke-item (204 bytes)`; `[arggon] session renamed to task-smoke-item`; `[arggon] validate failed after git commit: 1 error(s); first: unknown status 'nope'`.

**Compaction:** cannot be forced deterministically headless; the hook fires per agent-loop model call (scenario 7 shows the block on a later call of the same session), so the post-compaction call re-injects by construction — documented in smoke header + playbook.

**Smoke run (`npm run smoke:opencode`, v2.0.7):** `smoke:opencode passed — 11 scenarios, 0 failures` (W2 5/5 green). Transcripts: each fixture's `.smoke-evidence/` (fixtures kept with `ARGON_SMOKE_KEEP=1`).

**Gates:** build ok · `npm test` 69 files / 1094 tests passed · `npm run lint` ok · `arggon validate` ok (0 warnings) · `arggon spec validate` ok.

**docs/agents.md — not edited on purpose (other W3 worker owns it):** §OpenCode V2 (~line 284) still says "W2 scope: MCP auto-registration only; session↔item context is W3"; replace with the W3 behavior (bounded ≤1024 B context injection via `session.hook("context")`, correlation order env/storage/branch, rename on claim, non-authoritative post-commit warning).

### handoff 2026-09-18 @Arggon — next: Coordinator: review draft PR #327 (W3 T9-T10; W2 scenarios kept green). Verify plugin thinness, the 1024 B bound, silent paths. If accepted: merge to opencode2, verify, then W4 (T12).
- branch: feat/task-opencode-v2-plugin
- open questions: docs/agents.md W3 paragraph owned by the MCP-meta worker (reported, not edited); ARGON_ITEM env name follows the task text (ARGON vs Arggon); compaction not forceable headless (per-call injection evi…

### 2026-09-18 @Arggon
Coordinator merge verification: review verdict NO-MERGE→fixed (F1 docs/agents.md W3 scope refreshed in 515aeae; F2-F8 filed as task-opencode-v2-plugin-hardening); blocking smoke 11/11 on opencode v2.0.7; merged with cli pass. W2+W3 complete — closing.
