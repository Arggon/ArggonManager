---
type: task
status: in_progress
id: task-native-tools
title: Native arggon tool namespace
assignee: Arggon
branch: feat/task-native-tools
parent: native-redesign
labels: []
priority: p0
created: "2026-09-19"
updated: "2026-09-20"
claimed_at: "2026-09-20T11:38:53.308Z"
depends_on: [task-native-lib-package]
worktree_path: /home/arggon/Projects/ArggonManager-opencode2-task-native-tools
---
<!--
  Placement (v0): tasks/arggon-manager/opencode2-native/native-redesign/task-native-tools.md
  Leaves live only under a story. id is the filename stem: task-native-tools.
  CLI `arggon create task native-tools` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Native arggon tool namespace (W2)

## Context

W2 of `plan-native-first-011`. Register the `arggon` tool namespace with `ctx.tool.transform` (`options.codemode: true`) for list/create/update/show/next/report/validate/comment/handoff/priority and `sync`/`import-issues`, calling the kernel library in-process. Inputs/outputs mirror `docs/json-output.md`; kernel failures surface as typed tool errors.

## Acceptance

- [x] Headless smoke (`opencode run`) calls every tool and gets contract-shaped results.
- [x] Contract tests pin tool output ≡ `--json` envelope per command.
- [x] A kernel error returns a typed tool error; the session continues (failure isolation).
- [x] The namespace appears in the Code Mode catalog with the expected description.
- [x] ADR 0006 tool-schema measurement re-runs and stays within budget.

## Notes

- Depends on W1. MCP parity matters only if the conditional adapter is built.

### 2026-09-20 @Arggon
W2 native arggon tool namespace — implemented on `feat/task-native-tools`.

Registration: `opencode/plugins/arggon/index.ts` registers namespace `arggon`
(`ctx.tool.transform`, `options.namespace: "arggon"`, `options.codemode: true`)
with the twelve spec tools: list, create, update, show, next, report, validate,
comment, handoff, priority, sync, import_issues. Each tool calls the kernel
in-process (guarded, cached dynamic import of `@arggon/lib` — the same
`*Operation` the CLI's `--json` path uses) and returns the documented envelope.
A kernel `ok: false` throws `ArgonToolError` (typed: `code`, `command`,
`envelope`; the bounded envelope also rides in the message) instead of throwing
through a hook, so the session continues. `comment`/`handoff` default
author/session from the runtime session id (accepted only as a bounded token);
`create`/`import_issues` receive the `templatesDir` fallback resolved from the
plugin location (ADR 0013 — the kernel embeds no templates).

Evidence:
- `npm test` — 84 files / 1382 tests green (new `opencode/plugins/arggon/tools.test.ts`, 26 tests).
- `npm run lint` clean; `npm run build` ok (lib + root tsc); `arggon validate` ok (0 warnings); `arggon spec validate` ok (18 docs, 0 warnings).
- `npm run smoke:opencode` — real headless `opencode` v2.0.10, **12 scenarios, 0 failures**. New scenario "native tools (W2)" 14/14 checks: one Code Mode script calls all twelve tools → ten contract envelopes (`ok`/`schemaVersion`/`conventionVersion`/`command`), create→update round-trip, `comment`/`handoff` author `ses_…`, `sync`/`import_issues` caught inside the script as typed `SYNC_FAILED: …`/`IMPORT_FAILED: …` errors carrying the envelope while the session exits 0, `search({namespace:"arggon"})` returns the 12 `tools.arggon.*` paths (`remaining: 0`), and the tool writes are visible in the tracker through `arggon show --body`. Fixture links the workspace kernel; the dependency-less fresh-init scenario still logs no tool registration (guarded import).
- Contract suite `tools.test.ts`: per-tool byte parity against the CLI `--json` envelope on twin fixtures (8 read cases incl. `--full`/`--meta`/`--body`; 6 write cases incl. `priority migrate --dry-run` with tracker snapshots), typed-error tests (`SHOW_FAILED` envelope equality, `VALIDATE_FAILED` keeping `errors[]`, `LIST_FAILED`/`NEXT_FAILED` outside a tree), registration/namespace-description test, ADR 0006 schema-budget pin. `sync`'s failure envelope is pinned there too (fixture without a GitHub remote); `import_issues` shelling out to `gh` is covered by the smoke (gh resolves the repo from the process cwd, see finding 2).
- ADR 0006: `npm run context:report --strict` → all bounds pass. Native `arggon` tools: 10,925 B / 12 definitions ≤ 12,288 B advisory; MCP `tools/list` unchanged 10,507 B; injected item block 252 B ≤ 1024 B; fixed per-session total 24,302 B (MCP + native coexist until W3 drops the MCP stanza). Live Code Mode catalog line observed in a real session: `- arggon (20 tools, 3 shown) // ArggonManager tracker tools, in-process — …` — the namespace and its description render; the runtime draws a subset under its own ~2000-token catalog budget and `search` covers the rest.

Findings (reported, not fixed here):
1. Session correlation does not see native tool calls: `parseArggonItemFromTool`/`parseArggonItemFromCode` match the MCP names (`arggon_show`) but a Code Mode native call is `tools.arggon.show(...)`. When W3 makes the native tools the default surface, the observed-call correlation silently regresses unless the parser learns the `arggon.<name>(` form.
2. `import_issues`/`sync` shell out to `gh`, which resolves the repository from the *process* cwd — the kernel's `ghIssueListJson` does not forward the operation's `cwd`, so a native tool call can target the OpenCode server's cwd instead of the session directory (kernel scope, out of this item).
3. `loadArgonKernel()` caches the import result for the process lifetime: a long-lived `opencode serve` started before `lib/dist` exists keeps the namespace absent until restart.
