# Agent playbook (v0)

Humans and agents follow the **same** rules. Work lives in git under the tracker root (`ArggonManager/`; legacy `tasks/` trees are auto-detected and keep working) — see [`ArggonManager/docs/convention.md`](./convention.md). This playbook is the short loop: find → claim → work → update → PR.

## Prerequisites

- Node.js 22.12+ and a checkout of the target repo (with a tracker already initialized, or run `arggon init`).
- From the ArggonManager package root (or a linked `arggon` binary):

- `npm install`
- `npm run arggon -- <command>`

Upgrading is non-destructive for agents too: an agent's edits to a generated doc are respected on every re-run — `arggon init` refreshes untouched docs quietly, skips modified ones (listed in the command's JSON output) rather than clobbering them, and archives the originals under `backup/<date>/` first when run with `--backup`.

## 0. Issue tracking: the tracker (`ArggonManager/`), not GitHub issues

All work — features, tasks, bugs, review follow-ups — is tracked as work items under the **tracker root** via `arggon create`, **not** as GitHub issues. GitHub is for **PRs only**.

**Layout (convention v5, [ADR 0012](./adr/0012-tracker-root-layout.md)).** The tracker root is `ArggonManager/` and every product doc lives under `ArggonManager/docs/`. Legacy `tasks/` trees (docs at `<repo root>/docs/`) are auto-detected and keep working — no hard break; `arggon validate` reports the legacy location and `arggon migrate --layout` moves the tree and docs, rewrites the `x-generated` paths and bumps the file to v5 (idempotent, never auto-commits). The CLI resolves the layout for you: use repo-root-relative paths in docs, and `npm run arggon -- <command>` works in either layout.

- File findings where they are found: `npm run arggon -- create bug "<title>" --parent <story-id>` (bugs/tasks live only under a story; create the story/epic/initiative chain if the area has none yet).
- **Comments are the agent handoff channel.** When you stop work (blocked, done, or handing off), leave context on the item itself: `arggon comment <id> "why blocked / what the next agent should know"` appends a timestamped, author-attributed section to the item body. Body-only write (frontmatter, including `updated`, is never touched); allowed on `done`/`cancelled` items — a comment is history, not a reopen. For session end, prefer the structured form: `arggon handoff <id> --next "<first step for the resuming agent>" [--open-questions "..."]` appends a bounded handoff section (branch, next step, open questions — each field capped at 200 chars).
- **Tracker mutations commit themselves** (tracker hygiene): `create`, `update` (cascade ancestors included), `comment`, `adopt`, `cleanup --prune`, and `import-issues` auto-commit only the files they wrote (`chore(tasks): <verb> <id>`) — your own dirty files are never swept in, and `start`'s clean-tree precondition never blocks tool-generated state. Opt out per call with `--no-commit` or tree-wide via the tracker `.convention.yml` `x-tracker.auto-commit: false`.
- **Consolidate review findings into follow-ups.** Every actionable finding from a code review, audit, or incident (PR review comments, review summaries, post-merge observations) MUST be filed as a `task`/`bug` under the story that owns the affected area, with context (links to the PR/comment) and an acceptance checklist in the body. Do this **before the reviewed PR merges, or immediately after** — a PR comment alone is not tracking and gets lost. If no story covers the area, create one under the matching epic first.
- **Merge, don't squash, PRs that carry tracker auto-commits.** Squash-merging rewrites the branch's local `chore(tasks): ...` auto-commits into one new commit on main, so the stale branch diverges on identical content at the next pull (vencimientos merge #1 needed a manual `rebase --onto`). If squash is unavoidable: after merge, `git pull --rebase origin main` from the stale branch (enable rerere) or delete the branch and restart from fresh main. For stacked branches, prefer `--no-commit` on mutations and let the PR carry the tracker change. Prevention beats recovery: when mutating the tracker from the **primary checkout** (auto-commits land on local main), push main immediately after every mutation — before opening or merging any PR.
- Reference the item id in the PR description; move the item to `done` only when the PR fully finishes it.
- Do **not** open new GitHub issues. Pre-existing GitHub issues migrate into the tracker with `arggon import-issues` (one-shot and idempotent; `--dry-run` previews the mapping) — each item records its GitHub issue number in the additive `issue` frontmatter field, so `arggon start <id> --open-pr` appends `Closes #N` to the PR body and GitHub closes the issue on merge. With `x-github.issue-roundtrip: true` in the tracker `.convention.yml` (opt-in, default OFF), flipping such an item to `done` also closes the linked issue via gh — best effort, never blocking the flip. Hand-built items can carry the same field: `arggon create --issue <n>` / `arggon update <id> --issue <n>` (`--issue 0` clears).

## 1. Find open work

Prefer machine-readable list output:

- `npm run arggon -- list --status todo --json`
- `npm run arggon -- list --status todo --type task --json`
- `npm run arggon -- list --assignee @me --json`

Human table (no `--json`) is fine for a quick scan. Filter with `--type` / `--status` / `--assignee` as needed.

Pick a **claimable** item: `story`, `task`, or `bug` in `todo` (or return to `in_progress` only if you already own it).

## 2. Claim

**Claim** (convention v0) = claimable type + non-null `assignee` + `status: in_progress`.

- `npm run arggon -- update <id> --status in_progress --assignee <github-login>`

If another assignee already holds the claim, `update` refuses the reassignment (claim conflict) unless `--force` — do not force; see [`ArggonManager/docs/claim.md`](./claim.md). Prefer a different item or coordinate in the issue/PR. Claims carry a soft lease (`claimed_at`): `arggon list --stale --older-than 7d` reports stale claims, and reclaiming one is a **human-only** `update <id> --steal --reason "..." --assignee <you>` — agents are never allowed to steal. The CLI enforces this structurally (bug-cli-steal-not-gated): the repo must arm `x-tracker.allow-steal: true` in the tracker `.convention.yml` and the takeover must be confirmed at an interactive terminal; non-interactive (agent/script/CI) invocations are refused.

Rules:

- Do **not** set `in_progress` on a claimable item without `assignee` (`update` enforces this).
- Initiative/epic may be `in_progress` without assignee (container status only).

## 3. Create bugs/tasks from findings

When work reveals new work, create items under the correct parent story — this is the issue tracker (see §0); do not file GitHub issues:

- `npm run arggon -- create task "Add rate limiting" --parent story-login`
- `npm run arggon -- create bug "Login 500 on empty password" --parent story-login`
- `npm run arggon -- create task "..." --parent <story-id> --json`

Defaults: `status: todo`, quoted `YYYY-MM-DD` timestamps, omit `assignee` when unassigned. Leave new items `todo` unless you claim them immediately.

## 4. Branch naming

Generate the branch from the work item `id` following the configured patterns (tracker `.convention.yml`, `branch_patterns`):

- `npm run arggon -- branch <id>`

This checks out the branch and records it in the item's `branch` field. If the right branch already exists and matches, it attaches to it. Defaults follow `feat/<id>` / `fix/<id>` / `docs/<id>` (e.g. `feat/task-rate-limit`, `fix/bug-empty-password-500`).

The manual worktree step (`git worktree add ../<repo>-<id> -b <branch>`) can be folded into the claim: `arggon start <id> --worktree --assignee <login>` claims, creates (or attaches to) the worktree at `../<repo-name>-<id>`, and runs the claim commit / push / optional `--open-pr` inside it, recording the path on the item's `worktree_path` field. Before the claim commit it prepares the worktree for the project gate: when the primary checkout has a `node_modules` and the worktree does not (a fresh worktree never does), start links the primary install in (best-effort, reported as `linkedNodeModules` in `--json` and on stdout) — so a dependency-needing pre-commit gate (`npm run arggon -- validate`) runs in the fresh worktree with no manual symlink dance. When the worktree carries its own copy of a workspace package (here `@arggondev/lib`), the install is a per-worktree **link farm** — a real `node_modules` directory whose entries link the primary's packages — or a bare symlink to the primary install when the worktree shadows no workspace package; that copy is built with the package's own `build` script before the claim commit and resolved worktree-locally (printed on stdout), with the build's exit honored (a failed build never flips, so it falls back to the primary's copy even when it still emitted the entry) and builds skipped when the install cannot consume them (a bare symlink has no farm to flip, so an attach re-run does not rebuild); a local copy that could not be built stays on the primary's install and is named in `linkedWorkspaces` (`--json` + stdout). Start never commits the install (the claim commit stages only the item file) — but stage explicit paths, never `git add -A`. The install is removed before a configured `x-worktree.post-start` hook runs (so the canonical `npm ci` bootstraps a real install instead of reifying through it and emptying the primary checkout) and re-created only when the hook leaves no `node_modules`. A failure after the worktree exists **never** rolls it back: the worktree and branch are kept for inspection, and the error names the failing step, the worktree path, the remediation, and the fact that re-running `arggon start <id> --worktree` attaches to it (a failed push is the exception — attach does not retry it, and the error instructs `git push -u origin <branch>` manually). Hooks are never bypassed (`--no-verify` is never passed). When the work is done and merged, `arggon cleanup` lists (and with `--prune` removes) the stale worktrees; a kept worktree you do not want (e.g. after a claim conflict) is discarded with the exact command the failure message prints (`git worktree remove --force <path>`, plus `git branch -D <branch>` when start created the branch). `cleanup --prune` also auto-commits (it clears `worktree_path`), so push main right after it — an unpushed cleanup auto-commit has traveled as contraband on a branch cut before.

One primary claimable id per branch when possible. Open a PR early; keep it small.

## 5. Done criteria

An item is **done** when:

1. Acceptance checklist in the Markdown body is complete (or explicitly waived in Notes with rationale).
2. Frontmatter `status` is `done` via `arggon update <id> --status done`.
3. `updated` date is refreshed (`arggon update` does this automatically).
4. The PR referencing the work item id is merged (or the completing change is on the default branch).

Do **not** jump `todo` → `done` — claim first (`in_progress`), then complete.

**Automatic container completion:** updates that reach a terminal state (`done`/`cancelled`) auto-complete any ancestor container whose entire subtree is terminal (up to the initiative; see the exception in `ArggonManager/docs/convention.md`). Use `--no-cascade` when ancestors must not be touched. The cascade is predictable, but closing an **administrative** task (adoption/migration bookkeeping) should consciously pass `--no-cascade` when its product containers must stay open — and never model administrative leaves as sole children of product containers. The cascade is acceptance-aware: a container whose own body still has unchecked acceptance checkboxes is never auto-completed — tick the checklist (or use `--no-cascade`) when a container must stay open.

### Auto-done on merge

The `auto-done` workflow (`.github/workflows/auto-done.yml`) mirrors `start` on the done side: when a PR referencing `task-*`/`bug-*` ids merges into `main`, it flips claimed items to `done` through `arggon update`, runs the test suite on the flip tree, and lands the change as a squashed `github-actions[bot]` PR (the workflow posts the required `cli` check on the flip commit itself — bot pushes/PRs don't trigger CI). Limits you must still cover yourself:

- It only performs the legal `in_progress` → `done` transition. Items still `todo` or `blocked` when the PR merges are skipped with a warning annotation — claim before merging, or mark them manually.
- It never edits acceptance checklists and never touches containers (story/epic/initiative) — tick the checklist in the item body before the PR merges.
- Reference the item id in the PR title or body (the id is what the workflow greps for).

**Why flip PRs can wedge:** merging several PRs rapidly triggers concurrent auto-done runs, and sibling main commits (other flips, review comments) make the open flip PRs out-of-date, so the bot's self-merge fails — and it cannot be repaired with `update-branch`, because a rebased bot head would lack the required `cli` check (bot pushes never trigger CI). The workflow is race-tolerant since task-autodone-flip-race: before each merge attempt it rebases the flip branch onto fresh `origin/main`, re-posts the `cli` check on the new head, and retries (3 attempts). If the rebase itself conflicts — possible since task-autodone-flip-wedge-3, when a coordinator `arggon comment` on a flipped item auto-commits the same item file to main mid-flight — the workflow instead redoes the flip on a fresh `origin/main` worktree (bounded, 2 attempts: re-run the idempotent `update --status done`, push a new flip branch, re-post the check, merge, delete the wedged branch). If it still fails, the only recovery is an admin merge of the flip PR — the run log names this in a `::warning::`.

### Blocked

Set `status: blocked`, keep `assignee` on claimable types, and set non-empty `blocked_reason` per convention:

```bash
arggon update <id> --status blocked --blocked-reason "Waiting on OAuth app credentials"
```

### Unclaim

`in_progress` → `todo` clears `assignee` (v0). Prefer that over leaving a stale claim:

```bash
arggon update <id> --status todo
```

### Reopen

Agents **MUST NOT** reopen `done` / `cancelled`. This is enforced, not just documented (bug-reopen-ungated-cli): the MCP layer refuses agent callers via the shared rules module lib/src/rules.ts, and the CLI — which has no caller identity — gates the transition behind an interactive terminal: `arggon update <id> --status todo` on a `done`/`cancelled` item requires a `y/N` confirmation over a TTY stdin. Piped stdin (agents, scripts, CI) is refused even with `y` piped in; there is no `--yes` override and no config opt-in. Humans keep the ability by confirming at their terminal.

## Orchestration (multi-agent work)

Non-trivial items are **orchestrated by default**: a coordinator agent delegates them to subagents instead of working them inline. Trivial items (one-line fixes, doc tweaks) stay inline.

**OpenCode V2 is the reference implementation** ([ADR 0010](./adr/0010-opencode2-native-architecture.md)): the rules below are unchanged, but on V2 they are enforced with native primitives. `arggon init` generates the surface (`.opencode/agents/`, `.opencode/commands/`):

- **Agents**: `arggon-coordinator` (primary) plans waves, delegates, reviews and owns the tracker; `arggon-worker` (subagent) owns exactly one item; `arggon-reviewer` (subagent) reviews read-only.
- **Permissions keep the model honest**: the coordinator's `subagent` allow-list is `arggon-worker` / `arggon-reviewer` / `explore` (any other agent is denied); workers cannot launch subagents (nesting stops at one level); the reviewer cannot edit — `edit`/`write`/`patch` are removed from its catalog while reads and shell stay available for the review.
- **Flow**: each worker claims its item and creates its worktree with `arggon start <id> --worktree` (one worktree per item, recorded on `worktree_path`; `opencode.session_move` follows the session where the work lives); the coordinator launches workers **foreground** (a background child would outlive a headless `opencode run`); the native `arggon` tools carry tracker reads/writes while git stays on the shell; verdicts land **on the item** with `arggon comment`, never as GitHub comments. `/arggon-review` runs the reviewer pass; `/arggon-done` verifies the checklist, the merge and the gates before the coordinator flips the item.
- **Evidence harness**: `npm run smoke:opencode:wave` runs headless `opencode run` sessions on a fixture with a **local bare remote** — permission probes (reviewer edit denied, worker subagent denied, coordinator allow-list), then a scripted four-phase wave (plan → two foreground workers in disjoint worktrees → reviewer verdicts → merge verification and done flips) and the run's context accounting. Separate from `npm test` and from `npm run smoke:opencode`; both are **model-driven and timing sensitive — run each one alone**, never beside a test suite or another headless harness (a stalled provider call can leave a scenario half-done past the per-command timeout); exits 0 with `skipped: opencode not installed` when the binary is absent.

**Coordinator duties:**

- **Wave planning by file-disjointness:** group claimable items into waves whose members touch disjoint files/modules. Items that would collide go in different waves.
- **Per-item worktrees:** one subagent per item, each working in its own worktree (`../<repo>-<item-id>`); no two subagents share a working tree.
- **Code review (lead architect):** the coordinator reviews **every** subagent PR before merge — against the review bar in `ArggonManager/docs/engineering.md` (architecture-first, conventions first, quality/scalability/security bar, tests travel with behavior, docs travel with code, scope stays on the item, **blocking smoke test** — probe evidence in the verdict for CLI changes, real-browser drive via Playwright CLI for UI) plus the coordination specifics: surgical staging, no cross-item files, no unrelated reformatting, acceptance ticks honest. Change requests and verdicts go back to the subagent via `arggon comment <item-id>` on the item (auto-committed to the tracker) — never as GitHub PR comments — and are addressed before merge; only a review that passes merges. Green CI is necessary, not sufficient.
- **Merge verification:** after each subagent's PR, the coordinator verifies the merge; when waves overlap, the coordinator resolves cross-item conflicts.
- **Tracker ownership:** the coordinator owns tracker state — claim conflicts, blocked items, follow-up filing, and final wave verification (0 open items, `arggon validate` ok, `arggon doctor` clean).

**Subagent rules:**

- Claim **your** item (`in_progress` + assignee) and stay inside **your** worktree.
- Never flip your item `done` — completion is the coordinator's call after merge verification — and never reopen `done`/`cancelled` or steal a claim.
- Expect the coordinator's code review on your PR and address change requests before it merges. Come with smoke evidence for behavior changes: changed commands probed on a fixture (expected vs observed), UI changes browser-driven per [ADR 0008](./adr/0008-review-smoke-gate.md) — the smoke gate blocks merge.
- Report findings back to the coordinator instead of filing tracker items — the coordinator consolidates and files.

The claim, branch, PR, and validate rules above apply to subagents **unchanged**: same commands, same gates, same "never" list.

## JSON for agents

Pass `--json` on supported commands for a stable object on stdout (see [`ArggonManager/docs/json-output.md`](./json-output.md)). On failure, expect non-zero exit and a JSON error object when `--json` was set.

## MCP server

`arggon mcp` starts a stdio MCP (JSON-RPC 2.0, newline-delimited) server that exposes the shared kernel and the bounded read surface as nine tools: `arggon_list`, `arggon_create`, `arggon_update`, `arggon_comment`, `arggon_handoff`, `arggon_show`, `arggon_next`, `arggon_report`, and `arggon_validate` (task-mcp-parity-full: the pure-read `next`/`report`/`validate` commands complete the ADR 0006 next-first surface for MCP-only agents). Tool results are the documented `--json` envelope objects (see [`ArggonManager/docs/json-output.md`](./json-output.md)) serialized as text content; kernel failures surface as tool errors with the CLI's message text. `arggon init` generates a `.mcp.json` that registers the server project-scoped for MCP clients; if your repo already has a `.mcp.json`, the arggon entry is never overwritten — add `{"command": "arggon", "args": ["mcp"]}` under `mcpServers` manually. **OpenCode V2 does not need it**: since W3 the generated `opencode.jsonc` carries no `mcp.servers` stanza and the vendored plugin serves the native `arggon` tools in-process (`.opencode/agents/`, `.opencode/commands/arggon-*.md`, `.opencode/plugins/arggon/`); MCP is a conditional adapter for other clients, and `doctor` reports a present stanza as optional. See [exploration-opencode-v2-native-009](explorations/exploration-opencode-v2-native-009.md) and `ArggonManager/docs/playbooks/opencode.md`.

The MCP layer always calls the kernel with the agent playbook rules applied: an MCP caller cannot reopen `done`/`cancelled` items and cannot steal a claim (there is no `force` parameter). These rules live in one module (`lib/src/rules.ts`) shared by the CLI and the MCP server, so both entry points enforce identical semantics.

**Session attribution (task-opencode-v2-mcp-meta).** OpenCode V2 sends the invoking session ID in `CallToolRequest.params._meta.sessionID` for calls made on behalf of a session — direct tools and Code Mode, over stdio and Streamable HTTP — and documents it as an opaque correlation value ([MCP servers](https://opencode.ai/v2/docs/mcp-servers/), accessed 2026-09-17). `arggon mcp` reads it absent-safely and uses it as the **default** `session` for `arggon_handoff` and the **default** `author` for `arggon_comment`/`arggon_handoff`; explicit **non-empty** tool arguments always win, and a caller that omits the metadata keeps the previous behavior (`@me` author resolution, no session). The value is normalized once at the boundary (`sessionIDFromMeta`) before any consumer sees it (task-opencode-v2-mcp-meta-hardening, finding F1): surrounding whitespace is trimmed, the token is cut at the first whitespace, control, format or lone-surrogate character so it is always single-line, and it is capped at 64 characters with `…` — the same bound the handoff `session` field enforces. A value that normalizes to nothing (whitespace-only, control-only, empty) counts as absent; the meta-derived `author` therefore cannot inject an extra heading line or unbounded prose, and explicit arguments keep their existing kernel semantics (comment trims its author; handoff caps its `session` at 64). The ID is correlation metadata only: never authentication or authorization, never logged, and it triggers no state transitions — `lib/src/rules.ts` stays the only path for updates and the CLI is unchanged.

The MCP tool input schemas are **parity-tested against the CLI** (`cli/src/mcp-parity.test.ts` derives the commander option surface for `list`/`create`/`update`/`comment` and asserts it matches the tool schemas both ways, minus a documented exception list). Keep MCP schema changes **additive only**; a breaking change to a tool input schema must bump the `schemaVersion` of the JSON output contract.

Wire it up with any MCP client config:

```json
{
  "command": "arggon",
  "args": ["mcp"]
}
```

## Documentation maintenance (docs, ADRs, specs, plans)

Agents and humans keep the docs alive **in the same PR as the change** — never as a TODO, a review comment, or a follow-up that blocks release.

### What to update, by change type

| Change                                                                        | Update (same PR)                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New or changed CLI command / flag                                             | `README.md` (user-facing section) **and** `ArggonManager/docs/json-output.md` (payload section + the `command` enum in the envelope table)                                               |
| JSON contract field or shape                                                  | `ArggonManager/docs/json-output.md` (`WorkItem` table or the command section). Additive fields note their additivity; breaking changes bump `schemaVersion`                              |
| Task-tree / frontmatter / validate behavior                                   | `ArggonManager/docs/convention.md` — non-negotiable, see the review bar in `docs/engineering.md`                                                                                         |
| Cross-cutting decision (stack, identity, schema model, new top-level package) | ADR under `ArggonManager/docs/adr/` — see the ADR process in `ArggonManager/docs/engineering.md` (4-digit id, `Proposed` in the PR, `Accepted` on merge, supersede instead of rewriting) |
| Non-trivial feature worth design review                                       | Spec in `ArggonManager/docs/specs/` + implementation plan in `ArggonManager/docs/plans/` (see below)                                                                                     |
| Agent playbook rules themselves                                               | This file (`ArggonManager/docs/agents.md`)                                                                                                                                               |

### Specs and plans (for non-trivial features)

- **Spec** (`ArggonManager/docs/specs/spec-<slug>-NNN.md`): the reviewable contract — purpose, synopsis, flags, JSON shapes, invariants ("never overwrites", "pure read"), and acceptance criteria. Write it **before** implementing; frontmatter carries `spec_id`, `title`, `status` (`proposed` → `implemented`), `created`.
- **Plan** (`ArggonManager/docs/plans/plan-<slug>-NNN.md`): the implementation breakdown derived from the spec — ordered tasks, each with verifiable acceptance criteria and a link back to the spec. Frontmatter: `plan_id`, `spec`, `status`.
- When the feature lands, flip both statuses in the same PR as the implementation (never leave a shipped feature `proposed`).
- Tooling: `arggon spec validate [--file <path>]` checks spec/plan structure read-only (CI-safe, non-zero on errors) and `arggon spec new <slug> [--title <t>] [--plan]` scaffolds the next numbered spec/plan from `templates/spec.md` / `templates/plan.md` — never overwrites. See [`ArggonManager/docs/specs/spec-spec-pipeline-002.md`](specs/spec-spec-pipeline-002.md).
- Before implementing, run `arggon spec analyze` (report-only): it flags ambiguity (vague quantifiers, TODO/TBD markers, missing error paths, untestable acceptance) and spec ↔ tasks/plans inconsistency (implemented specs nothing cites, plans pointing at missing specs) — findings never fail the run, resolve them by editing the spec. For multi-wave refactors, gate each wave with `spec analyze --baseline <file>` (non-zero exit = NEW findings vs the committed snapshot). See [`ArggonManager/docs/specs/spec-spec-analyze-004.md`](specs/spec-spec-analyze-004.md).
- Migrating a legacy corpus? `arggon spec import openspec <path>` converts an OpenSpec corpus (`specs/<capability>/spec.md`) mechanically: Purpose mapping, Acceptance criteria verbatim with per-requirement verification checklists, a provenance line, and a per-file zero-loss assertion — all-or-nothing per run, never overwrites, `--dry-run` inventories first. The format adapter (`cli/src/spec-import.ts`) is the extension point for other corpus formats. See [`ArggonManager/docs/specs/spec-spec-import-openspec-005.md`](specs/spec-spec-import-openspec-005.md).
- After a migration (or periodically), run `arggon spec audit` (report-only): it classifies every `ArggonManager/docs/specs/*.md` pair as DUPLICATE / MERGE / KEEP-SEPARATE from shingle-Jaccard similarity plus shared verbatim requirement/scenario titles, with thresholds you can tune — see [`ArggonManager/docs/specs/spec-spec-audit-006.md`](specs/spec-spec-audit-006.md).

### Technology playbooks (stack decisions and doc freshness)

Stack/technology decisions follow the pipeline: **explore → ADR → playbook → status/--file-task**.

1. `arggon stack explore <topic>` records the spike (`ArggonManager/docs/explorations/exploration-<slug>-NNN.md`): candidates, criteria, findings with dated sources, recommendation.
2. The decision lands as an ADR under `ArggonManager/docs/adr/` (link it in the exploration's Decision section).
3. `arggon playbook new <tech> --version <v>` generates `ArggonManager/docs/playbooks/<tech>.md` — the chosen version plus Setup / Conventions / Testing / Security / Upgrade policy. The research is the caller's job (with dated sources); the CLI records it.
4. `arggon playbook status` flags playbooks older than the threshold (default 90 days, `x-playbooks.max-age-days` in the tracker `.convention.yml`); `--file-task <story-id>` files one re-research task per stale playbook into the tracker. After re-researching, `arggon playbook refresh <tech> --version <v>` updates the frontmatter.

Agents follow `ArggonManager/docs/playbooks/` by default (the init-generated `AGENTS.md` points there) and refresh playbooks when `playbook status` flags them stale.

### Verification before opening the PR

- `grep` the new command/flag/field across `README.md`, `ArggonManager/docs/json-output.md`, `ArggonManager/docs/convention.md`, `ArggonManager/docs/agents.md` — every hit must match the implemented behavior.
- `arggon validate` passes.
- If the change made any doc statement false, that doc edit belongs in this PR.

## Adoption sweep (existing repos)

`arggon adopt` turns "start using ArggonManager here" into a tracked, agent-executable migration. It requires an initialized tree (`arggon init` first — the command pre-flights through the same logic as `arggon doctor`), inventories the repo's governing docs (present/absent, arggon-managed via `x-generated` provenance vs adopter-owned, plus cheap stack-manifest hints), and files one task — `task-adopt-arggon`, "Adopt ArggonManager in this repo" — whose body is the checklist below. `--dry-run` prints the inventory and planned actions and writes nothing; the same JSON is how the executing agent re-derives the inventory mid-flight. The task is created under `--story <story-id>` when given, else under `story-arggon-adoption` (auto-created under the first epic; when the tree has no epic at all — e.g. a fresh `init --full` — adopt auto-creates the initiative/epic chain `arggon-adoption` → `epic-arggon-adoption` itself, so pass `--story` when adopting an existing repo with its own structure). Idempotent: an already-open `task-adopt-arggon` is reported, not duplicated.

Any agent executing the adoption task follows this procedure (the task body carries the same steps as an acceptance checklist):

1. **Read the arggon-generated docs first**: `AGENTS.md`, `ArggonManager/docs/convention.md`, `ArggonManager/docs/engineering.md`, `ArggonManager/docs/playbooks/` (if present) — they govern the rest of the migration.
2. **Sweep the existing repo docs** (list them from the inventory): extract the project description, conventions, workflows, and stack info. **Extract, don't wholesale-copy** — rewrite into the target doc's structure and drop duplicated or outdated material.
3. **Complete the arggon-generated docs** with the extracted content — fill the TODO placeholders: project description in `AGENTS.md`; `CONTRIBUTING.md` specifics (environment setup, build/test commands); `ARCHITECTURE.md` problem statement. The `SECURITY.md` contact is human input — leave it flagged for a human, never invent it.
4. **Archive replaced originals** to `backup/<YYYY-MM-DD>/` preserving their relative paths (today's date). Only docs you **replaced** get archived; **never archive README.md — merge into it instead**.
5. **Detect the stack from the manifests** (package.json / requirements.txt / go.mod / Cargo.toml / pom.xml — filenames only); for each technology create a playbook (`arggon playbook new <tech>`), research current versions and best practices with dated sources, then record them with `arggon playbook refresh <tech> --version <v>`.
6. **Baseline the sanctioned edits**: run `arggon adopt --ack` so the generated docs you completed in step 3 become the new `x-generated` baseline (their checksums are refreshed and they stop reporting as modified). Hand edits made AFTER this ack still report modified — the protection stays intact.
7. **Verify**: `arggon validate` + `arggon spec validate` (if specs exist) + `arggon playbook status`.
8. **Report**: comment on the adoption task (`arggon comment task-adopt-arggon`) listing the extracted content, archived files, and created playbooks; flip the task done when the human reviews.

If the adopting repo carries a pre-existing spec corpus (OpenSpec — `openspec/config.yaml` + `specs/*/spec.md` — or another format such as ADR/RFC markdown), follow the phased migration checklist the adoption task generates: detection fingerprints, then Fase 0 mapping (format -> spec template, e.g. OpenSpec `## Requirements` -> Acceptance criteria verbatim), Fase 1 one spec per capability with a zero-loss assertion, Fase 2 duplication audit, Fase 3 consolidation, Fase 4 contract refactor in file-disjoint waves — with the gates per phase (`spec validate` 0/0, `spec analyze` without NEW findings vs baseline; consolidar antes de reescribir).

## Reference integrations

Copy-paste wiring so agents follow ArggonManager rules **by default** — same CLI, same rules, no private dialect (Phase 3, [#20](https://github.com/Arggon/ArggonManager/issues/20)).

Or print it on demand: `arggon instructions` extracts these snippets from this file at runtime (`--json` emits them as structured fields), so doc and command cannot drift.

The generated AGENTS.md also mandates the bundled **arggon-cli skill** (`.agents/skills/arggon-cli/SKILL.md`, copied by `arggon init` from this repo's `skills/arggon-cli/SKILL.md` — single source, no duplicate): agents load it before any arggon invocation for the JSON contract, claim rules and pitfalls. It is an umbrella — `SKILL.md` plus `references/{json-contract,methodology,orchestration,pitfalls}.md`, bundled beside it; V2 advertises the supporting paths and the model reads the relevant reference on demand instead of carrying all detail per step. A parity test (`cli/src/skill-copy.test.ts`) keeps every bundled file byte-equal to its source, modulo the generated marker.

### Pre-commit gate

`.git/hooks/pre-commit` (make executable) — rejects commits with invalid frontmatter or tree:

```sh
#!/bin/sh
npm run arggon -- validate
```

### CI gate

Add a job to your workflow (mirrors the workflow `arggon init` writes to
`.github/workflows/arggon.yml`; full recipe and install variants in
[`ArggonManager/docs/ci.md`](./ci.md)). The bin is the packaged `arggon`
headless CLI — no model, no MCP, no OpenCode session:

```yaml
tasks-validate:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    # Pre-release (packages still private): pack BOTH tarballs from a pinned
    # checkout. After release this line is `npm install -g arggon-manager`.
    - name: Install arggon
      run: |
        git clone --depth 1 --branch opencode2 https://github.com/Arggon/ArggonManager /tmp/arggon-src
        cd /tmp/arggon-src && npm ci
        mkdir -p /tmp/arggon-packs
        npm pack --workspace @arggondev/lib --pack-destination /tmp/arggon-packs
        npm pack --pack-destination /tmp/arggon-packs
        npm install -g /tmp/arggon-packs/arggondev-lib-*.tgz /tmp/arggon-packs/arggon-manager-*.tgz
    - run: arggon init --no-commit
    - run: arggon validate --json
```

### Agent instructions snippet

Adopters get this wiring for free: `arggon init` generates a spec-compliant `AGENTS.md` (plus a one-line `CLAUDE.md` shim with `@AGENTS.md` and a `.github/copilot-instructions.md` pointer) from master templates — it never overwrites an existing file. Repos that do not use `init` can still paste the snippet below into their `AGENTS.md` (or equivalent) so coding agents loop through the CLI:

```markdown
## Task workflow (ArggonManager)

Work items live under the tracker root (ArggonManager/) — see ArggonManager/docs/convention.md and ArggonManager/docs/agents.md.

1. Find work: `npm run arggon -- list --status todo --json`
2. Claim before starting: `npm run arggon -- update <id> --status in_progress --assignee <your-login>`
3. Branch `feat/<id>` / `fix/<id>`; one claimed item per branch.
4. Never steal a claim; if taken, pick another item or coordinate.
5. Create follow-up work with `arggon create task|bug "<title>" --parent <story-id>`.
6. Done = acceptance checklist complete + `arggon update <id> --status done` + PR linked.
7. Never reopen done/cancelled items.
```

### OpenCode V2

`arggon init` generates the OpenCode **V2** seam (tier-1; never overwrites an existing file): a root `opencode.jsonc` — **only when the repo has no OpenCode config of its own** (`opencode.json(c)` or `.opencode/opencode.json(c)`) — carrying formatter + compaction retention and **no MCP stanza** (ADR 0011 §5/§6: MCP left the default path in W3), plus `.opencode/agents/arggon-{coordinator,worker,reviewer}.md` and the eleven native `.opencode/commands/arggon-{next,start,done,handoff,review,status,spec,adr,explore,playbook,adopt}.md` (prompt templates that drive the native tools and write the methodology artifacts directly — no CLI-driving prose, no shell blocks). The generated `.mcp.json` still serves other clients (e.g. Claude Code), and the skills bundled under `.agents/skills/` are auto-discovered (no config needed):

```jsonc
{
  // formatter + compaction retention; the native `arggon` tools come from the
  // vendored plugin, so no MCP stanza is needed.
  "formatter": true,
  "compaction": { "keep": { "tokens": 15000 } },
}
```

V2 recognizes `AGENTS.md` only — **no `CLAUDE.md` fallback** (that shim serves other tools) — and accepts but does not load the `instructions` config array. Never map V1 fields into V2 config (`mcp.<name>`, `enabled`, `autoupdate`); the field-level source of truth is `https://opencode.ai/config.json`. `arggon init` also vendors the OpenCode V2 plugin (`.opencode/plugins/arggon/index.ts`, same never-overwrite + provenance semantics as the skills): since W3 it is the **single-file, dependency-free bundle** built from `opencode/plugins/arggon/index.ts` with `@arggondev/lib` inlined (`npm run build:plugin`; drift-gated by `cli/src/plugin-copy.test.ts` — assert-before-write — and `npm run check:plugin` in CI), so it loads in a dependency-less adopter tree with zero config. Since W5 (`task-native-tui`) it also vendors the **TUI entry** `.opencode/plugins/arggon/tui.tsx` beside the bundle: OpenCode discovers it from the same plugin directory, the runtime resolves `solid-js`, and the board/status surface (`session.panel` + `sidebar.content`, opened with `/arggon-board`) reads the tracker through the inlined kernel — still no `node_modules`. It registers the **native `arggon` tool namespace** (W2/W3, `task-native-tools`; W4 adds the worktree domain): fifteen Code Mode tools with `ctx.tool.transform` (`options.namespace: "arggon"`, `codemode: true`; the core nine also `options.pinned`) that call the kernel in-process and return the documented `--json` envelopes, with kernel failures surfacing as typed tool errors and the session continuing. The W4 worktree tools (`start`, `branch`, `cleanup`) own the item worktree through `ctx.worktree` while the kernel keeps the claim/branch/`worktree_path` records: `start` creates `../<repo>-<id>` (name `<repo>-<id>`), records the branch + path inside the worktree copy so the claim commit lands on the feature branch, and `cleanup` classifies with the shared kernel rule, removes merged worktrees through the domain and clears the records; push and the `gh` PR step stay explicit agent steps, and the CLI (`arggon start --worktree` / `arggon cleanup --prune`) is the fallback when the domain is unavailable. The generated seam and the shipped agents also carry the W4 permission defaults (minimal shell gates; reviewer read-only shell gates; native + MCP tool-level least privilege) that complement — never replace — the kernel invariants. Ambient behavior: it correlates the session to the active work item — `ARGON_ITEM` env → observed `arggon` calls (shell invocations **and** Code Mode `tools.arggon.<name>(…)` calls, W3) → `feat/<id>`/`fix/<id>` branch — injects a **bounded** item block through the context hook, rebuilt per call so it survives compaction, renames the session on claim, and logs a non-blocking hygiene warning when `arggon validate` fails after a commit. MCP auto-registration was **removed** in W3 (ADR 0011 §5/§6): the plugin never touches `ctx.mcp`; an adopter who wants the stdio server configures `mcp.servers.arggon` explicitly. Headless evidence: `npm run smoke:opencode` — fresh-init seam + dependency-less bundle + one bounded session per native command + the context/hygiene scenarios on opencode v2.0.12. Config precedence, skills discovery, bundling, testing and the upgrade policy live in the [OpenCode playbook](./playbooks/opencode.md) (pinned 2.0.12).

## Self-improvement loop

Findings flow back into the tool through two documented, repeatable protocols (`ArggonManager/docs/labs/`):

- **Adversarial audit** ([`ArggonManager/docs/labs/adversarial-audit.md`](./labs/adversarial-audit.md)): attack the behavioral invariants (claim exclusivity, never-reopen/steal, never-overwrite, cascade honesty, lost pushes) and sweep the normative doc statements ("never/always/only/requires") against built behavior, in a throwaway temp tree. Run after a notable feature wave or before a release (~1h). Findings file via the tracker; never patch the tool from an audit.
- **Telemetry mining** ([`ArggonManager/docs/labs/telemetry-mining.md`](./labs/telemetry-mining.md)): mine ZCode session logs, the experiment repos' tracker commit histories, and `.evidence/` dirs for friction signatures (retries, fallbacks, manual tracker git work, chore-commit clusters). Run after each real-usage session or experiment — not on a timer.

Both file through the normal loop (`arggon create task|bug --parent <story-id>`) with literal repro + evidence.

## Related

- Convention: [`ArggonManager/docs/convention.md`](./convention.md)
- Engineering: [`ArggonManager/docs/engineering.md`](./engineering.md)
- Claim concurrency: [`ArggonManager/docs/claim.md`](./claim.md)
- JSON contract: [`ArggonManager/docs/json-output.md`](./json-output.md)
- Contributing: [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
