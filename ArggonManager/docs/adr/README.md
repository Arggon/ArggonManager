# Architecture decision records

See [ADR process](../engineering.md#adr-process) in `docs/engineering.md`.

Files: `NNNN-short-title.md` (four-digit number, kebab title).

The Title column is the ADR's own `# NNNN Title` heading, verbatim. A row that
deliberately differs declares the difference in its own ADR as
`- Index title: …`; without that line the row must copy the heading. Enforced
by `cli/src/adr-index-parity.test.ts`, which also pins one row per ADR, the
numbering, the status and the row order.

| ADR                                                           | Title                                                                                                          | Status                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [0001](./0001-cli-stack.md)                                   | CLI stack (Phase 1)                                                                                            | Accepted                               |
| [0002](./0002-board-viewer-v0.md)                             | Board viewer v0 (static + serve)                                                                               | Accepted (shipped as prototype)        |
| [0003](./0003-milestone-field.md)                             | Milestone field (folded into v3)                                                                               | Accepted                               |
| [0004](./0004-milestone-deps-v3.md)                           | Convention v3: milestone + dependency graph                                                                    | Accepted                               |
| [0005](./0005-cheap-path-to-prod.md)                          | Default cheap-path-to-prod guidance for generated projects                                                     | Accepted                               |
| [0006](./0006-token-context-efficiency.md)                    | Token/context efficiency: compact envelopes, `show` read path, `next`-first guidance, generated-docs budget    | Accepted                               |
| [0007](./0007-mcp-2026-07-28-adoption.md)                     | MCP specification 2026-07-28: partial adoption for the stdio server                                            | Accepted                               |
| [0008](./0008-review-smoke-gate.md)                           | Review smoke gate and UI smoke tooling                                                                         | Accepted (adopted by product decision) |
| [0009](./0009-item-priority-and-orchestrator-ranking.md)      | Item priority and orchestrator ranking                                                                         | Accepted (adopted by product decision) |
| [0010](./0010-opencode2-native-architecture.md)               | OpenCode2 native architecture: portable kernel, native V2 surface                                              | Partially superseded by 0011           |
| [0011](./0011-native-first-architecture.md)                   | Native-first architecture: OpenCode-native surface over a git-native tracker                                   | Accepted (amended by 0013)             |
| [0012](./0012-tracker-root-layout.md)                         | Tracker root and product docs layout: `ArggonManager/`                                                         | Accepted                               |
| [0013](./0013-lib-package-split.md)                           | Kernel package: `@arggondev/lib`                                                                               | Accepted                               |
| [0014](./0014-zcode-native-seam.md)                           | ZCode native seam: MCP as the full tool surface + declarative plugin                                           | Accepted                               |
| [0015](./0015-done-gate-acceptance-waiver.md)                 | Done gate: enforce acceptance-checklist completeness on the terminal flip, with an explicit waiver             | Accepted (amended by 0025)             |
| [0016](./0016-adopter-upgrade-channel.md)                     | Adopter upgrade channel                                                                                        | Accepted                               |
| [0017](./0017-greenfield-exploration-gate.md)                 | Greenfield exploration gate                                                                                    | Accepted                               |
| [0018](./0018-update-delivery-and-distribution-channel.md)    | Update delivery and distribution channel (release pipeline, update channel, skew, tarballs)                    | Accepted                               |
| [0019](./0019-worktree-runtime-isolation.md)                  | Worktree runtime isolation: environment contract by default, ephemeral service containers as an opt-in pattern | Proposed                               |
| [0020](./0020-methodology-first-productization.md)            | Methodology-first productization with per-agent native adapters                                                | Accepted                               |
| [0021](./0021-agents-primary-workers-human-product-owner.md)  | Agents as primary workers, humans as product owner                                                             | Accepted                               |
| [0022](./0022-decline-autoharness-autocontext-autocompact.md) | External agent tooling — decline AutoHarness / AutoContext / AutoCompact, and steal the lesson-store idea      | Proposed                               |
| [0023](./0023-ci-wall-clock.md)                               | CI wall clock: concurrency groups, duration-aware sharding, and the `cli` required check                       | Proposed                               |
| [0024](./0024-adopter-friction-channel.md)                    | Adopter friction channel                                                                                       | Accepted                               |
| [0025](./0025-done-gate-live-acceptance-section.md)           | Done gate scope: the live `## Acceptance` section, and no contract means no flip                               | Proposed                               |
| [0026](./0026-owner-decision-brief.md)                        | The bounded plain-language decision brief: how a delivery lead brings a decision to the product owner          | Accepted                               |
