---
type: task
status: in_progress
id: task-review-bar-smoke-gate
title: "Review bar: non-functional dimensions + blocking smoke gate (ADR 0008)"
assignee: Arggon
branch: feat/task-review-bar-smoke-gate
parent: story-dogfood-self-host
labels: [p2]
created: "2026-09-16"
updated: "2026-09-16"
claimed_at: "2026-09-16T23:26:44.598Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-dogfood-self-host/task-review-bar-smoke-gate.md
  Leaves live only under a story. id is the filename stem: task-review-bar-smoke-gate.
  CLI `arggon create task review-bar-smoke-gate` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Review bar: non-functional dimensions + blocking smoke gate (ADR 0008)

## Context

User decision (2026-09-16, coordinator session): adopt two methodology requirements, designed in [exploration smoke-ui-testing-006](../../../../../docs/explorations/exploration-smoke-ui-testing-006.md).

1. **Reviews focus on quality, scalability, security.** Today the review bar (docs/engineering.md) covers architecture + implementation quality but never names scalability or security. Concretely for this repo: bounded payloads (ADR 0006 spirit), declared complexity for corpus-scale inputs (`spec audit` is O(n²) over spec pairs), untrusted-content parsing (repos we adopt), no shell interpolation, no writes outside the repo root, minimal dependency surface.
2. **Blocking smoke gate before approval.** Two tiers: CLI behavior changes → probe the changed commands end-to-end on a fixture, evidence recorded in the review verdict (codifies what the coordinator already does); UI changes → browser smoke via Playwright CLI (`@playwright/cli`, fallback Playwright MCP): board renders, matches `arggon list`, one mutation round-trips and persists. Docs-only PRs exempt; TUI = scripted pty check (no browser). Optional CI tier: `@playwright/test` `@smoke` job.

**Portability rationale (user):** ArggonManager has minimal UI, but the methodology is adopted by other repos that may be UI-rich (ArggonStores-am) — the gate is written repo-agnostic; UI-rich adopters are the primary beneficiaries.

**Decisions:** (a) adopt both with this design; (b) the gate is BLOCKING for applicable changes; (c) ADR 0008 lands together with the methodology edits, same PR.

## Acceptance

- [ ] docs/engineering.md: non-functional bar (quality/scalability/security) in the review bar; blocking smoke-test section; testing-expectations table row; UI row updated
- [ ] docs/agents.md: coordinator review paragraph carries the extended bar + smoke evidence; subagent expectation line updated
- [ ] docs/adr/0008-review-smoke-gate.md: ADR (Accepted; decision recorded from exploration 006), alternatives listed
- [ ] docs/explorations/exploration-smoke-ui-testing-006.md: status open → decided, Decision links ADR 0008
- [ ] skills/arggon-cli/SKILL.md: review nuance bullet added; `npm run skills:sync` run (parity test green)
- [ ] Gates: validate ok, doctor 0 modified / 0 drifted, suite + lint + build green

## Notes
