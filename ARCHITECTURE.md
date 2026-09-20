<!-- arggon:generated template="ARCHITECTURE.md" -->

# ArggonManager — Architecture

## Problem

Distributed teams and autonomous agents work on the same repositories, but their work
tracking has drifted apart: humans track work in a SaaS (GitHub Issues/Jira), agents need
machine-readable state, and neither enforces the other's discipline. ArggonManager solves
this by making the git tree itself the tracker: work items (initiatives, epics, stories,
tasks, bugs) are Markdown files under the tracker root, managed by the `arggon` CLI, reviewed and
merged as ordinary PRs.

Hard constraints:

- **Git-native**: the tracker must work offline, in worktrees, and review as diffs. No
  server, no database, no lock files.
- **Agent-first contract**: every command has a `--json` mode emitting a stable
  `schemaVersion: 1` envelope ([`ArggonManager/docs/json-output.md`](ArggonManager/docs/json-output.md)); agents and
  humans follow the same claim/branch/PR rules — no agent-only dialect.
- **Discipline enforceable, not aspirational**: layout, frontmatter, statuses, and claim
  rules are validated by the CLI (`arggon validate`) and CI, per
  [docs/convention.md](ArggonManager/docs/convention.md).

Non-goals (require an ADR before reconsidering): hosted/SaaS anything, a parallel task
schema, agent-only shortcuts around the shared rules.

## Big picture

A representative operation — `arggon update task-foo --status done --json`:

```text
cli.ts (commander)                     parse args, resolve repo root (paths.ts)
  └─> operations.ts                    kernel operation: envelope + exit-code semantics
        └─> update.ts (command)        load item, apply status transition
              ├─> items.ts / status.ts       kernel: read frontmatter, transition rules
              ├─> rules.ts / relations.ts    claim/blocked invariants, parent/child + cascade
              ├─> frontmatter.ts             serialize YAML frontmatter (no YAML dependency)
              └─> json.ts / contract.ts      schemaVersion 1 envelope + conventionVersion
```

The kernel package entry (`lib/src/index.ts`, package `@arggon/lib`, ADR 0013) exposes
this stack — items, rules, paths and the `--json` envelopes — as one typed surface; the
root CLI, the MCP adapter and (from W2/W3) the native plugin tools consume the same
operations (ADR 0011 §4: one logic path, one library).

Read commands (`list`, `board`, `next`, `validate`, `doctor`) parse the tree and emit
without writing. Mutation commands (`create`, `update`, `comment`, `adopt`) write through
the kernel and, when `x-tracker.auto-commit` is on
([the tracker `.convention.yml`](ArggonManager/.convention.yml)), commit tracker mutations via
`tracker-commit.ts`. Governance commands (`init`, `docs`, `playbooks`, `instructions`)
generate adopter files from bundled templates under `templates/` and `skills/`, stamping
provenance into the `x-generated` section of the tracker `.convention.yml` so re-runs are
never-overwrite (Copier/Helm semantics).

## Code map

```text
<repo root>
  ArggonManager/    # DATA, not code: the git-native tracker + product docs (ADR 0012)
    .convention.yml # tree version, branch_patterns, x-generated provenance
    docs/           # process & product documentation (humans and agents)
      convention.md # task layout + frontmatter + statuses — schema source of truth
      engineering.md# structure, review bar, ADR process
      agents.md     # agent playbook: claims, PRs, JSON contract, MCP
      adr/ specs/ plans/ playbooks/
    <initiative>/<epic>/<story>/  # work items (task-*.md / bug-*.md leaves)
  lib/              # @arggon/lib: the kernel package (ADR 0013), tests co-located
    src/index.ts    # kernel entry: items, rules, paths, envelopes + operations
    src/items|status|update|rules|relations|ids|frontmatter|dates|filter|json|contract.ts
                    # item model, transitions, invariants, envelope contract
    src/operations.ts # in-process operations: the --json envelope + exit-code semantics per command
  cli/src/          # the CLI/root package: one module per command, tests co-located
    cli.ts          # commander wiring; argv parsing, TTY gates and human output live here
    package-assets.ts # root package root + bundled templates dir (injected into the kernel)
    init|docs|adopt|doctor|instructions|playbooks.ts
                    # adoption/governance: scaffolding, doc generation, health checks
    start|branch|cleanup|steal-gate|layout-migrate.ts
                    # work-loop + lifecycle commands (claim, worktree, migration)
    spec|spec-audit|spec-import|sync-skills|skill-commands|measure|build-info.ts
                    # spec pipeline, skill sync, context budgets, build identity
    mcp-server.ts   # stdio MCP adapter over the kernel operations (conditional surface)
    board|board-serve|tui.ts
                    # local static board + viewer (ADR 0002)
  templates/        # item + doc scaffolds bundled by arggon init
  skills/           # agent skill source, bundled to adopters at .agents/skills/
  fixtures/         # golden trees for validate + integration tests
  dist/             # compiled bin (gitignored; npm run build)
  lib/dist/         # compiled kernel package (gitignored)
```

## Boundaries and layering rules

- [docs/convention.md](ArggonManager/docs/convention.md) is the source of truth for schema/layout/
  status; the CLI implements it and `arggon validate` enforces it — never the reverse.
- Commands import the kernel; kernel modules never import command modules.
- Machine surfaces (CLI, MCP adapter, native tools) consume the kernel through the
  `@arggon/lib` package entry; envelope assembly lives in the kernel operations
  (`lib/src/operations.ts`), never in a surface. The kernel ships no assets or
  printing: the root adapter injects the item-templates dir
  (`cli/src/package-assets.ts`).
- All tree mutations go through command modules that run validation gates; raw
  tracker files edits that bypass validation are caught by CI and the pre-commit hook.
- the tracker is data: product code must not depend on its contents (fixtures and tests
  build temp trees instead of reading this repo's live tree).
- The JSON contract (`schemaVersion: 1`) is additive-only; envelope fields are documented
  in [`ArggonManager/docs/json-output.md`](ArggonManager/docs/json-output.md) in the same PR that changes them.
- Stack decisions (TypeScript/ESM, commander, vitest) are ADR-recorded; changes need a
  new ADR ([docs/adr/](ArggonManager/docs/adr/)).

## Invariants

- `init`/doc generation never overwrites an adopter-modified file → guarded by
  `cli/src/init-docs.test.ts` (never-overwrite semantics) and provenance checksums.
- A claimed item cannot be claimed again; `blocked` requires a reason → `rules.ts`
  invariants, tested in `lib/src/validate.test.ts`.
- One branch per item, derived from `branch_patterns` in the tracker `.convention.yml` →
  `cli/src/branch.test.ts`.
- Envelopes always carry `ok`, `schemaVersion`, `command`, `conventionVersion` →
  `lib/src/contract.test.ts`.
- Pure commands (`list`, `validate`, `doctor`) never write → temp-tree tests.

---

Generated by `arggon init` 2026 — edit freely; `arggon init` never overwrites existing files.
