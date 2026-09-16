---
exploration_id: smoke-ui-testing-006
title: Smoke testing tooling: UI smoke gate for review (and CLI probe codification)
status: open
created: 2026-09-16
---

# Exploration: Smoke testing tooling: UI smoke gate for review (and CLI probe codification) (smoke-ui-testing-006)

Spike record: compare the candidates below, cite dated sources, and record a
recommendation. The decision itself lands in an ADR (`docs/adr/`) — link it
under Decision. A technology playbook (`arggon playbook new`) is generated
after the decision.

Trigger: proposed methodology addition — "before approving a change, run a
smoke test; for UI, drive a real browser". The reviewing agent already probes
changed CLI commands on fixture repos by hand (coordination modus operandi);
this exploration picks the tooling so the gate is codified, not tribal.

## Candidates

1. **`@playwright/test` (scripted runner)** — the classic Playwright test
   runner; smoke slicing via `npx playwright test --grep @smoke`. Deterministic
   specs over the local board server; exit-code gate CI can enforce.
2. **Playwright CLI (`@playwright/cli`, agent-cli)** — Microsoft's CLI for
   browser automation purpose-built for coding agents (released early 2026):
   token-efficient commands + installable Skills; positioned as the leaner
   successor to the MCP approach for agent-driven browser work.
3. **Playwright MCP** — the Model Context Protocol server exposing
   `browser_*` tools to agents. Predecessor of the CLI for the agent use case.
4. **Vercel agent-browser** — same niche as Playwright CLI (agent-first browser
   automation CLI), released around the same time.
5. **Cypress** — the classic Playwright alternative (single engine, its own
   runner/async model).
6. **Puppeteer** — browser automation library only (no runner, no assertions).
7. **Plain HTTP smoke (node `fetch`)** — assert the board server responds and
   renders key markers; no real browser, no drag-and-drop coverage.
8. **AI testing platforms (QA Wolf, Applitools/Percy, Sauce, …)** — SaaS
   agent/visual-testing platforms.
9. **Webwright (`microsoft/Webwright`)** — MIT Python "SWE-style browser
   agent framework": turns a coding LLM into a browser agent via
   code-as-action (the model writes and runs Playwright *Python* scripts in
   a terminal loop). First public release 2026-05-04; ~1.5k LoC; needs an
   LLM backend (OpenAI/Anthropic/OpenRouter).

## Criteria

Weighted, "better" means:

1. **Deterministic + CI-gateable (high)** — the gate must be mechanical:
   exit codes, no flaky judgment, enforceable in review/CI.
2. **Agent-runner friendly (high)** — reviews in this repo are executed by
   agents; the tool must be drivable by an agent with bounded token cost and
   without bespoke test code for every PR.
3. **Fits the actual UI surface (high)** — the product UI is `arggon board
   --serve` (local HTTP server + static board HTML with drag-and-drop state
   changes routed through the kernel). No mobile, no cross-browser matrix, no
   hosted anything (SaaS is out without an ADR).
4. **Dependency weight (medium)** — repo ships `commander` as its only runtime
   dependency; browsers/bundled tooling must stay dev-only or npx-only.
5. **Maintenance burden (medium)** — smoke specs must not rot with every CSS
   tweak; agent-driven checks avoid per-PR spec authoring.
6. **Ecosystem health (medium)** — longevity, release cadence, community.

## Findings

- Playwright is the 2026 consensus winner over Cypress: 23–88% faster in
  benchmarks, native 3-engine support, free parallel execution, adoption has
  surpassed Cypress (source: https://testdino.com/blog/playwright-vs-cypress,
  2026-09-16; source: https://getautonoma.com/blog/playwright-vs-cypress,
  2026-09-16; source:
  https://www.reddit.com/r/QualityAssurance/comments/1mh61dp/why_playwright_is_winning_the_race_against_cypress/,
  2026-09-16).
- Smoke slicing with the scripted runner is a solved pattern: tag specs
  `@smoke` and run `npx playwright test --grep @smoke` for a fast feedback
  loop on every PR (source:
  https://playwright.dev/docs/test-cli, 2026-09-16; source:
  https://tech-insider.org/playwright-tutorial-end-to-end-testing-2026/,
  2026-09-16).
- **Playwright CLI (`@playwright/cli`) exists and is new** (early 2026): a
  CLI for browser automation designed for coding agents — token-efficient
  commands, installable Skills, positioned as the leaner successor to the
  MCP approach for agent-driven browser work (source:
  https://playwright.dev/agent-cli/introduction, 2026-09-16; source:
  https://github.com/microsoft/playwright-cli, 2026-09-16). Community
  reception for agent workflows is positive; analysts frame it as
  MCP-replacement for agents, not a test-framework replacement (source:
  https://testdino.com/blog/playwright-ai-eucosystem, 2026-09-16).
- Playwright MCP remains the standard way to give an AI agent browser hands
  and is widely integrated (Claude Desktop, VS Code, Cursor); teams also use
  it for test drafting — an agent explores a live feature and proposes tests
  (source: https://playwright.dev/docs/getting-started-mcp, 2026-09-16;
  source: https://testomat.io/blog/playwright-mcp-modern-test-automation-from-zero-to-hero/,
  2026-09-16).
- Vercel agent-browser competes in the same agent-first CLI niche with a
  similar philosophy but different engine/tooling; Playwright CLI is the
  safer pick for this repo because tier 2 shares the same engine and release
  line (source: https://playwright.dev/agent-cli/introduction, 2026-09-16).
- Cypress loses the head-to-head for new projects: single-engine
  architecture, worker overhead, slower parallel runs (source:
  https://medium.com/lets-code-future/cypress-vs-playwright-i-ran-500-e2e-tests-in-both-heres-what-broke-2afc448470ee,
  2026-09-16).
- **WebdriverIO** (raised during review of this spike; closest name to a
  suggested "webright" — no tool by that exact name exists): built on the W3C
  WebDriver + DevTools protocols vs Playwright's direct engine; Playwright
  runs 30–50% faster on equivalent suites; WebdriverIO's wins are mobile via
  Appium and ecosystem breadth — neither applies here (local HTML board, no
  mobile). Crucially, WebdriverIO has no agent-first CLI rivaling
  `@playwright/cli`, the niche this gate needs (source:
  https://www.deviqa.com/blog/playwright-vs-webdriverio-how-to-choose-in-2026/,
  2026-09-16; source: https://pie.inc/blog/webdriverio-vs-playwright/,
  2026-09-16; source:
  https://getautonoma.com/blog/webdriverio-vs-playwright-enterprise,
  2026-09-16).
- AI testing platforms (QA Wolf, Applitools, Sauce, TestGuild lists) are
  SaaS or paid services — they collide with the repo boundary "Still out
  without an ADR: hosted/SaaS anything" (docs/engineering.md) (source:
  https://www.qawolf.com/blog/the-12-best-ai-testing-tools-in-2026,
  2026-09-16).
- **Webwright** (`https://github.com/microsoft/webwright`, read 2026-09-16)
  sits a layer ABOVE Playwright, not against it: its agent writes and runs
  Playwright Python scripts (code-as-action). Built for long-horizon agentic
  web TASKS (flight search, forms; Online-Mind2Web 86.7%, Odysseys 60.1%)
  and explicitly not for website testing. Its **Skill Factory** distills a
  solved task into a parameterized skill that replays in ~40s with zero
  tokens (WebArena reuse 55% → 70%) — the same shape as our tier-2 scripted
  `@smoke` spec: verification should end up deterministic and token-free.
- The board UI routes UI-initiated updates through the same kernel
  read/update paths as the CLI (ADR 0002; `cli/src/board-serve.ts` imports
  `runUpdate`), so a UI smoke test can assert end-to-end persistence with
  `arggon list/show` after a browser interaction.

## Recommendation

**Two tiers, both Playwright — the user's instinct holds, with a refinement:**

1. **Review-time UI smoke (the gate): Playwright CLI (`@playwright/cli`).**
   The reviewing agent drives the real board (`arggon board --serve` on a
   fixture tree) through the agent CLI: board renders, cards/columns match
   `arggon list`, a drag/status change applies and persists (verified with
   `arggon show`). Token-efficient, zero bespoke test code per PR, installable
   Skills match how this repo works. Fallback: Playwright MCP when an agent
   runtime has no CLI support. Vercel agent-browser stays on the radar but
   Playwright CLI shares the engine/maintenance line with tier 2.
2. **CI scripted smoke (optional job, `@smoke`-tagged): `@playwright/test`.**
   A tiny permanent spec (board loads, N cards render, one mutation round-trips)
   run via `npx playwright test --grep @smoke` in CI for the deterministic
   regression net; reviews get the flexible exploratory check from tier 1.
   Playwright becomes a devDependency (or npx-pinned), Chromium-only in CI —
   no runtime dependency, no SaaS.

**Losers:** Cypress (loses head-to-head, single engine), WebdriverIO (slower,
WebDriver-protocol bound, no agent-first CLI — its wins are mobile and
ecosystem breadth, both out of scope here), Puppeteer (library
only, no runner), plain HTTP smoke (can't see drag-and-drop; fine as an inner
assertion inside tier 2), AI/SaaS platforms (boundary: no SaaS without ADR).
**Webwright is a near-miss, not a loser on quality:** it is MIT OSS and
impressive, but it is the wrong layer for this gate — the smoke verifier is
already an agent (the reviewer) with browser hands, so Webwright's added LLM
harness means a second model, Python runtime (repo is Node/TS), token cost
per run, and non-determinism where the gate needs bounded, reviewable steps.
Watch its Skill Factory pattern; revisit if a future need is autonomous
multi-step web tasks rather than verification.

**Out of scope for a browser:** TUI (`arggon tui`) — smoke stays a scripted
pty render check or manual; noted in the methodology text as the exception.

## Decision

Proposed: `docs/adr/0008-review-smoke-gate.md` — smoke gate + tooling choice
(Playwright CLI for agent-driven review smoke; `@playwright/test` for the
optional CI smoke job). Pending acceptance.
