<!-- arggon:generated template="skills/arggon-cli/SKILL.md" -->
---
name: arggon-cli
description: Work like a senior engineer with ArggonManager — install/update the tool, adopt or init projects, run the work loop, and follow the full engineering methodology (explorations, specs, ADRs, playbooks, runbooks) with JSON-output tooling.
version: 0.3.1
author: Arggon (Arggon), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [CLI, Tasks, Agents, JSON]
    related_skills: []
---

# Arggon CLI Skill

Drive the `arggon` task CLI **and** follow the engineering methodology it encodes.
Work lives as Markdown under `tasks/` (the repo is the source of truth); GitHub is
for PRs only. This skill covers the whole agent lifecycle: installing/updating
ArggonManager, starting or adopting a project, running the find → claim → work → PR
loop, and — critically — **deciding what the work needs before writing code**:
explorations, specs, ADRs, playbooks, runbooks. Sections 5 (methodology) and 6
(quality bar) are not optional reading; they are how senior work differs from
task-shoveling. The full playbook lives in `docs/agents.md` and
`docs/engineering.md`; this file is the operational reference.

## When to Use

- Any task involving work items in a repo with `tasks/.convention.yml`: list, claim, create, update, validate, visualize.
- Starting a NEW project ("set up task management here") → `arggon init`.
- Adopting an EXISTING repo ("start using ArggonManager here") → `arggon adopt` (agent-executable migration; see §Adoption).
- Checking project health / installation state → `arggon doctor`.
- Don't use for: editing convention rules (`docs/convention.md` is the source of truth for the schema).

## 0. Install / update ArggonManager

```bash
# fresh install
git clone https://github.com/Arggon/ArggonManager ../ArggonManager
cd ../ArggonManager && npm install && npm run build   # dist/cli.js is the bin
# update an existing checkout
git -C ../ArggonManager pull --ff-only && npm -C ../ArggonManager run build
```

- The `arggon` bin is `dist/cli.js` (gitignored): **run `npm run build` after every
  pull** before using it — a stale dist fails with `unknown option` on new flags.
- `npm run arggon -- <command>` runs from TypeScript source (no build needed, slower).
- Invoke from anywhere inside the target repo — the CLI walks up to find `tasks/`.

## 1. Start or adopt a project

```bash
arggon init --full        # NEW repo: tasks/ tree + governing docs (AGENTS.md + CLAUDE.md
                          # shim + .github/ files + CONTRIBUTING/SECURITY/.editorconfig;
                          # --full adds ARCHITECTURE.md, docs/convention.md + engineering.md,
                          # CHANGELOG, SUPPORT, runbooks) + bundles this skill at
                          # .agents/skills/arggon-cli/SKILL.md
arggon adopt              # EXISTING repo: creates a tracked migration task with an agent
                          # checklist (sweep docs → extract content → complete generated docs
                          # → archive replaced originals to backup/<date>/ → playbooks from
                          # detected stack → verify → report). --dry-run inventories only.
arggon doctor             # installation state: initialized? conventionVersion? docs
                          # managed/untouched/modified/stale? tracker counts? (report-only)
```

- Init/adopt never overwrite existing files (not even with `--force`): governing
  docs are adopter-owned the moment they exist. Re-running init regenerates
  **untouched** generated docs silently (checksum in `x-generated` state), skips and
  reports **modified** ones, and archives with `--backup` to `backup/<date>/`.

## 2. Run the work loop

```bash
arggon list --status todo --json                       # find work (empty items[] = no work, not an error)
arggon next --json                                    # suggested claimable item + reason (+ blockedBy)
arggon start <id> --assignee <login> --worktree       # claim + branch + worktree + commit + push
                                                      # (--open-pr adds a draft PR; re-runs attach)
arggon update <id> --status done                      # complete (see pitfalls: cascade, claim rules)
arggon comment <id> "handoff note"                    # timestamped agent-handoff sections (body-only)
arggon create task|bug "Title" --parent <story-id>    # file follow-ups (leaves get task-/bug- prefix)
arggon validate --json                                # gate before every commit
```

- Full `--json` envelope: `{ok, schemaVersion: 1, conventionVersion, command, ...payload}`;
  failures `{ok: false, error: {message, code}}` + non-zero exit. Error codes:
  `INIT_FAILED, CREATE_FAILED, LIST_FAILED, UPDATE_FAILED, VALIDATE_FAILED, BRANCH_FAILED,
  START_FAILED, BOARD_FAILED, SYNC_FAILED, NEXT_FAILED, REPORT_FAILED, TREND_FAILED,
  DOCTOR_FAILED, ADOPT_FAILED, SPEC_FAILED, INSTRUCTIONS_FAILED, EXPLORE_FAILED,
  PLAYBOOK_FAILED, COMMENT_FAILED, IMPORT_FAILED, CLEANUP_FAILED`.
- Human output (no `--json`) is for eyes only — never parse it; re-run with `--json`.

## 3. Views, reporting, tooling

```bash
arggon board                       # self-contained HTML (columns, deps edges, drag-drop pre-checks)
arggon board --serve               # local live-reload server, 127.0.0.1 only (edits via update path)
arggon board --tui                 # interactive terminal kanban (not combinable with --json/--serve)
arggon board --github              # overlay live PR state (needs gh auth)
arggon report --trend --json       # weekly completions + cycle time mined from git history
arggon sync --check                # reconcile open GitHub PRs into tasks/ (non-zero when pending)
arggon instructions                # agent wiring snippets extracted from docs/agents.md
arggon cleanup --prune             # reap worktrees of done/cancelled items with merged branches
arggon mcp                         # stdio MCP server: arggon_list/_create/_update/_comment tools
```

## 4. Planning documents (specs, playbooks, explorations)

```bash
arggon spec validate               # validate docs/specs/*.md + docs/plans/*.md structure
arggon spec new <slug> --title     # scaffold spec (+ --plan for the implementation plan)
arggon stack explore <topic>       # scaffold a comparison/spike record in docs/explorations/
arggon playbook new <tech> --version v   # version-pinned per-tech best-practices doc
arggon playbook status             # flag stale playbooks (>90d default, x-playbooks.max-age-days);
                                   # --file-task <story-id> files a re-research task in the tracker
arggon playbook refresh <tech> --version v  # re-record after re-research
```

Pipeline: explore → ADR → playbook → status. The generated AGENTS.md points agents
at `docs/playbooks/`; stale playbooks file their own re-research tasks.

## 5. Engineering methodology — what does this work need?

Before implementing, classify the work. The size and risk decide the paperwork;
the paperwork is created in the same PR as the change, never as a follow-up TODO.

| Work is... | Required process |
| --- | --- |
| **Trivial** (typo, one-line fix, copy tweak) | Just the task. No spec, no ADR. |
| **A non-trivial feature** (new behavior, new endpoint/scene/module) | **Spec first** (`arggon spec new <slug>` → docs/specs/): purpose, synopsis, invariants ("never overwrites", "pure read"), acceptance criteria. Then a **plan** (`--plan`) breaking it into ordered tasks with verifiable criteria. Then implement. Flip spec/plan status to `implemented` in the same PR as the landing feature. |
| **A cross-cutting or hard-to-reverse decision** (stack choice, schema/convention change, new top-level package, identity model) | **Exploration spike** (`arggon stack explore <topic>`): candidates, criteria, findings with dated sources. Then an **ADR** in `docs/adr/` (NNNN-title, Proposed → Accepted on merge; supersede, never rewrite). Only then implement. |
| **Introducing or upgrading a technology** (new dependency, framework, major version) | **Playbook** (`arggon playbook new <tech> --version <v>`): researched current version + best practices with dated sources; the project's AGENTS.md points agents at it. `arggon playbook status` flags stale ones (>90d) — refresh via re-research + `playbook refresh`, and file the re-research task in the tracker (`--file-task`). |
| **Operational/infra behavior someone will have to run or debug** (deploy, alerting, data migration, recovery) | **Runbook** in `docs/runbooks/`: trigger → diagnosis → mitigation → escalation → rollback. Write steps individually automatable. |
| **A finding from review/audit/incident** | A tracked follow-up (`arggon create task|bug ... --parent <story-id>`) with context and acceptance — never only a PR comment. |

When in doubt between two levels, take the heavier one — but keep the artifacts
lean. A 40-line spec beats a 4-page one nobody reads.

**Scope and ordering:**
- Check `arggon next --ready` before picking work; declare `--depends-on` when your
  task orders after another (the graph is the plan — keep it true).
- One claimable item per branch/PR; keep PRs small; reference the item id.
- If the work reveals more work, file it (`arggon create task|bug`) — don't grow the
  PR's scope, and don't leave it only in code comments.

## 6. Quality bar (every PR, no exceptions)

- **Conventions first:** read the project's `docs/convention.md`,
  `docs/engineering.md`, and the relevant `docs/playbooks/<tech>.md` before
  writing code. If project docs disagree with what you're about to do, fix the
  docs in the same PR or file a blocking follow-up — never fork silently.
- **Tests are part of the change** when behavior changes; run the full suite plus
  lint/typecheck gates the project defines, and keep every acceptance checkbox
  in the item body honest.
- **Docs travel with code:** any change that makes a doc statement false updates
  that doc in the same PR (see the change-type → doc mapping in `docs/agents.md`
  §Documentation maintenance).
- **Handoffs are written:** blocked, out-of-scope discoveries, and decisions go in
  `arggon comment` on the item — the next agent (or human) should never need to
  re-derive your context.
- **Leave it cleaner:** expired claims get released (`--status todo`), merged
  worktrees get `arggon cleanup --prune`, stale playbooks get flagged, and the
  tree validates before every commit.

## Procedure

1. **Locate work:** `list --status todo --json`. Empty `items[]` = success.
2. **Start:** `start <id> --assignee <login> [--worktree] [--open-pr]` — claims
   (in_progress + assignee), checks out the branch, commits the claim, pushes. With
   `--worktree` everything runs inside `../<repo-name>-<id>` (recorded as
   `worktree_path`; re-runs attach). Claim taken (`START_FAILED`) → pick another item —
   never `--force`. Manual fallback: `update <id> --status in_progress --assignee <login>`
   + `branch <id>`.
3. **Record findings:** `create task|bug "<title>" --parent <story-id>` — leaves get the
   `task-`/`bug-` prefix automatically (even with `--id`).
4. **Finish:** tick the acceptance checklist in the item body, then
   `update <id> --status done`. Never jump `todo → done`, never reopen `done`/`cancelled`.
   Completing an item may auto-complete ancestor containers (cascade) — expected.
5. **Verify:** `validate --json` must be `ok:true` before committing.

## Pitfalls

- `update --labels a,b` REPLACES the label list (kebab-case, unique). Same for
  `--depends-on a,b` (empty clears; `--add-depends-on <id>` appends; unknown ids fail).
  **Dependencies are advisory**: they gate `next`/`--ready` suggestions, never updates.
- `in_progress` on a claimable type without `assignee` is rejected; initiatives/epics may
  be `in_progress` unassigned. Claims carry a soft lease (`claimed_at`, ISO date-time):
  reporting only. `list --stale --older-than 7d` reports stale claims (pre-feature claims
  count as stale). `update --steal --reason "<why>" --assignee <you>` is HUMAN-only
  (agents are refused, like `--force`) and appends a dated note to the body. It is
  also double-gated: the repo must arm `x-tracker.allow-steal: true` in
  `tasks/.convention.yml`, and it must run at an interactive terminal with a y/N
  confirmation — a non-TTY (agent/script/CI) invocation is always refused. Agents
  can never steal; coordinate instead.
- `update --status blocked` requires `--blocked-reason`; `blocked_reason` is forbidden otherwise.
- **Cascade**: a terminal status (done/cancelled) auto-completes ancestor containers whose
  whole subtree is terminal — up to the initiative. Opt out with `--no-cascade`; flipped
  ids come back as `autoCompleted`. Comments (`arggon comment`) never touch frontmatter.
- `WorkItem.path` is posix relative to the repo root. Run inside the repo tree — outside,
  every command fails fast (`LIST_FAILED` etc.).
- `list` filters compose with AND; unknown `--status`/`--type` values fail. Predicates:
  `status:`, `type:`, `assignee:`, `label:`, `parent:`, `depends-on:`, `blocked-by:`, `!` negates.
- `board` without `--out` writes `board.html` at the repo root (where `tasks/` lives).
  `--tui` requires an interactive terminal. `--serve` binds 127.0.0.1 only and is
  incompatible with `--github`/`--tui`/`--json`.
- `init`/docs are never overwritten — even with `--force`. Re-runs regenerate untouched
  generated docs silently, skip modified ones, `--backup` archives them.
- `adopt` requires an initialized tree; it creates the migration task — executing it is an
  agent job per the checklist body.
- Conventions evolve: check `conventionVersion` in any envelope (v3 current; v0-v2 rules
  in `docs/convention.md`).
- Stale `dist` after a pull → `unknown option` errors: rebuild (`npm run build`).
- **Stage explicit paths — never `git add -A` / `git add .`.** The rule exists
  because ignore files have a scope gap, not as dogma: directory patterns like
  `node_modules/` in `.gitignore` match directories only, so in worktrees where
  `node_modules` is a SYMLINK to a shared install (the ArggonManager convention)
  it is untracked-but-not-ignored and `-A` commits it. This actually happened in
  an init worktree here and needed an amend before push. In repos where no such
  symlinks/infrastructure exist and everything really is gitignored, `-A` is
  lower-risk — but explicit paths remain the universal habit: they also protect
  against unrelated dirty files being swept into your commit. Match the tool
  itself: tracker mutations (`create`/`comment`/`adopt`/`cleanup --prune`)
  auto-commit with surgical staging (`git add -- <path>` only), and your own
  commits should do the same.

## Verification

- `validate --json` → `{"ok": true, ...}` on a healthy tree; on a broken tree
  `ok:false` + `error.code: "VALIDATE_FAILED"` + non-zero exit — fix the tree, don't work around it.
- `doctor --json` → installation + docs + tracker health, exit 0 always (report-only).
- `board --json` → `{ok, command: "board", path, itemCount}` and the file exists.
