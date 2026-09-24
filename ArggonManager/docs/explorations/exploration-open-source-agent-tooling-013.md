---
exploration_id: open-source-agent-tooling-013
title: Open-source agent tooling for ArggonManager
status: open
created: 2026-09-24
---

# Exploration: open-source agent tooling for ArggonManager (open-source-agent-tooling-013)

**Decision in one sentence:** the highest-leverage improvement is not a new
agent framework: make native `tools.arggon.start` produce a truthful,
ready-to-run worktree and an explicit readiness result; then standardize
low-context CLI/test tooling, use `codebase-memory-mcp` for code intelligence,
and pilot the native V2 `opencode2-shell-tasks` plugin for long-running
interactive smoke. Keep browser plugins secondary and do not add a hosted
memory service, another tracker, or an agent execution framework to the
product.

This is a research recommendation, not an adoption decision. No runtime
dependency or product behavior changed in this exploration. A successful pilot
should be followed by a small dev-only playbook/ADR decision; a failed pilot
should be recorded here and closed without adding infrastructure.

## Scope and method

The question is not "which agent framework is most popular?" It is "which
open-source tool removes a measured bottleneck in ArggonManager while preserving
its operating principles?"

The comparison uses the repository at `35ee8435` (2026-09-24), the current
OpenCode V2 documentation, official project repositories/package metadata, and
local read-only checks. All external sources below were accessed **2026-09-24**.
Claims about a project's advertised capability are labelled as claims; local
checks are labelled separately.

### ArggonManager constraints that dominate the decision

1. The Markdown tree under `ArggonManager/` is the source of truth. Runtime
   storage is a cache, not a second tracker (ADR 0011, ADR 0012).
2. There is one kernel/logic path. CLI, MCP adapter, and native tools must not
   fork status, claim, or mutation rules.
3. Agent context is budgeted. The repository already measures generated docs,
   JSON payloads, and tool schemas; a new tool should not flood every session.
4. The product is TypeScript/Node 22 with Vitest, ESLint/Prettier, and Playwright
   as a development dependency. The shipped web board is a self-contained HTML
   artifact and the TUI is dependency-free.
5. A tool that improves *how agents develop ArggonManager* is not automatically a
   tool that belongs *inside ArggonManager*. This report separates those two
   decisions.

## Criteria

Candidates are ranked against the measured bottleneck and these constraints:

1. **Fit and leverage** — does it remove a measured ArggonManager development or
   acceptance bottleneck without replacing the existing kernel or UI contracts?
2. **License and maintenance** — is the license compatible with an external
   developer tool, and is the release/maintenance surface credible enough to
   revisit deliberately?
3. **Context and operational cost** — how many tool-schema bytes, processes,
   services, permissions, and setup steps does an agent or maintainer inherit?
4. **Source-of-truth safety** — can the tool remain outside the Markdown tracker
   and mutate repository state only through the shared kernel?
5. **Local-only reversibility** — can it be isolated, removed, and rolled back
   without a hosted account, remote database, or product runtime dependency?

## Findings

### Current-state evidence

| Signal | Measured/current state | Implication |
| --- | --- | --- |
| Tracker health | `arggon validate --json`: `ok: true`, zero errors and warnings | The baseline is stable enough to add tooling without first repairing the tracker. |
| Test baseline | `npm test -- --reporter=dot`: **95 files / 1,611 tests passed** (2026-09-24) | The next quality gain should target uncovered input/state spaces, not replace the existing suite. |
| Tracker size | Baseline `35ee8435`: `arggon doctor --json`: **320 items, 29 todo**; `report --json` shows **124 items in the `arggon-manager` report group** | Agent navigation and bounded reads matter; unbounded repository or tracker scans are already a known cost. |
| Native surface | `opencode/plugins/arggon/index.ts` registers 15 native tools: `list`, `create`, `update`, `show`, `next`, `report`, `validate`, `comment`, `handoff`, `priority`, `sync`, `import_issues`, `start`, `branch`, `cleanup` | Do not add another tracker/orchestrator that competes with these tools. |
| Context behavior | The plugin injects a bounded item block (hard maximum 1 KiB) and correlates sessions through storage/branch/environment | Persistent third-party memory is optional context, not a replacement for the tracker. |
| Context budget | `doctor --budget` (default temp root, 2026-09-24): five current runs returned generated `AGENTS.md` **2,021 B** and show **769 B**; an earlier run returned **2,020 B / 768 B** (default-root observed range **2,020–2,021 B / 768–769 B**). List remained **2,603 B / 3,539 B**; MCP schema **10,507 B / ~2,627 tokens**. Exact first/show values are process/path-qualified. | Treat the default-root range as qualified comparison evidence, not an invariant; `AGENTS.md` stays below 2,048 B, `show` remains bounded, and MCP stays below 12,288 B. |
| UI work | UI epic has 18 todo leaves (9 web-board, 6 TUI, 2 OpenCode panel, 1 foundation) | Browser automation has an immediate, visible use case; a terminal tool cannot cover the web board. |
| Existing smoke | CI already runs Playwright `@smoke` plus a PTY TUI frame check (`.github/workflows/ci.yml`) | A new browser tool should complement deterministic smoke, not replace CI. |
| Runtime constraints | UI epic explicitly permits dev-only tools but forbids new runtime UI dependencies | External tooling should remain opt-in and outside the published package. |
| Worktree readiness | The tracked P1 bug records native `tools.arggon.start` creating a worktree without preparing dependencies; the pre-commit gate then fails, the claim commit is skipped, and the tool can still return `ok:true` (initial report plus 3/3 wave-1 and 3/3 wave-2 occurrences) | Fix the default worker critical path before adding optional tools; readiness must be explicit and machine-verifiable. |
| Runtime version drift | Local `opencode --version` is **v2.0.16**, while `docs/playbooks/opencode.md` still pins **2.0.12** | Refresh/pin the playbook before depending on any beta V2 plugin; candidate compatibility must be tested against the actual runtime. |

`generatedAgentsMdBytes` and `showBytes` are process/path-qualified measurements,
not stable constants: `doctor --budget` builds a throwaway project whose name is
derived from a temporary path/PID, and `show --json` includes that path. The five
current default-root runs above returned **2,021 B / 769 B**; the earlier
observation returned **2,020 B / 768 B**. Alternate temp-root probes returned
show values of **778 B / 784 B / 824 B**, so **768–769 B is only the
same-environment comparison range**, not a global byte bound. The stable claims
are that `AGENTS.md` remains below its **2,048 B** budget and the MCP schema
remains **10,507 B / ~2,627 tokens**; neither conclusion changes.

The graph index was refreshed for this review (7,662 nodes / 19,622 edges,
2026-09-24). The cited local code paths had no recorded coverage gaps; the
two parse-partial test files and the intentionally ignored generated `.opencode`
copies were treated as source-fallback cases rather than graph-complete
claims. The two branch deliverables themselves were absent from the main
index (coverage freshness: `missing`), so they were read directly; structural
graph evidence is not used to claim that either document is complete.

### Version snapshot used for the comparison

| Tool | Version observed | Notes |
| --- | --- | --- |
| `codebase-memory-mcp` | `0.10.8` | Local binary; MIT; already configured in the current OpenCode environment. |
| `opencode-chromium` | `1.7.2` | npm release observed 2026-09-08; separate V2 export plus legacy-style default; security fix not yet released. |
| `@playwright/mcp` | `0.0.82` | npm release observed 2026-09-18; opt-in secondary fallback whose published OpenCode snippet requires V2 translation/verification. |
| `fast-check` | `4.10.2` | MIT; test-time dependency candidate. |
| `opencode2-shell-tasks` | `0.1.1` | MIT; native V2, but state outside the repository. |
| `opencode-planner` | `0.6.0` | MIT; dual V1/V2 adapter. |
| `ast-grep-mcp` (npm) | `0.0.2` | MIT; a separate Node package from `spiritledsoftware`, not the Python project described below. |
| `ast-grep/ast-grep-mcp` (Python) | `0.1.0` in `pyproject.toml` | MIT; experimental, Python >=3.13 and `uv` project. |

Versions are observations, not permanent pins. Re-check release notes and
licenses at implementation time.

## Candidates

### 0 — Ready-to-run native worktrees (highest leverage; no new external tool required)

This is the first candidate because the repository already contains a
reproducible failure in its default worker path. The tracked P1 item
`bug-native-start-worktree-no-install` records that native
`tools.arggon.start({ worktree: true })` creates the worktree and branch, but a
fresh worktree has no `node_modules`; the wired pre-commit validation fails with
`tsx: command not found`, the claim commit is skipped, and the returned result
does not make the lost commit sufficiently actionable. The same item records
the failure in the initial wave and in 3/3 workers in each of two later waves;
each worker had to run `npm ci` and recreate the claim commit manually.

The source explains the asymmetry:

- the CLI path prepares a link farm, builds worktree-owned workspace packages,
  runs the claim commit, and preserves the worktree with a named remediation on
  failure (`cli/src/start.ts`, `startInWorktree`);
- the native path calls the kernel update in the worktree and returns its
  success envelope, but does not perform the same install/build preparation or
  verify that the claim commit landed (`opencode/plugins/arggon/index.ts`,
  `nativeStart`);
- `commitTrackerMutation` is deliberately best-effort and reports a skipped
  commit rather than throwing (`lib/src/tracker-commit.ts`);
- the generated `/arggon-start` command promises that the native tool commits
  the claim before `session_move`, so the current behavior violates the
  command contract;
- the existing worktree smoke uses a dependency-less fixture and therefore does
  not exercise a dependency-requiring pre-commit gate.

**Recommended change:** make the native and CLI paths share one worktree
preparation/readiness implementation. The native `start` result should expose a
bounded readiness receipt such as `ready`, `claimCommitted`, `install`,
`linkedNodeModules`, `builtWorkspaces`, and a typed remediation when preparation
or commit fails. A failed required bootstrap must never be reported as an
unqualified `ok:true` success. This is a product reliability fix, not a reason
to add a runtime environment manager.

**Optional providers after parity:** a repository may choose `mise`, Devbox,
Nix, or a Dev Container as the mechanism that materializes its toolchain. Those
are adapters over a committed project contract, not mandatory ArggonManager
runtime dependencies. Start with the existing package-native install/build
commands so the fix works for every adopter.

**Verdict:** **Do this first; no external tool can substitute for the missing
contract.**

### A — `opencode2-shell-tasks` (native OpenCode V2 background jobs)

**What it is.** A MIT-licensed package with a real V2-shaped default export:
`Plugin.define({ id, setup(ctx) })`, `ctx.session.hook("context")`,
`ctx.tool.transform(...)`, and `ctx.session.synthetic(...)`. It adds four
focused tools—`background_bash`, `background_tasks`, `background_output`, and
`background_kill`—and reconciles detached process groups after restart.

**Why it fits ArggonManager.**

- Long test/build/Playwright/TUI runs are a real interactive-agent cost: an
  agent otherwise has to poll or block a turn while the command runs.
- It is local and session-scoped, so the actual Arggon worktree remains the
  working directory after a session move.
- It does not duplicate the tracker, board, item context, or worktree lifecycle.
  Background execution is a missing interaction primitive, not a second source
  of truth.
- The four tools are narrower than a browser/MCP catalog and can be enabled only
  in an individual OpenCode profile.

**Risks and caveats.**

- The published `0.1.1` package depends on the old
  `@opencode-ai/plugin@0.0.0-beta-18027`; it has no GitHub release/tag, and an
  isolated install added 197 packages. A local `npm audit --omit=dev` reported
  five low-severity findings and no available fix through the beta/OpenTUI
  dependency chain. Treat it as an experiment, not a stable dependency.
- Task metadata and logs live outside the repository. They are mode-restricted
  by default, but can still contain command output and secrets; use an isolated
  data root and do not commit or centralize them.
- The child process inherits the environment and `workdir` can resolve outside
  the session. `background_bash` needs an explicit `ask` permission and a
  reviewer deny; ArggonManager's existing `shell` denies do not automatically
  protect this new action.
- The bundled `/tasks` TUI has evidence of theme/API drift. Server-only testing
  is safer than relying on the panel.
- Its README currently requires a V2 beta runtime (`0.0.0-beta-*`); the local
  stable `v2.0.16` is not a proven target. Do not call the pilot compatible until
  a package-supported runtime is identified and tested.
- It is an interactive aid, not a CI replacement. Do not use it unattended or
  wire it into the deterministic GitHub Actions smoke.

**Local verification (2026-09-24).** The published tarball's source was
inspected and exposes the V2 APIs above. A temporary OpenCode project loaded the
plural `plugins` field, but the noninteractive `/api/plugin` response was empty;
runtime registration on v2.0.16 therefore remains unverified. The package's
own README requires a V2 beta runtime, so a compatible runtime is a precondition
for the pilot rather than an assumption.

**Verdict:** **Conditional, server-only pilot after the worktree fix.** If it
proves useful, the likely durable ArggonManager change is a small internal
background-task surface in the existing dependency-free plugin—not a permanent
second plugin and not a new tracker.

### B — `opencode-chromium` (native OpenCode V2 browser agent)

**What it is.** A MIT-licensed browser automation package with a native
OpenCode adapter, a browser extension/native messaging host, and a small
four-tool surface: `browser_run`, `browser_observe`, `browser_session`, and
`browser_finalize`. The package advertises structured observations, bounded
inline responses, artifact spillover, origin policies, file-root restrictions,
and approval-gated consequential actions.

**Why it fits ArggonManager.**

- It can exercise `arggon board --serve` against the real loopback server,
  including cards, filter lenses, PR badges, the detail drawer, SSE reload, and
  keyboard/focus behavior that the current deterministic smoke does not fully
  explore.
- Four compact tools and `codemode: false` are a better fit for ArggonManager's
  context budget than enabling a large general browser catalog by default.
- It is a development aid, not a tracker runtime. The agent can still mutate
  work only through `tools.arggon.*`; browser observations never become a
  second source of truth.
- It is local/self-hosted in the normal sense: Chromium, the extension, and the
  native host run on the developer's machine. No hosted account is required for
  the core pilot.

**Risks and caveats.**

- The package is large for a small project: the current npm tarball is about
  546 KB compressed / 2.4 MB unpacked and installs a substantial dependency
  tree. Keep the pilot outside the published ArggonManager package.
- The README contains legacy-looking singular `plugin` examples in places,
  while the official V2 contract uses the plural `plugins` field and
  `Plugin.define({ id, setup(ctx) })`. The package exposes a separate V2
  adapter, but its default module is a legacy-style wrapper; the actual
  auto-discovery path must be tested rather than assumed away.
- The published package currently depends on `@opencode-ai/plugin` 1.18.11 even
  though it ships a V2 adapter. That is a compatibility risk against local
  OpenCode v2.0.16 and the beta plugin API.
- The published `1.7.2` artifact predates the upstream 2026-09-24 security fix
  commit for the archive-extraction issue; do not use it with untrusted archives
  or expose it broadly. Wait for a fixed release and verify the dependency
  graph before any pilot.
- The extension and native messaging host were not installed in this review, so
  the local check below is a package/registration smoke, not a browser E2E
  acceptance run.
- Browser pages are untrusted input. Keep the allowlist restricted to the local
  board origin, use an isolated/headless profile, and do not enable unsafe code
  execution.

**Local smoke performed (2026-09-24).** The published `opencode-chromium@1.7.2`
package was downloaded into a temporary directory. Its package-level doctor
reported the four tools and a **12,450-byte** native schema against its 13,000-byte
budget; the V2 module import exposed `id` plus `setup` alongside the legacy
`server` adapter. A temporary OpenCode project using the plural `plugins` field
started its local V2 server without a configuration error, but the noninteractive
`/api/plugin` response was empty, so actual runtime registration is **not yet
verified**. The package doctor was non-zero in the package-only smoke (Bun and optional
cross-client skills were not installed); this is **not** evidence that a real
browser session passed.

**Verdict:** **Do not adopt `1.7.2`; keep as a secondary browser candidate only
after a fixed release and a real v2.0.16 registration/E2E run.**

### C — `codebase-memory-mcp` (structural code intelligence)

**What it is.** An MIT-licensed, local MCP server backed by a persistent SQLite
knowledge graph. It indexes functions, classes, imports, call chains, routes,
impact relationships, and architecture clusters, then exposes bounded search,
trace, coverage, and graph-query tools. It does not call an LLM and does not
need a hosted service or API key.

**Why it fits ArggonManager.**

- ArggonManager has a large TypeScript kernel/CLI/plugin/smoke surface and
  recurring questions about callers, blast radius, duplicated surfaces, and
  module boundaries. A graph query is a better first move than reading many
  files.
- The index is explicitly a cache outside the repository by default, which
  matches ADR 0011's rule that runtime storage is not the source of truth.
- The project already benefits from this class of tool in the current agent
  environment; the useful product decision is to document and standardize it,
  not to vendor it into the npm package.
- It complements rather than replaces the Arggon plugin: graph tools answer
  "where/how is this connected?", while `tools.arggon.*` answer "what is the
  current work item and what mutation is allowed?"

**Risks and caveats.**

- It is an MCP server, not a native OpenCode V2 plugin. Its tool catalog still
  consumes context, so use scoped/profiled tools rather than exposing every
  graph operation to every session.
- The project can optionally commit a compressed graph artifact, but that would
  be a new repository convention and should not be enabled by default without
  an ADR (large binary history, merge policy, and refresh cadence).
- The server's installer may edit agent configuration. Use an explicit,
  reviewable installation and do not let setup tooling overwrite this repo's
  generated `AGENTS.md`, skills, or OpenCode seam.

**Verdict:** **Adopt as an already-compatible developer standard; no runtime
integration.** This is the highest-leverage tool for agents maintaining the
kernel and plugin.

### D — Playwright CLI, `@axe-core/playwright`, and `@playwright/mcp`

**What they are.** ArggonManager already has Playwright as a development
dependency. The lowest-cost UI lane is therefore existing Playwright Test plus
`@axe-core/playwright` for deterministic accessibility checks, and Microsoft's
Apache-2.0 `playwright-cli` for agent-assisted browser exploration. The
separate `@playwright/mcp` server exposes accessibility-tree snapshots,
navigation, clicks, form filling, screenshots, network inspection, and related
tools. The published OpenCode snippet is legacy-shaped (`mcp` plus `enabled`)
and is not a V2-ready configuration to copy; it must be translated and checked
against the current OpenCode V2 `mcp.servers`/`disabled` schema before use. The
package's isolated mode remains a separate safety option.

**Why they fit.** The web-board backlog explicitly includes keyboard/focus,
ARIA, live state, detail drawers, and move dialogs. Playwright Test can make
those checks deterministic in the existing CI lane; axe can catch common
accessibility defects; the CLI gives an agent a lower-context interface for
interactive investigation and test generation.

**Why MCP is not first.** It is MCP rather than native V2, exposes a much larger
tool catalog, and its own documentation says CLI + skills are often more
token-efficient for coding agents. Its published OpenCode snippet is not proof
of V2 compatibility: before any pilot, verify or translate it against the
current `mcp.servers`/`disabled` schema and confirm registration in a disposable
profile. It is appropriate for persistent exploratory loops or as a fallback
when the native candidate fails the V2 registration check—not as a second
global browser surface.

**Recommended browser boundary.** Keep Playwright Test + axe in CI. Use
`playwright-cli` for agent exploration. Treat `@playwright/mcp` as an opt-in,
secondary fallback only after its published configuration has been translated
and verified against the current V2 `mcp.servers`/`disabled` schema. Use a
temporary profile, `--isolated`, `--headless`, `--no-webmcp`, omitted image
responses, workspace-only file access, and an exact version pin; do not copy the
legacy `mcp`/`enabled` snippet or edit the generated `opencode.jsonc`. The MCP
server is explicitly not a security boundary; do not attach a personal browser
profile containing credentials or unrelated sessions.

A smaller community alternative, `opencode-chrome-devtools` (MIT, direct CDP,
no extension/native host, roughly seven tools), is worth a personal smoke test
but is not the primary recommendation: its README still uses the legacy
singular `plugin` field, does not establish native V2 compatibility, and its
`browser_eval` surface is powerful enough to require a strict local-profile
policy. It is a fallback candidate, not evidence that V2 compatibility is
solved.

**Verdict:** **Adopt the existing Playwright/axe lane and CLI; keep MCP as an
opt-in fallback/comparison arm, never simultaneously by default.**

### E — `fast-check` (property-based testing)

**What it is.** An MIT-licensed JavaScript/TypeScript property-based testing
library that works with Vitest. It generates inputs, shrinks failures to small
counterexamples, and supports asynchronous properties and scheduling.

**Why it fits.** ArggonManager's highest-risk code is stateful and adversarial:
frontmatter parsing, status transitions, claim conflicts, dependency cycles,
bounded UTF-8 clipping, worktree cleanup classification, concurrent config
writes, and generated-tool contracts. Existing example-based tests are broad,
but properties can target the spaces humans tend not to enumerate.

Concrete first properties:

- valid item frontmatter survives parse → serialize → parse without losing
  required fields or changing unrelated text;
- terminal items cannot be reopened through any kernel operation;
- dependency validation terminates and reports cycles consistently;
- `clipDetailText` never splits a UTF-8 code point and never exceeds its cap;
- tool-schema and generated-doc measurements remain within their declared
  budgets;
- a worktree is classified as prunable only when every safety predicate holds.

**Risks.** Property generators can encode the wrong model and create noisy
tests. Start with a small, deterministic seed/replay contract and a bounded
number of runs in ordinary CI; do not make the entire suite stochastic by
default.

**Verdict:** **Small, high-confidence dev-only addition; best correctness
investment after the browser pilot.**

### F — Serena

**What it is.** An MCP coding toolkit using language servers for symbol
outline, reference lookup, diagnostics, and symbolic edits. Its documentation
lists OpenCode as a supported client and recommends the `ide` context to reduce
duplication with built-in file tools.

**Fit.** It could make cross-file TypeScript refactors safer and cheaper than
text search, especially around the kernel/plugin boundary.

**Why it is not the primary choice.** The ArggonManager environment already has
structural graph intelligence, Serena adds another process and a second code
index, and the current Serena application is GPL-3.0-or-later (with the
SolidLSP component under MIT). That is acceptable for an external developer
tool, but not a dependency to bundle into the MIT ArggonManager package. Its
symbolic editing surface also overlaps with OpenCode's built-in edit tools.

**Verdict:** **Optional experiment for IDE-heavy refactors; not a project
dependency.**

### G — `ast-grep` CLI and the `ast-grep/ast-grep-mcp` Python project

**What it is.** MIT-licensed structural search, lint, and rewrite tooling based
on tree-sitter. The CLI can run syntax-aware searches, reviewed codemods, and
YAML rules in CI without adding an MCP catalog. The separate
`ast-grep/ast-grep-mcp` Python project exposes AST pattern search and rule testing
for interactive rule authoring. It is a different project from the similarly
named `ast-grep-mcp` npm package listed in the version snapshot.

**Fit.** It can enforce architectural rules such as "tracker mutations go
through the kernel", "native tool definitions stay in the shared catalog", or
"no raw tracker writes appear in the board/browser adapter". Those rules are
more naturally structural than ordinary grep, and the CLI can enforce them in a
normal shell step with almost no model-context cost.

**Boundary.** Adopt the CLI, not the MCP, initially. The MCP project describes
itself as experimental, has a Python 3.13/`uv` operational footprint, and does
not replace the need for reviewed codemods. Keep ESLint/TypeScript checks for
type-aware policy; use ast-grep for structural invariants. Require rule tests
and human-reviewed diffs; do not enable unattended `--update-all` rewrites.

**Verdict:** **Adopt the CLI as a dev-only structural guard; defer the MCP.**

### H — Langfuse / OpenTelemetry

**What it is.** Langfuse is an MIT-licensed, self-hostable LLM engineering
platform for traces, evaluations, prompt management, and datasets. Its current
docs and SDKs support OpenTelemetry-based ingestion and JavaScript/TypeScript.

**Fit.** It could eventually help the `story-self-improvement` telemetry loop by
correlating agent sessions, tool calls, failures, and evaluation results.

**Why it is not now.** ArggonManager is not an LLM application and its existing
smoke scripts already emit deterministic local evidence. Langfuse would add a
server, storage, secret management, retention/privacy policy, and a bridge from
OpenCode events before there is a measured observability problem. Start with
OpenTelemetry-shaped JSON/events locally if telemetry becomes a real need; choose
a backend only after a use case and data boundary exist.

**Verdict:** **Defer.**

### I — Native planner, memory, sandbox, and other plugins

- **`opencode-planner`**: MIT and dual V1/V2 according to its README, but its
  published V2 command path still assumes an older command-list response shape.
  More importantly, ArggonManager already ships generated coordinator/worker/
  reviewer agents and its own spec/ADR/exploration commands. A second planner
  would create a second plan source and duplicate methodology.
- **`opencode2-shell-tasks`**: covered in section A. Its background-task state
  is deliberately outside the repository, so it may be a dev-only execution aid
  but must not become a second Arggon work-item store.
- **`opencode-pty`**: the richer PTY/web alternative is not a safe fallback yet.
  The published V2 entrypoint does not register its five tools; unreleased main
  fixes registration but lacks command permission enforcement, authenticated web
  access, and V2 session-delete cleanup. Keep the existing built-in shell and
  smoke scripts instead.
- **`opencode-worktrunk`**: a current V2 plugin, but it duplicates Arggon's
  `start`/`branch`/`cleanup` worktree protocol and can override `edit`/external
  directory permissions for the active worktree. It is unsafe to enable beside
  the existing Arggon worktree contract.
- **Persistent memory plugins** (`mcp-memory-service`, Engram variants, and
  similar): useful for general assistants, but ArggonManager already has durable
  Markdown items, bounded context injection, and structured `handoff`. An
  external memory database would introduce drift, privacy, and a second state
  lifecycle. `mcp-memory-service` is Apache-2.0 and self-hostable, which makes
  it technically viable, not automatically correct for this product.
- **Daytona's OpenCode plugin**: remote sandboxes and branch synchronization are
  a different execution model. The current native worktree domain and local CI
  are sufficient for this repository; adopting it would add an account/API key
  and cloud failure mode.
- **Crawl4AI/Firecrawl/Tavily-style web tools**: useful for ecosystem research,
  not for ArggonManager's core loop. Their value does not justify adding a
  network dependency to a product whose differentiator is offline, git-native
  operation.

## Comparison matrix

Scores are qualitative: **H** = strong fit, **M** = useful with constraints,
**L** = weak fit for the current repository. “Native V2” means an in-process
OpenCode V2 plugin, not merely an MCP server.

| Candidate | Surface | Open/self-hostable | License | Current gap addressed | Native V2 | Context cost | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Worktree readiness contract | Native tool + kernel/CLI parity | Yes; built into product | Project MIT | Cold-start claim loss and silent bootstrap failure | **Yes** | No new catalog | **Fix first** |
| `ast-grep` CLI | Local CLI/CI | Yes | MIT | Structural architecture rules and codemods | No | Very low | **Adopt CLI** |
| `fast-check` | Test library | Yes | MIT | Parser/state/race edge cases | No | Very low | **Adopt selectively** |
| Playwright Test + axe + CLI | Existing dev/CI lane | Yes | Apache-2.0 / MPL-2.0 | Accessibility, live board, UI investigation | No | Low/medium | **Adopt lane** |
| `codebase-memory-mcp` | MCP + local CLI | Yes; local binary/SQLite | MIT | Code navigation, impact, architecture | No | Medium; profile tools | **Adopt as dev standard** |
| `opencode2-shell-tasks` | Native V2 plugin | Yes; local state outside repo | MIT | Long-running interactive jobs | **Yes** | Low/medium | **Conditional server-only pilot** |
| `opencode-chromium` | Native/legacy browser plugin | Yes, with extension/host | MIT | Exploratory browser QA | Claimed, unverified on 2.0.16 | Low if four-tool surface is kept | **Hold for fixed release** |
| `opencode-chrome-devtools` | Community direct-CDP plugin | Yes | MIT | Lightweight browser QA | Unverified | Low/medium | Personal fallback only |
| `@playwright/mcp` | MCP | Yes | Apache-2.0 | Persistent exploratory browser QA | No | High | Opt-in secondary fallback after V2 verification |
| Serena | MCP/LSP | Yes | GPL-3.0 app / MIT component | Semantic refactoring | No | Medium | Optional |
| `ast-grep/ast-grep-mcp` (Python) | Experimental MCP | Yes, with Python/uv overhead | MIT | Interactive AST-rule authoring | No | Medium | Defer |
| Langfuse | Self-hosted service | Yes | MIT (with documented EE boundaries) | Agent telemetry/evals | No | External infra | Defer |
| `opencode-planner` | Dual V1/V2 plugin | Local | MIT | Planning | Partial | Medium | Reject: duplicates Arggon methodology |
| Persistent memory | Service/plugin | Often self-hostable | Varies | Cross-session recall | Usually no | Variable | Reject for canonical state |

## Recommendation and pilot plan

### Recommendation

1. **Fix the existing P1 worktree-readiness defect before adding optional
   tooling.** Share one preparation/readiness path between native and CLI start,
   make the claim commit outcome explicit, and add a dependency-requiring cold-
   start smoke. This is the highest-leverage improvement to the default agent
   loop and does not require a new framework.
2. **Adopt the low-context CLI/test lane next:** `ast-grep` CLI for reviewed
   structural rules/codemods, `fast-check` for stateful properties, and the
   existing Playwright suite plus `@axe-core/playwright`/`playwright-cli` for
   deterministic accessibility and UI investigation. These do not add an MCP
   catalog to every OpenCode session.
3. **Make `codebase-memory-mcp` the default code-discovery aid for agents
   working on ArggonManager.** It is already compatible with the current
   OpenCode environment, is local and MIT-licensed, and maps directly to the
   repository's architecture/impact questions. Keep its index outside the
   repository by default and use scoped tool profiles.
4. **Pilot `opencode2-shell-tasks@0.1.1` server-only** for long-running
   interactive tests/builds/smoke. It is the best native V2 *behavioral* fit,
   but its beta dependency, 197-package install, outside-repository logs, and
   permission boundary make it unsuitable as a default dependency.
5. **Hold `opencode-chromium@1.7.2`** until a fixed release clears the archive
   issue and an actual OpenCode v2.0.16 registration/browser run passes. It is a
   secondary browser candidate, not the primary native pilot.
6. **Use official `@playwright/mcp` as the browser fallback only after its
   legacy-shaped snippet is translated and registration is verified against the
   current V2 `mcp.servers`/`disabled` schema**; never enable both browser
   surfaces in the same session. This avoids duplicate tools and gives the
   project a vendor-supported escape hatch without presenting the package
   snippet as V2-ready.
7. **Do not adopt** another task tracker, agent execution framework, hosted
   planner, remote sandbox, or persistent memory layer as part of this change.

**If only one new external tool may be chosen:** choose the `ast-grep` CLI
after the P1 readiness fix. It is local, MIT-licensed, adds no MCP schema to
ordinary sessions, and can enforce ArggonManager's structural boundaries. Choose
`codebase-memory-mcp` instead when the goal is faster code discovery/impact
analysis; choose `opencode2-shell-tasks` only for an explicitly permission-gated
interactive background-job pilot; keep `opencode-chromium` on hold until its
fixed release and browser registration are proven.

### Pilot 1 — native worktree readiness (do first)

Run a bounded 20-cold-start experiment against a disposable clone/worktree set:

1. From a clean canonical checkout, invoke native `tools.arggon.start` for 20
   independent items.
2. Require the pre-commit validation gate to run, the claim commit to exist on
   the feature branch, and the result to report a typed readiness receipt.
3. Verify zero primary-checkout `node_modules` mutations, zero writes outside
   the designated checkout/worktree, and no `--no-verify` use.
4. Re-run each start to verify idempotent attach and no duplicate claim commit.
5. Add a smoke fixture with a real dependency-requiring pre-commit gate; keep
   the existing multi-worker wave smoke separate.

**Exit gate:** 20/20 ready starts, 0/20 silent claim loss, 0 manual remediation.
If the gate fails, keep the worktree for diagnosis and return a typed failure;
do not mask it with an environment manager.

### Pilot 2 — server-only `opencode2-shell-tasks` (seven days)

1. Install exactly `opencode2-shell-tasks@0.1.1` in a disposable OpenCode
   profile on a V2 beta runtime explicitly supported by the package, with the
   plugin SDK dependency isolated; do not use `@latest` or assume local
   `v2.0.16` is compatible.
2. Start with a local `background_bash` permission set to `ask`; explicitly
   deny it for the reviewer agent. Do not run unattended sessions.
3. Compare a foreground unit suite, build, Playwright smoke, and PTY TUI smoke
   with the same commands run through the plugin. Record task ID, exit status,
   bounded tail output, one synthetic completion wake-up, and process cleanup.
4. Test restart reconciliation, failure exit codes, cancellation, and a workdir
   outside the session. Confirm logs/task sidecars never enter the repository.
5. Measure model tokens and time-to-next-action against foreground shell use.

**Exit gate:** four tools register on a package-supported OpenCode V2 runtime,
zero permission bypasses, zero leaked process groups, zero duplicate wake-ups, and a
repeatable benefit for interactive long jobs. If the gate passes, internalize
only the minimal behavior in ArggonManager's existing plugin; do not ship the
third-party package by default. If it fails, remove the profile and retain the
current shell/smoke path.

### Pilot 3 — seven-day `opencode-chromium` browser review (hold until fixed)

**Day 0 — isolate (only after a fixed release is available)**

- Use a temporary OpenCode config/profile and the fixed package version; do
  not edit the repository's generated `opencode.jsonc`.
- Refresh the OpenCode playbook pin first: local runtime is v2.0.16 while the
  repository documents v2.0.12.
- Install the Chromium extension and native host in the pilot profile. Keep
  action memory and any model-backed deep retrieval disabled for the first run.

**Days 1–2 — registration and safety**

- Run the package's `doctor --json` and `verify` commands.
- Confirm the package loads through the plural `plugins` field and that exactly
  four browser tools are registered.
- Restrict origins to the local board (`http://127.0.0.1:*`) and use an
  isolated/headless browser profile. Do not call unsafe arbitrary-code tools.
- Confirm a failed browser operation cannot mutate tracker files; all mutations
  must go through `tools.arggon.*`.

**Days 3–5 — ArggonManager acceptance scenarios**

Run `arggon board --serve` against a disposable fixture and have the agent:

1. read the board accessibility tree and identify columns/cards;
2. open an item detail drawer and verify bounded prose/dependency data;
3. exercise a saved lens/filter and verify URL/state restoration;
4. verify PR/diff affordances without requiring GitHub credentials;
5. make one allowed status move through the Arggon tool path, then confirm the
   tracker diff and `arggon validate` result;
6. run the existing Playwright/axe checks for deterministic accessibility
   assertions, using the CLI for exploratory investigation;
7. capture one screenshot as review evidence, not as a source-of-truth artifact.

**Days 6–7 — compare and decide**

- Repeat the critical scenarios with `@playwright/mcp` in a separate session,
  first translating and verifying its published snippet against the current V2
  `mcp.servers`/`disabled` schema; do not copy the legacy `mcp`/`enabled` shape.
- Record time-to-find-defect, number of manual checks, tool-schema bytes,
  failures, unsafe actions, and any tracker drift.
- Keep the native candidate only after a fixed release, if it materially beats
  the fallback, and if it works with OpenCode v2.0.16. Otherwise use the
  existing Playwright CLI/axe lane or opt-in MCP and record the native candidate
  as rejected for this repository.

### Acceptance gates

- Native and CLI start share a tested worktree-preparation path.
- Twenty cold native starts produce 20/20 explicit readiness results, 20/20
  claim commits, and zero silent claim loss.
- No new runtime dependency in the root or `lib` package.
- No browser tool writes directly to `ArggonManager/`; mutations are observable
  through the shared kernel and pass `arggon validate`.
- Local-only operation: no account, hosted API, or remote database required.
- Tool surface stays bounded; record native schema bytes and compare with the
  existing context budget.
- Background jobs use an explicit `ask` permission, keep state/logs outside the
  repository, and are never enabled for unattended CI.
- Browser origin/file policy is restrictive and consequential actions require
  approval; `opencode-chromium@1.7.2` is not used before a fixed release.
- The existing Playwright smoke and PTY TUI checks remain green; any new tool is
  exploratory review evidence, not a replacement for deterministic CI.
- A failed or noisy pilot is documented and removed without weakening the
  no-runtime-dependency rule.

## Risks and unresolved questions

- The native worktree path currently has a documented, repeated claim-loss
  failure. Until the P1 fix and cold-start smoke land, no optional browser,
  memory, or orchestration tool should be treated as a substitute for reliable
  worktree preparation.
- OpenCode's V2 plugin API is beta. `opencode2-shell-tasks` has a genuine V2
  source shape but pins an old beta SDK; `opencode-chromium` has a separate V2
  adapter behind a legacy-style default and an unfixed published security
  issue. Neither compatibility nor security should be inferred from a README.
- A background-task pilot can improve interactive latency but cannot make
  model-free CI deterministic; keep CI on the existing scripts.
- The current browser package's extension/native-host setup is a meaningful
  operational cost for a repository that otherwise values zero-runtime-
  dependency, offline operation. A personal tool may be worth that cost;
  shipping it as a default may not be.
- Codebase-memory's optional committed graph artifact could improve team
  bootstrap but introduces binary-history and merge-policy questions. Keep it
  out of this decision.
- The report does not claim that any external tool improves ArggonManager's
  product functionality directly. The measurable benefit is faster, safer
  development and acceptance work around the existing product.

## Decision gate

No ADR is proposed yet. If the pilot passes, the next work item should be a
small **dev-only tooling ADR/playbook** that records:

- the exact OpenCode and package versions;
- local-only installation and origin policy;
- the background-task permission boundary and outside-repository data policy;
- the rule that browser output is evidence, never tracker state;
- the fallback and removal procedure;
- the context/schema budget measurement.

Until that gate passes, the correct status is **pilot proposed**, not “adopted.”

## Sources

### ArggonManager local evidence

- [`opencode/plugins/arggon/index.ts`](../../../opencode/plugins/arggon/index.ts) —
  native tool registration, bounded context, session correlation, and worktree
  tools.
- [`cli/src/start.ts`](../../../cli/src/start.ts) and
  [`lib/src/tracker-commit.ts`](../../../lib/src/tracker-commit.ts) — CLI
  worktree preparation and best-effort commit semantics used in the readiness
  comparison.
- [`ArggonManager/arggon-manager/opencode2-native/native-redesign/bug-native-start-worktree-no-install.md`](../../arggon-manager/opencode2-native/native-redesign/bug-native-start-worktree-no-install.md)
  — recorded native-start failure evidence and acceptance contract.
- [`cli/src/board-serve.ts`](../../../cli/src/board-serve.ts) — loopback board
  server, live reload, PR overlay, bounded detail route, and kernel-mediated
  updates.
- [`smoke/opencode-smoke.ts`](../../../smoke/opencode-smoke.ts) and
  [`smoke/tui-board-smoke.ts`](../../../smoke/tui-board-smoke.ts) — existing
  OpenCode and TUI smoke coverage.
- [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) — current CI
  browser/TUI gates.
- [`ArggonManager/docs/adr/0011-native-first-architecture.md`](../adr/0011-native-first-architecture.md)
  and [`0012-tracker-root-layout.md`](../adr/0012-tracker-root-layout.md) —
  source-of-truth and architecture constraints.
- [`ArggonManager/docs/explorations/exploration-product-discovery-002.md`](exploration-product-discovery-002.md)
  and [`exploration-ui-improvements-012.md`](exploration-ui-improvements-012.md)
  — prior ecosystem and UI gap surveys.
- [`ArggonManager/docs/playbooks/opencode.md`](../playbooks/opencode.md) —
  repository's OpenCode version/policy record.

### External sources (accessed 2026-09-24)

- OpenCode V2 plugin migration, API, and MCP server schema:
  <https://opencode.ai/v2/docs/build/plugins/migrate-v1>,
  <https://opencode.ai/v2/docs/build/plugins>, and
  <https://opencode.ai/v2/docs/mcp-servers/>.
- `opencode-chromium` README, compatibility, security, and package metadata:
  <https://github.com/Quindart-com/opencode-chromium>,
  <https://github.com/Quindart-com/opencode-chromium/blob/master/docs/compatibility.md>,
  <https://github.com/Quindart-com/opencode-chromium/blob/master/docs/security.md>,
  <https://github.com/Quindart-com/opencode-chromium/commit/f3dac2505ad0f9d14062d5129a9c4e646daefddc>,
  <https://www.npmjs.com/package/opencode-chromium>.
- `codebase-memory-mcp` README/license:
  <https://github.com/DeusData/codebase-memory-mcp> and
  <https://github.com/DeusData/codebase-memory-mcp/blob/main/LICENSE>.
- Microsoft Playwright MCP and CLI:
  <https://github.com/microsoft/playwright-mcp>,
  <https://github.com/microsoft/playwright-mcp/blob/main/README.md>, and
  <https://github.com/microsoft/playwright-cli>.
- Direct-CDP community alternative:
  <https://github.com/different-ai/opencode-browser> and
  <https://www.npmjs.com/package/opencode-chrome-devtools>.
- Accessibility lane:
  <https://playwright.dev/docs/accessibility-testing> and
  <https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright>.
- Serena:
  <https://github.com/oraios/serena> and
  <https://github.com/oraios/serena/blob/main/LICENSE>.
- ast-grep CLI and the Python MCP project:
  <https://github.com/ast-grep/ast-grep>,
  <https://github.com/ast-grep/ast-grep-mcp>, and its
  <https://github.com/ast-grep/ast-grep-mcp/blob/main/pyproject.toml>.
- The similarly named Node package is listed separately at
  <https://www.npmjs.com/package/ast-grep-mcp> and
  <https://github.com/spiritledsoftware/ast-grep-mcp>.
- fast-check:
  <https://fast-check.dev/> and <https://github.com/dubzzz/fast-check>.
- Langfuse:
  <https://github.com/langfuse/langfuse> and
  <https://langfuse.com/docs/evaluation/overview>.
- `opencode2-shell-tasks`:
  <https://github.com/madcpt/opencode2-shell-tasks>,
  <https://github.com/madcpt/opencode2-shell-tasks/blob/main/src/plugin.ts>, and
  <https://www.npmjs.com/package/opencode2-shell-tasks>.
- `opencode-pty` fallback audit:
  <https://github.com/shekohex/opencode-pty>,
  <https://github.com/shekohex/opencode-pty/blob/v0.4.0/src/v2/index.ts>, and
  <https://github.com/shekohex/opencode-pty/blob/main/src/adapters/v2/index.ts>.
- `opencode-worktrunk` overlap/permission audit:
  <https://github.com/pplante/opencode-worktrunk>.
- `opencode-planner`:
  <https://github.com/timrichardson/opencode-planner>.
- `mcp-memory-service`:
  <https://github.com/doobidoo/mcp-memory-service>.
- Optional worktree environment providers (only after native/CLI parity):
  <https://github.com/jdx/mise>, <https://github.com/jetify-com/devbox>,
  <https://github.com/NixOS/nix>, and
  <https://github.com/devcontainers/cli>.
- Official MCP TypeScript SDK (future adapter option):
  <https://github.com/modelcontextprotocol/typescript-sdk> and
  <https://ts.sdk.modelcontextprotocol.io/>.
