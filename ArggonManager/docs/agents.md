# Agent playbook — start here

> **Methodology carrier (per [ADR 0020](./adr/0020-methodology-first-productization.md)).** This document is a carrier of the ArggonManager methodology — declared together with `ArggonManager/docs/agents.md`, `ArggonManager/docs/engineering.md`, `ArggonManager/docs/convention.md`, and the bundled `arggon-cli` skill.
>
> - **Scope:** any project — not only software.
> - **Invariants:** work-loop parity: any human and any agent may claim, work, review, comment and merge under the same kernel rules and the same JSON contracts; state lives in git; discipline is enforceable; docs travel with code; never-steal / never-reopen, with authority asymmetric and named — the irreversible overrides stay product-owner powers, structurally human-only.
> - **Version:** tracks the ArggonManager package version.
> - **Upgrade channel:** methodology changes reach adopters through the adopter upgrade channel ([ADR 0016](./adr/0016-adopter-upgrade-channel.md)).

## Reading map

| Layer                    | Read when                                                                     | Entry                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core**                 | A normal item: find → start → implement → verify → PR → review → merge → done | This page, [convention](./convention.md), [engineering](./engineering.md), [CLI umbrella](../../skills/arggon-cli/SKILL.md)                                                                                 |
| **Core / review**        | Reviewing a change                                                            | [Review bar and verdict](./engineering.md#review-bar-blocks-merge), then the item's acceptance contract                                                                                                     |
| **Reference**            | A specific command, schema extension or client requires detail                | [JSON contract](./json-output.md), [schema reference](./references/convention.md), [engineering reference](./references/engineering.md), [runtime and integration reference](./references/agent-runtime.md) |
| **Reference**            | Delegation/runtime binding, documentation or adoption                         | [Orchestration runtime](./references/orchestration.md), [documentation and adoption](./references/documentation.md)                                                                                         |
| **Reference / recovery** | A claim, start, merge or cleanup failed                                       | [Agent recovery](./runbooks/agent-recovery.md), [start diagnostics](./references/agent-runtime.md#native-start-dependency-contract), [merge recovery](./engineering.md#merging-a-pr-refused-as-out-of-date) |
| **History**              | The reason for a decision, not a second set of instructions                   | [ADR register](./adr/README.md), [explorations](./explorations/), [specs](./specs/), [plans](./plans/)                                                                                                      |

The **core is exactly the four files in the first row**, at most **120 KiB (122,880 bytes)** combined; this start-here page is at most **20 KiB (20,480 bytes)**. `npm run context:report` reports their UTF-8 source bytes and the test suite rejects a regression. References are loaded only at their point of use, not as another required bundle.

Canonical homes: **claim and terminal-state policy** in [convention](./convention.md#claim-rule); **operational done** in [§5](#5-done-criteria); **review and promotion policy** in [engineering](./engineering.md#review-bar-blocks-merge). Other pages link to those rules rather than maintaining another version.

## Prerequisites

- Node.js 22.12+ and a checkout of the target repo, with a tracker initialized (`arggon init` for a new tracker).
- From the package root (or use a linked `arggon` binary):

- `npm install`
- `npm run arggon -- <command>`

`npm run arggon -- …` runs source; after pulling, rebuild an installed `dist/cli.js` with `npm run build`. Pass `--json` for supported machine-readable commands; a failure is a non-zero exit plus an error envelope. Prefer bounded `next` and `show` to a whole-tree scan.

For adapter selection, safe regeneration, orphan handling and client installation, read [installation and upgrades](./references/agent-runtime.md#installation-and-upgrades) only when setting up or upgrading.

## 0. Issue tracking: the tracker (`ArggonManager/`), not GitHub issues

All work — features, tasks, bugs and review follow-ups — lives under the tracker root, **not GitHub issues**. GitHub is for PRs only. This repository's own work lives under `ArggonManager/arggon-manager/`; the CLI also detects legacy `tasks/` layouts.

```bash
npm run arggon -- create task "<title>" --parent <story-id>
npm run arggon -- create bug "<title>" --parent <story-id>
```

Create a matching story/epic/initiative chain if the area has none. Author real Context and a checkable live `## Acceptance` section in the new item; don't leave scaffolding. New items stay `todo` until claimed. When work reveals additional work, file it instead of expanding this PR.

**Every actionable review, audit or incident finding becomes a follow-up task/bug** under the owning story, with source context and acceptance criteria, before the reviewed PR merges or immediately after. A PR comment alone is not tracking. A maker reports findings to the delivery lead, who consolidates and files them.

Tracker writes (`create`, `update`, `comment`, `adopt`, cleanup and import) auto-commit only their own files. Use `--no-commit` for a deliberately staged batch; never sweep unrelated changes into a commit. PRs carrying tracker auto-commits use merge commits, not squash. Push primary-checkout tracker auto-commits immediately so they cannot hitchhike onto an unrelated branch.

Friction **in ArggonManager itself** uses `arggon friction "<observation>" --command "<argv shape>"`, not a workaround or a tracker item. The record is local and redacted; the [friction reference](../../skills/arggon-cli/references/friction.md) explains reporting and opt-out.

## 1. Find open work

```bash
npm run arggon -- next --json
npm run arggon -- show <id> --meta --json
npm run arggon -- sync --json  # GitHub-backed repositories
```

Read the selected item's full acceptance contract (`show <id> --body --json`) before starting. Use `list` only when a pool scan is actually needed. Empty `next` output is success, not an error.

Apply the [claim rule and branch-claim authority](./convention.md#claim-rule): a primary checkout may still show `todo` while an unmerged branch owns the item. Inspect `sync`'s `branchClaims` and `branchClaimErrors` before treating that item as free. `sync` requires a GitHub remote; in an isolated local-only fixture inspect its branches and worktrees directly. A failed reconciliation never proves an item free: coordinate if ownership is uncertain.

## 2. Claim

The [claim contract](./convention.md#claim-rule), [claim lease](./convention.md#claim-lease-claimed_at) and [terminal-state policy](./convention.md#reopen--status-policy) are canonical. For ordinary work use **start with a worktree**, not a bare status update; §4 gives the command. A refusal names a condition to remedy, not permission to bypass it.

## 3. Create bugs/tasks from findings

Use [§0](#0-issue-tracking-the-tracker-arggonmanager-not-github-issues). Keep new work separate from the current acceptance contract.

## 4. Branch naming

```bash
npm run arggon -- start <id> --worktree --assignee <your-agent-role-id> --json
```

This claims, creates or attaches to the item's branch/worktree, commits and pushes the claim. Use the returned and recorded **`worktree_path`**, not a guessed sibling path. Do all edits, builds and commits there. One item → one worktree → one writer; never hand-roll `git worktree add` for a claim. `branch <id>` is bookkeeping for an existing workflow, not a replacement for this entry point.

Move the session into that worktree (OpenCode: `session_move`), then `show <id> --meta --json` must confirm the claimed state, assignee and branch. Check `trackerRoot`/`trackerRootMismatch` on native operations; a shell's cwd alone does not establish the session binding. [Binding diagnostics](./references/orchestration.md) apply when these disagree.

Start prepares dependencies before the claim commit. If it refuses or reports an unusable install, fix the named cause and re-run start to attach to the **kept** worktree. Never run `npm ci` through a link to the primary install. Read [worktree mechanics](./references/agent-runtime.md#worktree-mechanics) for the exact readiness receipt, strict gates, hook and ownership diagnostics.

### Implement and verify

Keep the change on the item, stage explicit paths, and keep its acceptance ticks honest. Follow the [review bar](./engineering.md#review-bar-blocks-merge) and the project's declared verification commands. Run `arggon validate` before committing. Check every doc statement made false by the change and update it **in the same PR**; [documentation maintenance](./references/documentation.md#documentation-maintenance-docs-adrs-specs-plans) gives the change-type map.

A non-trivial feature needs a spec and implementation plan before implementation; greenfield work first follows the [exploration protocol](../../skills/arggon-cli/references/exploration.md). Read [specs and plans](./references/documentation.md#specs-and-plans-for-non-trivial-features) for artifact and analysis gates, and the project's technology playbooks for stack-specific conventions.

### PR, review verdict and merge

Open a small PR referencing the item id, with problem, approach and actual verification evidence. The delivery lead reviews every maker change against the canonical [review bar and verdict convention](./engineering.md#review-bar-blocks-merge), records the verdict **on the item**, and addresses change requests before merge. Green CI is necessary, not sufficient. The verifier supplies expected-versus-observed execution evidence; it does not approve.

The lead verifies the PR actually reads **MERGED**, not merely that auto-merge is armed. A dirty/behind branch requires [merge recovery](./engineering.md#merging-a-pr-refused-as-out-of-date), preserving both maker and reviewer records. Never leave a reviewed PR unmerged without a named blocker on its item; a deployment that requires a person to merge has that named delivery boundary.

## 5. Done criteria

Operational **done** means all of the following:

1. The live `## Acceptance` section has at least one real criterion and all criteria are ticked, or a human has explicitly waived the gate with a recorded rationale. The [acceptance grammar and kernel gate](./convention.md#acceptance-rows-the-one-grammar) decide what counts; historical comments and fenced repro boxes aren't criteria.
2. The completing PR is **merged**, or the completing change is on the default branch.
3. The delivery lead runs `arggon update <id> --status done`; `updated` is refreshed automatically. Claim first: do not jump `todo` → `done`.

Never claim completion before the merge. The kernel also refuses a leaf's done flip while an open PR targets its branch. Product acceptance is separate: use the canonical [promotion policy](./engineering.md#product-acceptance-product-owner), not a substitute for honest acceptance ticks. Human-only overrides are in the [authority map](./engineering.md#roles-and-authority); an agent never self-waives.

Terminal updates can cascade to ancestors only when their subtree is terminal and their own acceptance permits completion. Use `--no-cascade` for administrative close-out that must not complete product containers. [Container rules](./convention.md#parent-status) carry the schema detail. Don't model administrative leaves as a product container's sole child.

After merge, `arggon cleanup` lists finished worktrees; inspect before `cleanup --prune`. [Recovery](./runbooks/agent-recovery.md) covers failed auto-done, unclaim/release and removal blockers.

### Blocked

```bash
arggon update <id> --status blocked --blocked-reason "<specific missing prerequisite>"
arggon handoff <id> --next "<first step for the resuming agent>" --open-questions "<unresolved question>"
```

Keep the assignee as context on a blocked item. Leave bounded context on the item whenever stopping, completing or handing off; `comment`/`handoff` append history without reopening terminal items.

### Auto-done on merge

For this repository's workflow and its limits, read [auto-done](./runbooks/agent-recovery.md#auto-done-on-merge) when relying on it. It does not repair acceptance checklists.

### Unclaim

For an abandoned claim use [unclaim and release](./runbooks/agent-recovery.md#unclaim): clearing the assignee does not release the worktree.

### Reopen

Follow the [terminal-state policy](./convention.md#reopen--status-policy). Create follow-up work instead of reopening a terminal item.

## Orchestration (multi-agent work)

Non-trivial items are **orchestrated by default**: the delivery lead delegates instead of implementing inline. Trivial items stay inline. [Engineering](./engineering.md#roles-and-authority) owns the role table, named authority and promotion policy, not a separate agent dialect.

- Plan file-disjoint waves; items touching the same files belong in separate waves.

<!-- arggon:excerpt start: dispatch -->

- **Claim before dispatch:** the lead calls `tools.arggon.start({ id, assignee, worktree: true })` before launching a maker, and passes the returned worktree path. Stamp the writer's role id, never the product owner's login. Never dispatch a maker as first claimant or hold an idle claim; unclaim **and release** unused worktrees.
- Launch makers foreground in headless OpenCode runs. Each maker confirms its existing claim and works only in the handed-off worktree; it does not re-claim, replace a live writer's stamp, or flip done.

<!-- arggon:excerpt end: dispatch -->

- The lead owns tracker state, conflict coordination, review and merge verification, and final `validate`/`doctor` checks. Sequencing is not authority to change product priority; use the [authority map and decision brief](./engineering.md#roles-and-authority).
- Follow §4 for implementation, evidence, verdict and merge, and §5 for close-out. Report findings to the lead for consolidation.

For permissions, client gaps, binding guards, a writer collision or native evidence harness, read the [orchestration runtime reference](./references/orchestration.md).

## Documentation maintenance (docs, ADRs, specs, plans)

Trivial documentation corrections use the ordinary same-PR rule in §4. Read the [documentation reference](./references/documentation.md#documentation-maintenance-docs-adrs-specs-plans) for changed commands/schema, authoring a spec/plan, refreshing a playbook, adoption or promoting a repeated lesson. The rule and its carriers live there; do not duplicate them in the umbrella skill.

## Changing the methodology itself

A PR touching `ArggonManager/docs/{agents,engineering,convention}.md` or `skills/arggon-cli/**` states its **impact class** in the PR description and a work-item comment:

- **Advisory**: wording, structure or reorganization; no rule, gate, command contract or pipeline step changes.
- **Behavioral**: agents must re-learn a rule, gate, command contract or pipeline step. Reference [ADR 0016](./adr/0016-adopter-upgrade-channel.md), sync the skill and its generated copies (`npm run skills:sync`, byte-equal modulo generated marker), and update all statements made false in the same PR.

Reviewers check the impact statement. References extracted from these carriers remain methodology: moving a rule into a reference does not exempt its edits from this requirement.

## Adoption sweep (existing repos)

Read [adoption sweep](./references/documentation.md#adoption-sweep-existing-repos) only when adopting or migrating an existing repository.

## JSON for agents

Read the relevant command in the [JSON contract](./json-output.md) for envelope fields, output bounds and schema compatibility; don't load the whole matrix for an ordinary item.

## MCP server

Read [MCP server](./references/agent-runtime.md#mcp-server) when wiring a client or changing MCP behavior.

## Reference integrations

The minimal snippets below remain the source extracted by `arggon instructions`; use [CI wiring](./ci.md) for the complete branch-aware seam gate and the [runtime reference](./references/agent-runtime.md#reference-integrations) for client adapters.

### Pre-commit gate

`.git/hooks/pre-commit` (make executable):

```sh
#!/bin/sh
npm run arggon -- validate
```

### CI gate

```yaml
tasks-validate:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    - name: Install arggon
      run: npm install -g arggon-manager
    - run: arggon init --no-commit
    - run: arggon validate --json
```

### Agent instructions snippet

```markdown
## Task workflow (ArggonManager)

Start with ArggonManager/docs/agents.md for the operational core and its targeted references.
```

### OpenCode V2

Read [OpenCode V2](./references/agent-runtime.md#opencode-v2) when installing or debugging that adapter.

### ZCode

Read [ZCode](./references/agent-runtime.md#zcode) when installing that adapter, enabling goal mode or opting into scan automations.

### Claude Code

Read [Claude Code](./references/agent-runtime.md#claude-code) when installing or debugging that adapter.

## Self-improvement loop

Read the [self-improvement protocols](./references/documentation.md#self-improvement-loop) for audits, telemetry mining and friction visibility.

## Earlier entry points

Old section links remain entry points to the targeted references:

<a id="agent-playbook-v0"></a><a id="related"></a>

Read [agents.md](./agents.md) for these moved sections.

<a id="agent-seams-arggon-init---agents----no-agents"></a><a id="orphaned-destinations-what-init-reaps-and-when"></a><a id="worktree-in-the-claim-start---worktree"></a><a id="readiness-reporting-manifestcoverage"></a><a id="install-hygiene"></a><a id="fresh-worktree-install-gate-bug-start-install-ordering"></a><a id="worktree-env-contract-arggonenv"></a><a id="single-writer-ownership-claim-stamp-exploration-017-f12"></a><a id="failure-semantics"></a><a id="force-push-spellings-what-the-seam-permits-and-what-it-refuses"></a><a id="which-layer-enforces-the-seams-shell-gates"></a><a id="native-start-dependency-contract"></a>

Read [agent-runtime.md](./references/agent-runtime.md) for these moved sections.

<a id="cleanup"></a>

Read [agent-recovery.md](./runbooks/agent-recovery.md) for these moved sections.

<a id="worktree-ownership-and-collisions"></a><a id="decision-briefs-and-the-answer-grammar"></a>

Read [orchestration.md](./references/orchestration.md) for these moved sections.

<a id="what-to-update-by-change-type"></a><a id="specs-and-plans-for-non-trivial-features"></a><a id="technology-playbooks-stack-decisions-and-doc-freshness"></a><a id="promoting-lessons-promote-never-store"></a><a id="verification-before-opening-the-pr"></a>

Read [documentation.md](./references/documentation.md) for these moved sections.
