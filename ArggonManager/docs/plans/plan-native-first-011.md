---
plan_id: native-first-011
title: Plan for the native-first ArggonManager rebuild
spec: ArggonManager/docs/specs/spec-native-first-011.md
status: implemented
created: "2026-09-19"
---

# Plan: Native-first ArggonManager rebuild (native-first-011)

Derived from `ArggonManager/docs/specs/spec-native-first-011.md`. Waves W0–W7; each wave is a
tracker task under `native-redesign` with its acceptance criterion and
`depends_on` edges. Waves execute serially (one at a time); the `depends_on`
chain encodes that order, and semantic prerequisites are stated per task. Every wave keeps the CLI suite green and re-measures the
ADR 0006 surfaces it touches.

## T0: W0 — Layout rename and legacy migration

- Rename the tracker root to `ArggonManager/` and move all product docs under
  `ArggonManager/docs/` (kernel paths, convention, templates, generated seam,
  skills/commands/agents, CI, this repo's dogfood tree); keep legacy `tasks/`
  auto-detection and provide the migration command.
- **Acceptance:** a legacy tree is detected and migrated by the command; this
  repo dogfoods the new layout; all suites green; no hard break for adopters.

## T1: W1 — Kernel as a library

- Extract the kernel from `cli/src` into an importable library entry with a
  stable typed API (items, rules, paths, `--json` envelopes); the CLI consumes
  it; behavior and envelopes unchanged.
- **Acceptance:** the package imports from a clean build; the full suite
  (1311+) is green; no rule logic moves outside the kernel.
- **W1b note (ADR 0013, `task-native-lib-package`):** the library is its own
  package `@arggondev/lib` under the workspace (`lib/`), and the root package
  depends on it; the `arggon-manager/lib` subpath export is removed. W2
  consumes the package entry, and the W3 vendored single-file plugin bundle
  builds from `@arggondev/lib` (the kernel stays dependency-free and asset-free;
  the root adapter injects the item-templates dir).

## T2: W2 — Native tools

- Register the `arggon` tool namespace (`ctx.tool.transform`,
  `options.codemode: true`) with contract-typed inputs/outputs for
  list/create/update/show/next/report/validate/comment/handoff/priority and
  `sync`/`import-issues`; parity tests against `--json`.
- **Acceptance:** headless smoke calls every tool; contract tests green; a
  kernel error surfaces as a typed tool error and the session continues; the
  ADR 0006 tool-schema measurement re-runs and stays within budget.

## T3: W3 — Native commands and seam

- Replace CLI-driving commands with native commands driving tools (including
  `/arggon-adopt` for guided adoption); regenerate the seam without the MCP
  stanza; ship the vendored single-file plugin build; update the AGENTS.md
  router and the skill.
- **Acceptance:** fresh-`init` fixture plus one headless scenario per command;
  `init` stays idempotent with provenance; no MCP stanza is written.

## T4: W4 — Permissions, worktrees and lifecycle

- Ship permission defaults (reviewer `edit` deny; coordinator subagent
  allow-list; minimal shell gates); implement start/cleanup over the worktree
  domain; keep the `gh` PR step; kernel invariants unchanged.
- **Acceptance:** headless claim → worktree → commit → (stubbed) PR → done
  scenario; never-steal and no-reopen invariants covered by tests; cleanup
  removes merged worktrees.

## T5: W5 — TUI board and status

- Register board/status panels and routes; commands to open them; item status
  contributions to the sidebar.
- **Acceptance:** TUI smoke checklist plus plugin-load check; no session
  startup regressions.

## T6: W6 — Headless bootstrap and CI

- Keep `init`/`validate`/`doctor`/`--json` in the packaged bin; provide the CI
  recipe (workflow snippet) and a fresh-clone fixture.
- **Acceptance:** fresh clone → `init` → CI green without a model; `npm pack`
  install test.

## T7: W7 — Dogfood, measurement and release

- Migrate this repo's own `.opencode` seam to the native surface; run
  `context:report --strict`; finish packaging/release docs; tag.
- **Acceptance:** ADR 0006 budgets within limits; dogfood scenarios green;
  release checklist executed.
- **Recorded evidence (2026-09-21, `task-native-dogfood-release` / PR #381):**
  this repo's tracked `.opencode` seam migrated with `arggon init` under the
  provenance contract (created 10 / updated 15; `AGENTS.md` and
  `CONTRIBUTING.md` stayed adopter-modified and untouched; a second run left
  every content file byte-identical). Dogfood in real sessions over this repo:
  Code Mode `tools.arggon.*` (14 visible to a worker session — `create` hidden
  by the W4 deny), a headless tools session, `/arggon-status` expanded by the
  V2 command loader, and the TUI board panel rendering the 277-item tree.
  ADR 0006 re-measured with `context:report --strict` (exit 0): native tools
  **11,821 B ≤ 12,288 B** (15 definitions, 9 pinned; the W4-era 106 B headroom
  recovered by trimming redundant schema bytes, bound unchanged), item block
  252 B ≤ 1,024 B, generated AGENTS.md 2,005 B ≤ 2,048 B, MCP `tools/list`
  10,507 B. Gates: `npm test` 1,454 tests, lint/build/`check:plugin`,
  `validate`/`spec validate`, `smoke:opencode` 26 scenarios / 0 failures,
  `smoke:tui` 13/13, `smoke:opencode:wave` 0 failures. Release prep (notes +
  runbook + checklist) is in the same PR; the version bump, tag and npm
  publication stay with the product owner (`ArggonManager/docs/runbooks/release.md`).

## Risks and rollback

- **API churn (2.0.x):** pin 2.0.12, feature-detect every optional surface;
  rollback is the previous vendored plugin kept by `init` provenance.
- **Kernel extraction regressions:** the parity suite gates T1; the CLI stays
  until T7.
- **Bootstrap:** T6 gates adoption; the B→A revisit criteria are tracked in ADR 0011.
- **Context budget:** each wave re-runs the measurement; a regression blocks
  the wave.
