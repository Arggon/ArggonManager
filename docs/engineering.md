# Engineering conventions (Phase 1)

Technical direction for ArggonManager: how we structure the repo, what “done” means for eng, and the bars that block merge.

This document is owned by **Software Architect**. It complements [`docs/convention.md`](./convention.md) (task tree / frontmatter schema). Product/feature acceptance stays with **Project Manager**. Implementation stays with **Software Developer**. UI QA (Phase 2+) stays with **UI Tester**.

**Status:** active. Phase 1 (convention + CLI) is implemented — stack per [ADR 0001](./adr/0001-cli-stack.md), board per [ADR 0002](./adr/0002-board-viewer-v0.md). This doc evolves in the same PRs as the behavior it governs.

---

## Goals

1. Keep the **repo** scalable as CLI, viewer, and agent hooks arrive.
2. Make discipline **enforceable** (review, CI, fixtures) — not aspirational.
3. Prefer one clear default over “team policy” ambiguity when agents and humans share workflows.

---

## Repo structure (Phase 1)

### Locked / in-flight product layout

```text
tasks/                  # git-native work tree (see docs/convention.md)
cli/                    # CLI package: TypeScript sources (cli/src), one module per command
  src/                  # kernel (items/status/update/rules), commands, tests co-located
dist/                   # compiled bin (gitignored; npm run build)
docs/
  convention.md         # task layout + frontmatter + statuses (source of truth for CLI validate/create)
  engineering.md        # this file
  agents.md             # agent playbook (claims, PRs, JSON contract, MCP)
  json-output.md        # --json contract (schemaVersion 1)
  adr/                  # architecture decision records (see below)
  specs/  plans/        # feature specs and implementation plans (see docs/agents.md)
templates/              # scaffolded by arggon init
skills/arggon-cli/      # agent skill for the CLI (keep in sync with docs/json-output.md)
fixtures/               # golden trees for validate + integration tests
.github/workflows/      # ci.yml (build+test+lint), auto-done.yml
```

**Boundaries**

| Concern | Lives in | Does not |
| --- | --- | --- |
| Task schema / statuses / folder rules | `docs/convention.md` + sample `tasks/` | CLI source comments as sole source of truth |
| Eng process, review bar, ADR, DoD | `docs/engineering.md` | Product roadmap (PM) |
| CLI behavior | `cli/` (or stack equivalent) | Phase 2 board UI, Phase 3 SDK |
| Durable decisions | `docs/adr/` | Long debate only in PR threads |

**Shipped beyond the original Phase 1 scope** (each behind its own ADR/PR): static board + drag-and-drop + local serve (ADR 0002), GitHub reconciliation (`sync`), stdio MCP server. **Still out without an ADR:** hosted/SaaS anything, a parallel task schema, or an agent-only dialect of the rules.

**Sample tree:** `tasks/launch-mvp/` (or successor) is both product demo and a **fixture**. Changing convention requires updating samples and CLI tests in the same change set when the CLI exists.

---

## Review bar (blocks merge)

A PR merges only when **all** applicable bars pass:

### Architecture / boundaries (Software Architect)

**Operating principle 1: code is cheap; good practices and sound software architecture are always important.** Architecture quality is always in scope, on every PR: clear module boundaries, small surfaces, tests that travel with behavior, and docs that travel with code are part of "done" — never deferred as "refactor later". The speed of writing code never justifies structural debt.

- Changes match documented boundaries (convention vs eng vs CLI).
- No silent schema forks: if CLI behavior disagrees with `docs/convention.md`, update the doc **in the same PR** or open a follow-up that blocks release.
- No shortcuts that break Phase 2/3 extensibility without an ADR (e.g. hard-coding non-unique ids, inventing frontmatter keys outside reserved extension rules).
- Architect may **block merge** on quality even if PM accepted the feature.

### Product acceptance (Project Manager)

- Behavior matches product intent and is shippable.
- PM may bounce a feature that is technically clean.

### Implementation quality (Software Developer, checked in review)

- Code is readable; public CLI flags/commands documented in README or `cli` help.
- Errors are actionable (especially validate failures).

### Non-functional bar (quality · scalability · security)

Quality is the operating principle above; **scalability and security are named review dimensions**, not aspirations. Every behavior change is reviewed against:

- **Scalability** — payloads stay bounded (ADR 0006 spirit); algorithms declare their complexity wherever inputs grow with the corpus (items, specs, docs): an O(n²) pairwise scan must say so and justify its input ceiling; no unbounded reads/renders over the task tree; JSON envelopes grow sub-linearly or are capped.
- **Security** — untrusted content (adopted repos' markdown/frontmatter/JSON) is parsed defensively; subprocess arguments are arrays, never shell-interpolated; no writes outside the repo root; secrets never committed or logged; the dependency surface stays minimal (a new runtime dependency needs justification in the PR).

### Smoke test (blocks merge)

Before a change is approved it is **smoked — executed end-to-end, not just unit-tested**. The bar is blocking for applicable changes; docs-only PRs are exempt.

- **CLI behavior changes:** the reviewer probes every changed/new command on a fixture repo and records the evidence in the review verdict (commands run, expected vs observed). Prefer deterministic `--json` output for evidence.
- **UI changes (board HTML / `board --serve`):** the reviewer drives a real browser against `arggon board --serve` on a fixture tree — the board renders, cards match `arggon list`, and one status change round-trips through the UI and persists (verified with `arggon show`). Tool: **Playwright CLI** (`@playwright/cli`, agent-first; fallback Playwright MCP) — see [ADR 0008](./adr/0008-review-smoke-gate.md).
- **TUI:** no browser automation applies; smoke is a scripted pty render check or a documented manual check in the verdict.
- **CI tier (optional):** a `@smoke`-tagged `@playwright/test` spec (board loads, cards render, one mutation round-trips) may run as a CI job; the review-time gate above stays the blocking bar. Playwright is dev-only, Chromium-only in CI — never a runtime dependency.

The gate is repo-agnostic: adopting repos run the same bar against their own surface — UI-rich adopters (e.g. ArggonStores) are its primary beneficiaries.

### UI (UI Tester)

- When a PR touches UI, the **smoke-test bar above applies** (real-browser drive); UI QA ownership (UI Tester) remains as scoped in Phase 2.

### Docs

- User-facing behavior changes update README and/or convention/engineering as appropriate.
- ADRs for stack, identity, and cross-cutting schema decisions (see below).

---

## Testing expectations

| Layer | Required | Notes |
| --- | --- | --- |
| Unit | Yes | Parsing, status transitions, claim rules, path/`id` checks |
| Fixture / golden | Yes | Valid tree must pass `validate`; each invalid layout rule has a failing fixture |
| Integration | Yes for file-mutating commands | `create` / `update` / claim against a temp copy of fixtures; assert git-friendly file output |
| E2E against real `tasks/` | Optional | Nice-to-have; fixtures are the merge gate |
| Smoke (review gate) | Blocking for behavior/UI changes | Probe evidence in the review verdict; UI changes get a real-browser drive via Playwright CLI ([ADR 0008](./adr/0008-review-smoke-gate.md)); docs-only exempt |

**Rules**

- Convention changes that alter validate semantics ship with fixture updates in the **same** PR.
- Do not skip tests with “docs only” if the PR changes CLI behavior.

---

## ADR process

**When to write an ADR**

- CLI stack / package layout (#8)
- Identity model (`id` uniqueness, path vs id canonicality)
- Claim/concurrency model (beyond #16 notes)
- Introducing reserved frontmatter namespaces or breaking schema changes
- Adding a new top-level package (viewer, SDK, services)

**When not to**

- Typos, pure refactors, or local implementation choices that don’t change external contracts

**Location & naming**

```text
docs/adr/
  NNNN-short-title.md    # e.g. 0001-cli-stack.md
```

Use a 4-digit monotonic number. Title is kebab-case.

**Template (minimum)**

```markdown
# NNNN Title

- Status: Proposed | Accepted | Superseded by NNNN
- Date: YYYY-MM-DD
- Deciders: …

## Context
## Decision
## Consequences
## Alternatives considered
```

**Lifecycle:** Proposed in a PR → Accepted when merged (or explicitly recorded) → Superseded by a later ADR, never silently rewritten.

---

## Naming, commits, PRs

- **Branches:** `type/short-kebab` — `docs/…`, `feat/…`, `fix/…`, `chore/…`
- **Commits:** imperative, scoped when helpful (`docs:`, `cli:`, `test:`)
- **PRs:** problem + approach + test plan; reference the `tasks/` work item id — move it to `done` only when fully done (issues live in `tasks/`, not GitHub; see `docs/agents.md` §0)
- **Convention vs engineering:** schema/layout/status → `docs/convention.md`; process/structure/review/ADR → `docs/engineering.md` or `docs/adr/`
- **Agents and humans** follow the same PR and claim rules; agent-only shortcuts are out of scope unless an ADR says otherwise

---

## Definition of done (engineering, Phase 1)

A Phase 1 eng change is done when:

1. Behavior matches `docs/convention.md` where applicable
2. Review bars above are satisfied (Architect + PM as relevant)
3. Tests/fixtures cover the change (once CLI exists)
4. Docs/ADR updated in the same PR when contracts change
5. No known validate false-pass for the new behavior
6. Follow-ups filed as `tasks/` items (not GitHub issues, not TODOs left only in code) when deferred

---

## Phase 2 / 3 (boundary notes only)

- **Viewer/board (shipped):** the static board and the local `--serve` route go through the same kernel read/update paths; drag-and-drop parity with the CLI rules is test-enforced. Spike constraints: [`docs/viewer-spike.md`](./viewer-spike.md).
- **Agent hooks (partially shipped):** the stdio MCP server and the `agent` caller flag enforce the same validate/claim rules as the CLI; no private agent dialect. A fuller SDK still requires an ADR.

Details belong in later ADRs — do not pre-build those packages in Phase 1.

---

## Related

- Task convention: [`docs/convention.md`](./convention.md)
- CLI stack: [ADR 0001](./adr/0001-cli-stack.md) · board: [ADR 0002](./adr/0002-board-viewer-v0.md) · milestone field (Proposed): [ADR 0003](./adr/0003-milestone-field.md) · review smoke gate: [ADR 0008](./adr/0008-review-smoke-gate.md)
- Claim concurrency: [`docs/claim.md`](./claim.md)
- Agent playbook: [`docs/agents.md`](./agents.md) · JSON contract: [`docs/json-output.md`](./json-output.md)