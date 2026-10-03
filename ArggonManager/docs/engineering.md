# Engineering conventions (Phase 1)

> **Methodology carrier (per [ADR 0020](./adr/0020-methodology-first-productization.md)).** This document is a carrier of the ArggonManager methodology — declared together with `ArggonManager/docs/agents.md`, `ArggonManager/docs/engineering.md`, `ArggonManager/docs/convention.md`, and the bundled `arggon-cli` skill.
>
> - **Scope:** any project — not only software.
> - **Invariants:** humans and agents follow the same rules; state lives in git; discipline is enforceable; docs travel with code; never-steal / never-reopen.
> - **Version:** tracks the ArggonManager package version.
> - **Upgrade channel:** methodology changes reach adopters through the adopter upgrade channel ([ADR 0016](./adr/0016-adopter-upgrade-channel.md)).

Technical direction for ArggonManager: how we structure the repo, what “done” means for eng, and the bars that block merge.

This document is owned by **Software Architect**. It complements [`ArggonManager/docs/convention.md`](./convention.md) (task tree / frontmatter schema). Product/feature acceptance stays with **Project Manager**. Implementation stays with **Software Developer**. UI QA (Phase 2+) stays with **UI Tester**.

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
ArggonManager/          # git-native work tree + product docs (see `ArggonManager/docs/convention.md`)
  docs/                 # product docs: convention, engineering, agents, adr/, specs/, plans/
lib/                    # @arggondev/lib kernel package (ADR 0013): TypeScript sources (lib/src)
  src/index.ts          # kernel entry: items, rules, paths, envelopes + operations
  src/operations.ts     # in-process operations: --json envelope + exit codes per command
cli/                    # root package (arggon-manager): CLI, seam generation, MCP adapter
  src/                  # commands + tests co-located
  src/package-assets.ts # root package root + bundled templates dir (injected into the kernel)
dist/                   # compiled bin (gitignored; npm run build)
lib/dist/               # compiled kernel package (gitignored)
templates/              # scaffolded by arggon init
skills/arggon-cli/      # agent skill for the CLI (keep in sync with `ArggonManager/docs/json-output.md`)
fixtures/               # golden trees for validate + integration tests
.github/workflows/      # ci.yml (build+test+lint), auto-done.yml
```

**Boundaries**

| Concern                               | Lives in                                                          | Does not                                    |
| ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| Task schema / statuses / folder rules | `ArggonManager/docs/convention.md` + sample `ArggonManager/` tree | CLI source comments as sole source of truth |
| Eng process, review bar, ADR, DoD     | `ArggonManager/docs/engineering.md`                               | Product roadmap (PM)                        |
| CLI behavior                          | `cli/` (or stack equivalent)                                      | Phase 2 board UI, Phase 3 SDK               |
| Durable decisions                     | `ArggonManager/docs/adr/`                                         | Long debate only in PR threads              |

**Shipped beyond the original Phase 1 scope** (each behind its own ADR/PR): static board + drag-and-drop + local serve (ADR 0002), GitHub reconciliation (`sync`), stdio MCP server. **Still out without an ADR:** hosted/SaaS anything, a parallel task schema, or an agent-only dialect of the rules.

**Sample tree:** the fixture `fixtures/tasks-valid/tasks/launch-mvp/` is both the product demo and a test fixture. Changing convention requires updating samples and CLI tests in the same change set when the CLI exists.

---

## Review bar (blocks merge)

A PR merges only when **all** applicable bars pass:

### Architecture / boundaries (Software Architect)

**Operating principle 1: code is cheap; good practices and sound software architecture are always important.** Architecture quality is always in scope, on every PR: clear module boundaries, small surfaces, tests that travel with behavior, and docs that travel with code are part of "done" — never deferred as "refactor later". The speed of writing code never justifies structural debt.

- Changes match documented boundaries (convention vs eng vs CLI).
- No silent schema forks: if CLI behavior disagrees with `ArggonManager/docs/convention.md`, update the doc **in the same PR** or open a follow-up that blocks release.
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
- **TUI:** no browser automation applies; smoke is a scripted pty render check or a documented manual check in the verdict. The scripted check is `npm run smoke:tui-board` (`smoke/tui-board-smoke.ts`): it runs `arggon board --tui` in a pty via util-linux `script` and drives a 14-step scripted session — board frame (five status headers, seeded item, freshness stamp), live refresh (an item created behind the board appears without a keypress), the ready lens on and off, priority and next-rank sorts, the `/` search prompt filtering to the seeded task, card selection opening the detail pane, a chunk-split PgDn paging the pane while the pane stays open, and the board restored with selection and filter intact — then quits with `q`; it skips cleanly where `script` is unavailable.
- **Native worktree/start changes:** the deterministic check is `npm run smoke:native-start-cold` (`smoke/native-start-cold-smoke.ts`, model-free and offline): on a disposable git fixture it proves the dependency-requiring `pre-commit` gate fails in a cold worktree, then drives the real `tools.arggon.start` seam and requires an explicit bounded readiness/claim-commit receipt, a claim commit containing only the item file, a deterministic re-run attach with no duplicate commit, and an untouched canonical install. It is a durable gate, not a substitute for the model-driven `smoke:opencode` transcript, which stays the runtime-level evidence.
- **CI tier (`cli` job) for the native start path:** the last step of the `cli` job runs `npm run smoke:native-start-cold` (`task-wire-native-start-cold-smoke-into-ci`), after the `npm run build` whose kernel it drives, beside `test:structure` / `lint:structure`. The step is blocking by construction (no `continue-on-error`, no `|| true`, no advisory `if:`), so it fails the lane like any other node gate, and it is dev-only: offline, model-free, Chromium-free, no second install — which is why it is in `cli` and not the `ui-smoke` job. Observed runtime ~0.5s, so it is on every PR rather than label-gated. What it does not claim: it does not replace the model-driven transcript smoke, and its fixture install is synthesized, so it proves resolution rather than npm's reifier.
- **CI tier (`ui-smoke` job):** the durable `@smoke`-tagged `@playwright/test` spec (`e2e/board.smoke.spec.ts`, Chromium only, `npx playwright test --grep @smoke`) drives `board --serve` on a temp fixture — board loads, cards match `arggon list`, one status move round-trips and persists. The same job runs the TUI frame check above. The review-time gate above stays the blocking bar. Playwright is dev-only, Chromium-only in CI — never a runtime dependency.
- **Accessibility (automated, in the same `ui-smoke` lane):** the first `@smoke` test runs `@axe-core/playwright` (version-pinned devDependency, never shipped) against the served board, on the readiness signal the spec already waits for (`h1` present) and before the card-parity and round-trip tests move the page on. It asserts the **automatable WCAG A/AA set across all three WCAG versions** — `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` — so a 2.1/2.2 AA rule cannot pass unreported. AAA and `best-practice` are deliberately out of scope. The policy is **no blanket exclusions**: zero `disableRules`/`exclude`/`include`/narrowed rule lists, zero accepted exceptions; an accepted exception must record the exact rule id, the reason and an owner in a comment at the call site and in `CONTRIBUTING.md` § UI smoke tests. A violation is fixed in the board or filed as a linked item — never excluded to get a green lane. What it does not claim: axe automates only part of WCAG (keyboard interaction, focus order, reflow and non-text contrast stay manual — `task-board-non-text-contrast-and-drag-affordance`), and the scan covers the ready board, not the detail drawer, the static export or the lens/filtered states (`task-axe-board-drawer-and-lens-coverage`).
- **Flake reproduction harness (opt-in, env-gated — never wired into CI):** an intermittent e2e failure is reproduced under instrumented load, not chased by reruns. `e2e/helpers/flake-harness.ts` arms CDP `Emulation.setCPUThrottlingRate` (`E2E_THROTTLE=<n>`; 20 is the proven setting) plus host busy-spinner processes (`E2E_SPINNERS=<n>`; 16 saturates a 12-core box) for any Playwright spec that imports the harness `test` — `e2e/board.smoke.spec.ts` does — and both fixtures are strict no-ops without the env, so the default lane is unaffected. Recipe (proven on the live-reload race, bug-live-reload-sse-race / PR #521): `E2E_THROTTLE=20 E2E_SPINNERS=16 npx playwright test --grep "<flaky spec>"`. A malformed value fails loud naming the variable; grep to the suspect spec (throttling every page makes the whole lane crawl). What it does not claim: it supplies the load, not the diagnosis — a reproduced failure still needs the evidence trail (#521's buffered server event log + HAR) to separate wait-mechanism defects from real signal loss.

The gate is repo-agnostic: adopting repos run the same bar against their own surface — UI-rich adopters (e.g. ArggonStores) are its primary beneficiaries.

### Review verdicts (comment convention)

Verdicts land **on the item** with `arggon comment <id>` — never as GitHub PR comments. A verdict comment starts with a bounded header line, `verdict: approve` or `verdict: request-changes` (optionally followed by a short scope), and then the evidence list: commands run, expected vs observed. This is documentation, not schema — human-written prose. `arggon sync --json` reads it report-only and classifies every item it reconciles with an open PR as `approved` (latest verdict is an approve), `changes-requested` (the latest verdict is a request-changes) or `none`; a later `verdict: approve` supersedes an earlier `verdict: request-changes`. A blocking merge gate is deliberately out of scope until the report proves low-noise.

Example:

```
### 2026-09-29 @Reviewer
verdict: request-changes (smoke evidence missing)
- probed `arggon sync --json` on a fixture: expected `verdicts` per matched item, observed field absent
- unit tests travel with the parser
```

### UI (UI Tester)

- When a PR touches UI, the **smoke-test bar above applies** (real-browser drive); UI QA ownership (UI Tester) remains as scoped in Phase 2.

### Docs

- User-facing behavior changes update README and/or convention/engineering as appropriate.
- ADRs for stack, identity, and cross-cutting schema decisions (see below).
- PRs touching the methodology carriers state their **methodology impact class** (advisory / behavioral, with an ADR 0016 reference when behavioral) — reviewers check it like any bar above; see `ArggonManager/docs/agents.md` §Changing the methodology itself.

---

## Testing expectations

| Layer                        | Required                         | Notes                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                         | Yes                              | Parsing, status transitions, claim rules, path/`id` checks                                                                                                                                                                                                                                                                    |
| Fixture / golden             | Yes                              | Valid tree must pass `validate`; each invalid layout rule has a failing fixture                                                                                                                                                                                                                                               |
| Integration                  | Yes for file-mutating commands   | `create` / `update` / claim against a temp copy of fixtures; assert git-friendly file output                                                                                                                                                                                                                                  |
| E2E against the real tracker | Optional                         | Nice-to-have; fixtures are the merge gate                                                                                                                                                                                                                                                                                     |
| Smoke (review gate)          | Blocking for behavior/UI changes | Probe evidence in the review verdict; UI changes get a real-browser drive via Playwright CLI ([ADR 0008](./adr/0008-review-smoke-gate.md)); docs-only exempt                                                                                                                                                                  |
| Smoke (CI `ui-smoke` job)    | Runs for board/TUI changes       | `npx playwright test --grep @smoke` (Chromium, dev-only) drives `board --serve` on a temp fixture and asserts the ready page against the automated WCAG A/AA rules (`@axe-core/playwright`, no blanket exclusions); `npm run smoke:tui-board` asserts the TUI frame in a pty; see [ADR 0008](./adr/0008-review-smoke-gate.md) |

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
ArggonManager/docs/adr/
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

**A status change lands in the ADR file, and the check that says so is a test, not a sweep.** A carrier (`agents.md`, this file, `convention.md`, `skills/arggon-cli/**`) links to the ADR that decided something; it never restates that ADR's status. Restating is what makes status drift — a carrier claiming `Proposed` for an ADR merged as Accepted is wrong in a way its reader cannot recover from the link, and it has to be re-edited by hand on every acceptance, so it is eventually not. `cli/src/adr-index-parity.test.ts` fails a PR whose [ADR index](./adr/README.md) row misreports a file's status; `cli/src/adr-status-doc-contract.test.ts` fails a PR whose carrier states a status for an ADR or links to one that does not resolve. Both read `docs/adr/*.md` as the authority, so adding, accepting, superseding or renaming an ADR needs no documentation edit elsewhere — only the ADR file and its index row.

---

## Naming, commits, PRs

- **Branches:** `type/short-kebab` — `docs/…`, `feat/…`, `fix/…`, `chore/…`
- **Commits:** imperative, scoped when helpful (`docs:`, `cli:`, `test:`)
- **PRs:** problem + approach + test plan; reference the tracker work item id — move it to `done` only when fully done (issues live in the tracker, not GitHub; see `ArggonManager/docs/agents.md` §0)
- **Convention vs engineering:** schema/layout/status → `ArggonManager/docs/convention.md`; process/structure/review/ADR → `ArggonManager/docs/engineering.md` or `ArggonManager/docs/adr/`
- **Agents and humans** follow the same PR and claim rules; agent-only shortcuts are out of scope unless an ADR says otherwise

---

## Definition of done (engineering, Phase 1)

A Phase 1 eng change is done when:

1. Behavior matches `ArggonManager/docs/convention.md` where applicable
2. Review bars above are satisfied (Architect + PM as relevant)
3. Tests/fixtures cover the change (once CLI exists)
4. Docs/ADR updated in the same PR when contracts change
5. No known validate false-pass for the new behavior
6. Follow-ups filed as tracker items (not GitHub issues, not TODOs left only in code) when deferred

---

## Phase 2 / 3 (boundary notes only)

- **Viewer/board (shipped):** the static board and the local `--serve` route go through the same kernel read/update paths; drag-and-drop parity with the CLI rules is test-enforced. Spike constraints: [`ArggonManager/docs/viewer-spike.md`](./viewer-spike.md).
- **Agent hooks (partially shipped):** the stdio MCP server and the `agent` caller flag enforce the same validate/claim rules as the CLI; no private agent dialect. A fuller SDK still requires an ADR.

Details belong in later ADRs — do not pre-build those packages in Phase 1.

---

## Related

- Task convention: [`ArggonManager/docs/convention.md`](./convention.md)
- CLI stack: [ADR 0001](./adr/0001-cli-stack.md) · board: [ADR 0002](./adr/0002-board-viewer-v0.md) · milestone field: [ADR 0003](./adr/0003-milestone-field.md) · review smoke gate: [ADR 0008](./adr/0008-review-smoke-gate.md) · **each ADR's status lives in its own `- Status:` line** — the [ADR index](./adr/README.md) is the register (see [ADR process](#adr-process): carriers link to ADRs, they never restate a status)
- Claim concurrency: [`ArggonManager/docs/claim.md`](./claim.md)
- Agent playbook: [`ArggonManager/docs/agents.md`](./agents.md) · JSON contract: [`ArggonManager/docs/json-output.md`](./json-output.md)
