---
name: arggon-cli
description: Work in an ArggonManager repo — run the find → claim → work → PR loop and follow the engineering methodology (specs, ADRs, explorations, playbooks) with the native arggon tools (OpenCode V2) or the arggon CLI.
version: 0.5.0
author: Arggon (Arggon), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [CLI, Tasks, Agents, JSON]
    related_skills: []
---

# Arggon CLI Skill

Use for work in an ArggonManager repository. **Read the repository's root
`AGENTS.md` first.** In the ArggonManager source repository it routes to the
operational core at `ArggonManager/docs/agents.md`. In an **adopting repository**,
root `AGENTS.md` and that project's own convention and engineering documents
own the loop; ArggonManager's source-only playbook and reference files are not
installed there. Do not try to load absent source-repository documents.

This umbrella is the generated command catalog, not a second copy of those
claim, done or review rules. If the project has no full governing docs yet,
`arggon init --full` supplies adopter-owned templates; use the bundled JSON
contract and command `--help` for interface detail, never invent a missing
project rule.

## Read on demand

| Reference                                    | When to read                                                       |
| -------------------------------------------- | ------------------------------------------------------------------ |
| [JSON contract](references/json-contract.md) | A specific command's fields, bounds, failures, native or MCP tools |
| [Methodology](references/methodology.md)     | Selecting planning artifacts or technology guidance                |
| [Exploration](references/exploration.md)     | A greenfield project or new subsystem before implementation        |
| [Orchestration](references/orchestration.md) | Delegating an item or diagnosing a client/worktree binding         |
| [Pitfalls](references/pitfalls.md)           | A known trap or recovery case                                      |
| [Friction](references/friction.md)           | ArggonManager itself obstructs the work                            |

Reference links above are relative to the skill. Project paths are explicitly
repository-root-relative so they also work when this skill is generated under
`.agents/skills/arggon-cli/`.

## Install / update

Use `npm install` in a package checkout. `npm run arggon -- <command>` runs
TypeScript source; the installed `arggon` bin is `dist/cli.js`, so rebuild with
`npm run build` after pulling. Invoke from inside the target repository: the
CLI detects the tracker root, including legacy layouts.

OpenCode V2 uses the native `tools.arggon` namespace and `/arggon-*` commands
first when that adapter is installed; the CLI remains complete without an
adapter. Client setup and upgrade behavior are in the project's
`ArggonManager/docs/references/agent-runtime.md`.

## Generated command catalog

The regions below come from the live CLI. Run `npm run skills:sync` after
command, flag or description changes; the test suite rejects drift. Curated
command nuances live in the relevant reference, not a handwritten second
catalog.

### Initialize or adopt

```bash
<!-- arggon:generated-commands start: init,adopt -->
arggon init [dir]  # Scaffold the tracker convention (+ templates + governing docs) in a repo (ArggonManager/; legacy tasks/ trees upgrade in place)
arggon adopt  # Inventory the repo's governing docs and create the tracked, agent-executable adoption task (requires init)
<!-- arggon:generated-commands end -->
```

### Work on an item

```bash
<!-- arggon:generated-commands start: list,next,branch,start,update,comment,show,goal,handoff,create,validate -->
arggon list  # List work items under the tracker root with optional filters
arggon next  # Suggest the next claimable leaf item (task/bug leaves; ready items rank first, by downstream weight — unblocks count; lexicographic id on ties; --include-stories opts stories back in)
arggon branch <id>  # Check out the working branch for an item (generated from branch_patterns)
arggon start <id>  # Claim an item, check out its branch, commit, push, and optionally open a draft PR
arggon update <id>  # Update frontmatter fields of a work item
arggon comment <id> [text]  # Append a timestamped, author-attributed comment section to an item's body
arggon show <id>  # Read one item with bounded output (ADR 0006): frontmatter + last comments; full body is an explicit opt-in
arggon goal <id>  # Render the goal-mode contract for one claimed item (objective + verification + boundaries) from its acceptance checklist
arggon handoff <id>  # Append a structured, bounded handoff section (branch, next step, open questions) to an item's body
arggon create <type> <title>  # Create a work item under the tracker root (label at creation with --labels <csv>)
arggon validate  # Validate tracker frontmatter and tree integrity
<!-- arggon:generated-commands end -->
```

Follow `ArggonManager/docs/agents.md` for selecting, claiming, implementing,
verifying and closing an item.

### Views and recovery

```bash
<!-- arggon:generated-commands start: board,report,doctor,sync,import-issues,instructions,cleanup,priority migrate,migrate,friction -->
arggon board  # Write a static read-only HTML board from the tracker (git files stay the source of truth)
arggon report  # Aggregate leaf statuses per container, grouped by epic, plus report-only terminal-container hygiene and risk-triage checks (display only)
arggon doctor  # Report installation state: convention version, generated-doc provenance, tracker counts (pure read); with --budget, also the ADR 0006 context-budget surfaces incl. the live MCP tool-schema size (report-only)
arggon sync  # Reconcile task branch fields with open GitHub PRs
arggon import-issues  # One-shot import of GitHub issues into the tracker as task/bug items (idempotent; x-import maps labels to types)
arggon instructions  # Print the agent wiring (install, pre-commit, CI) extracted from the agent playbook
arggon cleanup  # List worktrees of done/cancelled items whose branches are merged (--prune removes them)
arggon priority migrate  # Move legacy pN labels into the priority field on all items (highest label wins, all pN labels removed, non-priority labels kept; idempotent; never auto-commits — review and commit once)
arggon migrate  # Move a legacy tasks/ tracker (and its product docs) to the ArggonManager/ layout (ADR 0012, convention v5; idempotent, never auto-commits)
arggon friction [observation]  # Record friction in ArggonManager itself into the local append-only friction log (never the tracker, never the network), or render its deduped report with --report [--tier a|b], or remove the whole log with --clear
<!-- arggon:generated-commands end -->
```

### Planning artifacts

```bash
<!-- arggon:generated-commands start: spec validate,spec analyze,spec audit,spec new,spec import,stack explore,playbook new,playbook status,playbook refresh -->
arggon spec validate  # Validate spec/plan frontmatter and section structure (pure read)
arggon spec analyze  # Checklist-driven ambiguity scan + spec/task consistency report (report-only, never edits; exit 0 with findings)
arggon spec audit  # Pairwise duplication detection over the product-docs specs/*.md (Jaccard + shared titles) — report only, never edits
arggon spec new <slug>  # Scaffold ArggonManager/docs/specs/spec-<slug>-NNN.md (and ArggonManager/docs/plans/plan-<slug>-NNN.md with --plan); never overwrites
arggon spec import <format> <path>  # Migrate a foreign spec corpus into Arggon spec docs with a per-file zero-loss assertion; all-or-nothing per run, never overwrites (formats: openspec)
arggon stack explore <topic>  # Scaffold ArggonManager/docs/explorations/exploration-<slug>-NNN.md (candidates, criteria, findings, recommendation); never overwrites
arggon playbook new <tech>  # Scaffold ArggonManager/docs/playbooks/<tech>.md pinning the chosen version; never overwrites (research is the caller's job)
arggon playbook status  # Report playbook freshness: age since `researched` vs the stale threshold (default 90, x-playbooks.max-age-days)
arggon playbook refresh <tech>  # After re-research: set version + researched: today + status: current (frontmatter-only, body untouched)
<!-- arggon:generated-commands end -->
```
