# 0001 CLI stack (Phase 1)

- Status: Proposed
- Scaffold PR: seeks Architect **Accepted** with #8 implementation
- Date: 2026-09-03
- Deciders: Software Developer (author), Software Architect (review), Project Manager (aware)

## Context

Phase 1 needs a CLI (`arggon`) for create / list / update / validate / claim over the git-native `tasks/` tree defined in [`docs/convention.md`](../convention.md). Stack and scaffold are tracked in [#8](https://github.com/Arggon/ArggonManager/issues/8). Repo shape and ADR process are locked in [`docs/engineering.md`](../engineering.md); this ADR fills the stack choice without fighting that layout.

Acceptance of this ADR (Status to Accepted) is expected with the #8 scaffold PR (or an explicit Architect accept), not merely by merging this docs-only proposal.

## Decision

**Node.js + TypeScript** for the Phase 1 CLI.

| Choice | Value |
| --- | --- |
| Runtime | Node.js **20+** |
| Language | TypeScript |
| Package manager | **npm** (zero-friction for agents; no pnpm bootstrap required) |
| Package layout | **Root package.json** owns the install (one install for agents); TypeScript under `cli/`; binary `arggon` via root bin |
| CLI framework | **commander** -- widely known, stable argv parsing, easy JSON-friendly subcommands |
| Frontmatter / YAML (later) | Ecosystem libs (e.g. gray-matter, yaml); **zod** for frontmatter validation when validate lands |
| Tests | **vitest** (placeholders in scaffold) |
| Lint / format | **eslint** + **prettier** (placeholders in scaffold) |


### Locked layout (from engineering.md)

```text
package.json          # npm install at repo root (one install for agents)
cli/                  # TypeScript sources (not a nested package)
fixtures/
  tasks-valid/
  tasks-invalid/
```

Binary name: **`arggon`** (matches [`docs/convention.md`](../convention.md) examples).

## Consequences

- Agents and humans need **Node 20+** to run or develop the CLI.
- Distribution for Phase 1 is **npm / npx** (and local `npm link` / `npm run`); a single-binary ship is deferred.
- Scaffold (#8) uses root package.json + `cli/` sources + root `fixtures/`; ADR stays Proposed until Architect accepts with the scaffold PR.
- Strong DX: YAML/frontmatter ecosystem, fast iteration, easy JSON stdout for agents.

## Alternatives considered

- **Go** -- excellent single-binary distribution; less critical for Phase 1; slower YAML/frontmatter DX for agents than Node/TS.
- **Python** -- fast to prototype; weaker packaged CLI + typed-schema story for agents than TypeScript + zod.
- **Rust** -- best for performance/distribution; higher iteration cost for Phase 1 create/list/validate work.