# 0008 Review smoke gate and UI smoke tooling

- Status: Accepted (2026-09-16 — adopted explicitly by product decision; decision record below)
- Date: 2026-09-16
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)

## Context

Two gaps in the review bar (docs/engineering.md):

1. The bar covered architecture and implementation quality but never named
   **scalability** or **security** as review dimensions — they were applied
   inconsistently, at reviewer discretion.
2. Approval required green CI and structural review, but the change was never
   required to **run**. The coordinator already probed CLI changes by hand
   (fixture repos, expected-vs-observed), and UI changes (the local board) had
   no equivalent at all — the UI review row read "N/A in Phase 1".

The methodology is **portable**: adopting repos run this same bar, and many are
UI-rich (e.g. ArggonStores, the first external adopter). A gate written only
around ArggonManager's minimal UI would be useless where it matters most, so
the UI path is specified generically. Tooling was explored in
[exploration smoke-ui-testing-006](../explorations/exploration-smoke-ui-testing-006.md)
(dated sources there): Playwright CLI vs Playwright MCP vs `@playwright/test`
vs Cypress, WebdriverIO, Puppeteer, Vercel agent-browser, Webwright, and
SaaS AI platforms.

## Decision

1. **Non-functional review dimensions.** The review bar explicitly names
   scalability (bounded payloads, declared complexity for corpus-scale
   inputs, no unbounded reads/renders) and security (defensive parsing of
   untrusted content, array-form subprocess args, no writes outside the repo
   root, minimal dependency surface).
2. **Blocking smoke gate** before approval (docs/engineering.md "Smoke test
   (blocks merge)"):
   - CLI behavior changes → the reviewer probes every changed/new command on
     a fixture repo and records evidence in the review verdict.
   - UI changes → a real-browser drive of `arggon board --serve` on a fixture
     tree: renders, parity with `arggon list`, one mutation round-trips and
     persists. Tool: **Playwright CLI** (`@playwright/cli`, agent-first,
     token-efficient, installable Skills); fallback Playwright MCP.
   - TUI → scripted pty render check or documented manual check (no browser
     automation applies).
   - Docs-only PRs are exempt.
3. **Optional CI tier:** a `@smoke`-tagged `@playwright/test` spec as a CI
   job. Playwright stays dev-only (Chromium-only in CI), never a runtime
   dependency; no SaaS.

## Consequences

- Review verdicts must carry smoke evidence — more review time on behavior
  changes, fewer untested regressions merged. "Green CI is necessary, not
  sufficient" gains teeth.
- The agent-first tool choice (Playwright CLI) matches how this repo works:
  reviewers are agents; no bespoke test code per PR.
- UI-rich adopters inherit a ready blocking gate; ArggonStores is the first
  external target, ArggonManager's board the first internal one.
- New failure surface to accept: browser smoke can flake (wait for render,
  drag-and-drop timing) — smoke failures are investigated like test failures,
  not waved through.

## Alternatives considered

Full comparison with dated sources in exploration smoke-ui-testing-006:

- **Cypress** — lost the 2026 head-to-head (single engine, worker overhead).
- **WebdriverIO** — WebDriver-protocol bound, slower, no agent-first CLI; its
  wins (mobile/Appium, ecosystem breadth) are out of scope here.
- **Puppeteer** — library only; no runner, no assertions.
- **Plain HTTP smoke** — cannot see drag-and-drop; fine as an inner assertion.
- **Webwright** (`microsoft/Webwright`) — MIT agent harness a layer above
  Playwright (agents write Playwright Python via code-as-action). Wrong layer
  for a verification gate: a second LLM, a Python runtime, and per-run
  non-determinism where the gate needs bounded, reviewable steps. Watch its
  Skill Factory pattern (solve distilled into a zero-token replayable skill) —
  conceptually the same shape as the tier-2 `@smoke` spec.
- **AI testing platforms (QA Wolf, Applitools, …)** — SaaS; boundary: no SaaS
  without an ADR.
- **Playwright MCP only** — standard agent integration, but superseded by the
  CLI for agent runtimes; kept as fallback.
