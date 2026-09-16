# Agent playbook (v0)

Humans and agents follow the **same** rules. Work lives in git under `tasks/` — see [`docs/convention.md`](./convention.md). This playbook is the short loop: find → claim → work → update → PR.

## Prerequisites

- Node.js 22.12+ and a checkout of the target repo (with `tasks/` already initialized, or run `arggon init`).
- From the ArggonManager package root (or a linked `arggon` binary):

- `npm install`
- `npm run arggon -- <command>`

Upgrading is non-destructive for agents too: an agent's edits to a generated doc are respected on every re-run — `arggon init` refreshes untouched docs quietly, skips modified ones (listed in the command's JSON output) rather than clobbering them, and archives the originals under `backup/<date>/` first when run with `--backup`.

## 0. Issue tracking: `tasks/`, not GitHub issues

All work — features, tasks, bugs, review follow-ups — is tracked as work items under **`tasks/`** via `arggon create`, **not** as GitHub issues. GitHub is for **PRs only**.

- File findings where they are found: `npm run arggon -- create bug "<title>" --parent <story-id>` (bugs/tasks live only under a story; create the story/epic/initiative chain if the area has none yet).
- **Comments are the agent handoff channel.** When you stop work (blocked, done, or handing off), leave context on the item itself: `arggon comment <id> "why blocked / what the next agent should know"` appends a timestamped, author-attributed section to the item body. Body-only write (frontmatter, including `updated`, is never touched); allowed on `done`/`cancelled` items — a comment is history, not a reopen. For session end, prefer the structured form: `arggon handoff <id> --next "<first step for the resuming agent>" [--open-questions "..."]` appends a bounded handoff section (branch, next step, open questions — each field capped at 200 chars).
- **Tracker mutations commit themselves** (tracker hygiene): `create`, `update` (cascade ancestors included), `comment`, `adopt`, `cleanup --prune`, and `import-issues` auto-commit only the files they wrote (`chore(tasks): <verb> <id>`) — your own dirty files are never swept in, and `start`'s clean-tree precondition never blocks tool-generated state. Opt out per call with `--no-commit` or tree-wide via `tasks/.convention.yml` `x-tracker.auto-commit: false`.
- **Consolidate review findings into follow-ups.** Every actionable finding from a code review, audit, or incident (PR review comments, review summaries, post-merge observations) MUST be filed as a `task`/`bug` under the story that owns the affected area, with context (links to the PR/comment) and an acceptance checklist in the body. Do this **before the reviewed PR merges, or immediately after** — a PR comment alone is not tracking and gets lost. If no story covers the area, create one under the matching epic first.
- **Merge, don't squash, PRs that carry tracker auto-commits.** Squash-merging rewrites the branch's local `chore(tasks): ...` auto-commits into one new commit on main, so the stale branch diverges on identical content at the next pull (vencimientos merge #1 needed a manual `rebase --onto`). If squash is unavoidable: after merge, `git pull --rebase origin main` from the stale branch (enable rerere) or delete the branch and restart from fresh main. For stacked branches, prefer `--no-commit` on mutations and let the PR carry the tracker change. Prevention beats recovery: when mutating the tracker from the **primary checkout** (auto-commits land on local main), push main immediately after every mutation — before opening or merging any PR.
- Reference the item id in the PR description; move the item to `done` only when the PR fully finishes it.
- Do **not** open new GitHub issues. Pre-existing GitHub issues migrate into `tasks/` with `arggon import-issues` (one-shot and idempotent; `--dry-run` previews the mapping) — each item records its GitHub issue number in the additive `issue` frontmatter field, so `arggon start <id> --open-pr` appends `Closes #N` to the PR body and GitHub closes the issue on merge. With `x-github.issue-roundtrip: true` in `tasks/.convention.yml` (opt-in, default OFF), flipping such an item to `done` also closes the linked issue via gh — best effort, never blocking the flip. Hand-built items can carry the same field: `arggon create --issue <n>` / `arggon update <id> --issue <n>` (`--issue 0` clears).

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

If another assignee already holds the claim, `update` refuses the reassignment (claim conflict) unless `--force` — do not force; see [`docs/claim.md`](./claim.md). Prefer a different item or coordinate in the issue/PR. Claims carry a soft lease (`claimed_at`): `arggon list --stale --older-than 7d` reports stale claims, and reclaiming one is a **human-only** `update <id> --steal --reason "..." --assignee <you>` — agents are never allowed to steal. The CLI enforces this structurally (bug-cli-steal-not-gated): the repo must arm `x-tracker.allow-steal: true` in `tasks/.convention.yml` and the takeover must be confirmed at an interactive terminal; non-interactive (agent/script/CI) invocations are refused.

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

Generate the branch from the work item `id` following the configured patterns (`tasks/.convention.yml`, `branch_patterns`):

- `npm run arggon -- branch <id>`

This checks out the branch and records it in the item's `branch` field. If the right branch already exists and matches, it attaches to it. Defaults follow `feat/<id>` / `fix/<id>` / `docs/<id>` (e.g. `feat/task-rate-limit`, `fix/bug-empty-password-500`).

The manual worktree step (`git worktree add ../<repo>-<id> -b <branch>`) can be folded into the claim: `arggon start <id> --worktree --assignee <login>` claims, creates (or attaches to) the worktree at `../<repo-name>-<id>`, and runs the claim commit / push / optional `--open-pr` inside it, recording the path on the item's `worktree_path` field. When the work is done and merged, `arggon cleanup` lists (and with `--prune` removes) the stale worktrees. `cleanup --prune` also auto-commits (it clears `worktree_path`), so push main right after it — an unpushed cleanup auto-commit has traveled as contraband on a branch cut before.

One primary claimable id per branch when possible. Open a PR early; keep it small.

## 5. Done criteria

An item is **done** when:

1. Acceptance checklist in the Markdown body is complete (or explicitly waived in Notes with rationale).
2. Frontmatter `status` is `done` via `arggon update <id> --status done`.
3. `updated` date is refreshed (`arggon update` does this automatically).
4. The PR referencing the work item id is merged (or the completing change is on the default branch).

Do **not** jump `todo` → `done` — claim first (`in_progress`), then complete.

**Automatic container completion:** updates that reach a terminal state (`done`/`cancelled`) auto-complete any ancestor container whose entire subtree is terminal (up to the initiative; see the exception in `docs/convention.md`). Use `--no-cascade` when ancestors must not be touched. The cascade is predictable, but closing an **administrative** task (adoption/migration bookkeeping) should consciously pass `--no-cascade` when its product containers must stay open — and never model administrative leaves as sole children of product containers. The cascade is acceptance-aware: a container whose own body still has unchecked acceptance checkboxes is never auto-completed — tick the checklist (or use `--no-cascade`) when a container must stay open.

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

Agents **MUST NOT** reopen `done` / `cancelled`. This is enforced, not just documented (bug-reopen-ungated-cli): the MCP layer refuses agent callers via the shared rules module cli/src/rules.ts, and the CLI — which has no caller identity — gates the transition behind an interactive terminal: `arggon update <id> --status todo` on a `done`/`cancelled` item requires a `y/N` confirmation over a TTY stdin. Piped stdin (agents, scripts, CI) is refused even with `y` piped in; there is no `--yes` override and no config opt-in. Humans keep the ability by confirming at their terminal.

## Orchestration (multi-agent work)

Non-trivial items are **orchestrated by default**: a coordinator agent delegates them to subagents instead of working them inline. Trivial items (one-line fixes, doc tweaks) stay inline.

**Coordinator duties:**

- **Wave planning by file-disjointness:** group claimable items into waves whose members touch disjoint files/modules. Items that would collide go in different waves.
- **Per-item worktrees:** one subagent per item, each working in its own worktree (`../<repo>-<item-id>`); no two subagents share a working tree.
- **Code review (lead architect):** the coordinator reviews **every** subagent PR before merge — against the review bar in docs/engineering.md (architecture-first, conventions first, tests travel with behavior, docs travel with code, scope stays on the item) plus the coordination specifics: surgical staging, no cross-item files, no unrelated reformatting, acceptance ticks honest. Change requests and verdicts go back to the subagent via `arggon comment <item-id>` on the item (auto-committed to the tracker) — never as GitHub PR comments — and are addressed before merge; only a review that passes merges. Green CI is necessary, not sufficient.
- **Merge verification:** after each subagent's PR, the coordinator verifies the merge; when waves overlap, the coordinator resolves cross-item conflicts.
- **Tracker ownership:** the coordinator owns tracker state — claim conflicts, blocked items, follow-up filing, and final wave verification (0 open items, `arggon validate` ok, `arggon doctor` clean).

**Subagent rules:**

- Claim **your** item (`in_progress` + assignee) and stay inside **your** worktree.
- Never flip your item `done` — completion is the coordinator's call after merge verification — and never reopen `done`/`cancelled` or steal a claim.
- Expect the coordinator's code review on your PR and address change requests before it merges.
- Report findings back to the coordinator instead of filing tracker items — the coordinator consolidates and files.

The claim, branch, PR, and validate rules above apply to subagents **unchanged**: same commands, same gates, same "never" list.

## JSON for agents

Pass `--json` on supported commands for a stable object on stdout (see [`docs/json-output.md`](./json-output.md)). On failure, expect non-zero exit and a JSON error object when `--json` was set.

## MCP server

`arggon mcp` starts a stdio MCP (JSON-RPC 2.0, newline-delimited) server that exposes the shared kernel and the bounded read surface as nine tools: `arggon_list`, `arggon_create`, `arggon_update`, `arggon_comment`, `arggon_handoff`, `arggon_show`, `arggon_next`, `arggon_report`, and `arggon_validate` (task-mcp-parity-full: the pure-read `next`/`report`/`validate` commands complete the ADR 0006 next-first surface for MCP-only agents). Tool results are the documented `--json` envelope objects (see [`docs/json-output.md`](./json-output.md)) serialized as text content; kernel failures surface as tool errors with the CLI's message text. `arggon init` generates a `.mcp.json` that registers the server project-scoped; if your repo already has a `.mcp.json`, the arggon entry is never overwritten — add `{"command": "arggon", "args": ["mcp"]}` under `mcpServers` manually.

The MCP layer always calls the kernel with the agent playbook rules applied: an MCP caller cannot reopen `done`/`cancelled` items and cannot steal a claim (there is no `force` parameter). These rules live in one module (`cli/src/rules.ts`) shared by the CLI and the MCP server, so both entry points enforce identical semantics.

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

| Change | Update (same PR) |
| --- | --- |
| New or changed CLI command / flag | `README.md` (user-facing section) **and** `docs/json-output.md` (payload section + the `command` enum in the envelope table) |
| JSON contract field or shape | `docs/json-output.md` (`WorkItem` table or the command section). Additive fields note their additivity; breaking changes bump `schemaVersion` |
| Task-tree / frontmatter / validate behavior | `docs/convention.md` — non-negotiable, see the review bar in `docs/engineering.md` |
| Cross-cutting decision (stack, identity, schema model, new top-level package) | ADR under `docs/adr/` — see the ADR process in `docs/engineering.md` (4-digit id, `Proposed` in the PR, `Accepted` on merge, supersede instead of rewriting) |
| Non-trivial feature worth design review | Spec in `docs/specs/` + implementation plan in `docs/plans/` (see below) |
| Agent playbook rules themselves | This file (`docs/agents.md`) |

### Specs and plans (for non-trivial features)

- **Spec** (`docs/specs/spec-<slug>-NNN.md`): the reviewable contract — purpose, synopsis, flags, JSON shapes, invariants ("never overwrites", "pure read"), and acceptance criteria. Write it **before** implementing; frontmatter carries `spec_id`, `title`, `status` (`proposed` → `implemented`), `created`.
- **Plan** (`docs/plans/plan-<slug>-NNN.md`): the implementation breakdown derived from the spec — ordered tasks, each with verifiable acceptance criteria and a link back to the spec. Frontmatter: `plan_id`, `spec`, `status`.
- When the feature lands, flip both statuses in the same PR as the implementation (never leave a shipped feature `proposed`).
- Tooling: `arggon spec validate [--file <path>]` checks spec/plan structure read-only (CI-safe, non-zero on errors) and `arggon spec new <slug> [--title <t>] [--plan]` scaffolds the next numbered spec/plan from `templates/spec.md` / `templates/plan.md` — never overwrites. See [docs/specs/spec-spec-pipeline-002.md](specs/spec-spec-pipeline-002.md).
- Before implementing, run `arggon spec analyze` (report-only): it flags ambiguity (vague quantifiers, TODO/TBD markers, missing error paths, untestable acceptance) and spec ↔ tasks/plans inconsistency (implemented specs nothing cites, plans pointing at missing specs) — findings never fail the run, resolve them by editing the spec. See [docs/specs/spec-spec-analyze-004.md](specs/spec-spec-analyze-004.md).

### Technology playbooks (stack decisions and doc freshness)

Stack/technology decisions follow the pipeline: **explore → ADR → playbook → status/--file-task**.

1. `arggon stack explore <topic>` records the spike (`docs/explorations/exploration-<slug>-NNN.md`): candidates, criteria, findings with dated sources, recommendation.
2. The decision lands as an ADR under `docs/adr/` (link it in the exploration's Decision section).
3. `arggon playbook new <tech> --version <v>` generates `docs/playbooks/<tech>.md` — the chosen version plus Setup / Conventions / Testing / Security / Upgrade policy. The research is the caller's job (with dated sources); the CLI records it.
4. `arggon playbook status` flags playbooks older than the threshold (default 90 days, `x-playbooks.max-age-days` in `tasks/.convention.yml`); `--file-task <story-id>` files one re-research task per stale playbook into the tracker. After re-researching, `arggon playbook refresh <tech> --version <v>` updates the frontmatter.

Agents follow `docs/playbooks/` by default (the init-generated `AGENTS.md` points there) and refresh playbooks when `playbook status` flags them stale.

### Verification before opening the PR

- `grep` the new command/flag/field across `README.md`, `docs/json-output.md`, `docs/convention.md`, `docs/agents.md` — every hit must match the implemented behavior.
- `arggon validate` passes.
- If the change made any doc statement false, that doc edit belongs in this PR.

## Adoption sweep (existing repos)

`arggon adopt` turns "start using ArggonManager here" into a tracked, agent-executable migration. It requires an initialized tree (`arggon init` first — the command pre-flights through the same logic as `arggon doctor`), inventories the repo's governing docs (present/absent, arggon-managed via `x-generated` provenance vs adopter-owned, plus cheap stack-manifest hints), and files one task — `task-adopt-arggon`, "Adopt ArggonManager in this repo" — whose body is the checklist below. `--dry-run` prints the inventory and planned actions and writes nothing; the same JSON is how the executing agent re-derives the inventory mid-flight. The task is created under `--story <story-id>` when given, else under `story-arggon-adoption` (auto-created under the first epic; when the tree has no epic at all — e.g. a fresh `init --full` — adopt auto-creates the initiative/epic chain `arggon-adoption` → `epic-arggon-adoption` itself, so pass `--story` when adopting an existing repo with its own structure). Idempotent: an already-open `task-adopt-arggon` is reported, not duplicated.

Any agent executing the adoption task follows this procedure (the task body carries the same steps as an acceptance checklist):

1. **Read the arggon-generated docs first**: `AGENTS.md`, `docs/convention.md`, `docs/engineering.md`, `docs/playbooks/` (if present) — they govern the rest of the migration.
2. **Sweep the existing repo docs** (list them from the inventory): extract the project description, conventions, workflows, and stack info. **Extract, don't wholesale-copy** — rewrite into the target doc's structure and drop duplicated or outdated material.
3. **Complete the arggon-generated docs** with the extracted content — fill the TODO placeholders: project description in `AGENTS.md`; `CONTRIBUTING.md` specifics (environment setup, build/test commands); `ARCHITECTURE.md` problem statement. The `SECURITY.md` contact is human input — leave it flagged for a human, never invent it.
4. **Archive replaced originals** to `backup/<YYYY-MM-DD>/` preserving their relative paths (today's date). Only docs you **replaced** get archived; **never archive README.md — merge into it instead**.
5. **Detect the stack from the manifests** (package.json / requirements.txt / go.mod / Cargo.toml / pom.xml — filenames only); for each technology create a playbook (`arggon playbook new <tech>`), research current versions and best practices with dated sources, then record them with `arggon playbook refresh <tech> --version <v>`.
6. **Baseline the sanctioned edits**: run `arggon adopt --ack` so the generated docs you completed in step 3 become the new `x-generated` baseline (their checksums are refreshed and they stop reporting as modified). Hand edits made AFTER this ack still report modified — the protection stays intact.
7. **Verify**: `arggon validate` + `arggon spec validate` (if specs exist) + `arggon playbook status`.
8. **Report**: comment on the adoption task (`arggon comment task-adopt-arggon`) listing the extracted content, archived files, and created playbooks; flip the task done when the human reviews.

## Reference integrations

Copy-paste wiring so agents follow ArggonManager rules **by default** — same CLI, same rules, no private dialect (Phase 3, [#20](https://github.com/Arggon/ArggonManager/issues/20)).

Or print it on demand: `arggon instructions` extracts these snippets from this file at runtime (`--json` emits them as structured fields), so doc and command cannot drift.

The generated AGENTS.md also mandates the bundled **arggon-cli skill** (`.agents/skills/arggon-cli/SKILL.md`, copied by `arggon init` from this repo's `skills/arggon-cli/SKILL.md` — single source, no duplicate): agents load it before any arggon invocation for the JSON contract, claim rules and pitfalls. A parity test (`cli/src/skill-copy.test.ts`) keeps that copy byte-equal to the source, modulo the generated marker.

### Pre-commit gate

`.git/hooks/pre-commit` (make executable) — rejects commits with invalid frontmatter or tree:

```sh
#!/bin/sh
npm run arggon -- validate
```

### CI gate

Add a job to your workflow (mirrors this repo's `.github/workflows/ci.yml`):

```yaml
tasks-validate:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: npm
    - run: npm ci
    - run: npm run arggon -- validate
```

### Agent instructions snippet

Adopters get this wiring for free: `arggon init` generates a spec-compliant `AGENTS.md` (plus a one-line `CLAUDE.md` shim with `@AGENTS.md` and a `.github/copilot-instructions.md` pointer) from master templates — it never overwrites an existing file. Repos that do not use `init` can still paste the snippet below into their `AGENTS.md` (or equivalent) so coding agents loop through the CLI:

```markdown
## Task workflow (ArggonManager)

Work items live under tasks/ — see docs/convention.md and docs/agents.md.

1. Find work: `npm run arggon -- list --status todo --json`
2. Claim before starting: `npm run arggon -- update <id> --status in_progress --assignee <your-login>`
3. Branch `feat/<id>` / `fix/<id>`; one claimed item per branch.
4. Never steal a claim; if taken, pick another item or coordinate.
5. Create follow-up work with `arggon create task|bug "<title>" --parent <story-id>`.
6. Done = acceptance checklist complete + `arggon update <id> --status done` + PR linked.
7. Never reopen done/cancelled items.
```

## Self-improvement loop

Findings flow back into the tool through two documented, repeatable protocols (`docs/labs/`):

- **Adversarial audit** ([docs/labs/adversarial-audit.md](./labs/adversarial-audit.md)): attack the behavioral invariants (claim exclusivity, never-reopen/steal, never-overwrite, cascade honesty, lost pushes) and sweep the normative doc statements ("never/always/only/requires") against built behavior, in a throwaway temp tree. Run after a notable feature wave or before a release (~1h). Findings file via the tracker; never patch the tool from an audit.
- **Telemetry mining** ([docs/labs/telemetry-mining.md](./labs/telemetry-mining.md)): mine ZCode session logs, the experiment repos' tracker commit histories, and `.evidence/` dirs for friction signatures (retries, fallbacks, manual tracker git work, chore-commit clusters). Run after each real-usage session or experiment — not on a timer.

Both file through the normal loop (`arggon create task|bug --parent <story-id>`) with literal repro + evidence.

## Related

- Convention: [`docs/convention.md`](./convention.md)
- Engineering: [`docs/engineering.md`](./engineering.md)
- Claim concurrency: [`docs/claim.md`](./claim.md)
- JSON contract: [`docs/json-output.md`](./json-output.md)
- Contributing: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
