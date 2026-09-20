# 0005 Default cheap-path-to-prod guidance for generated projects

- Status: Accepted
- Date: 2026-09-14
- Deciders: Software Architect (author); coordinator accepts on merge

## Context

Operating principle 2 (2026-09-14): **infrastructure is expensive.** Every
ArggonManager-generated project must ship with a credible, low-cost answer to
"how does this reach production?" Adopters are typically low-staffing and
agent-operated: the deployment path must be executable by a coding agent from
files in the repo, cost near zero at small scale, and survive the industry
trend of free-tier cuts (Oracle halved its Always-Free ARM allocation in
2026; Hetzner raised VPS prices in June 2026; Netlify moved its free plan to
a credit model — sources with access dates in
[exploration cheap-path-to-prod-001](../explorations/exploration-cheap-path-to-prod-001.md)).

## Decision

Generated projects get a **decision framework keyed on project shape**, with
these defaults (details and dated pricing in the exploration):

| Project shape | Default | Because |
| --- | --- | --- |
| Static site / docs | GitHub Pages (or Cloudflare Pages for heavy traffic) | free, push-to-deploy, zero extra accounts; Cloudflare offers unmetered static bandwidth |
| SPA + small API | Cloudflare Workers + static assets | real free tier (100k req/day, no spin-down), agent-deployable via Wrangler config; $5/mo escape hatch |
| Long-running server/DB/websockets | Cheapest always-on PaaS (Fly.io ~$4/mo, Render Starter $7/mo); Hetzner CX23 €5.49/mo VPS for cost-optimal adopters | no credible free tier for always-on; VPS is cheapest but carries patch/TLS/backup burden |
| Jobs / cron | Scheduler on the existing host (Workers Cron Triggers, systemd timers) | avoids the maintenance jump of dedicated queue infra until a real requirement exists |

Constraints on every default:

- Expressible as files in the generated repo (no console-only setup), so an
  agent can execute it and the exit path is "redeploy elsewhere".
- No proprietary state lock-in (databases/storage must be exportable).
- Free-tier limits and gotchas (spin-down, cold starts, caps) are surfaced in
  the generated project's docs, never hidden.

## Consequences

- `init` and playbooks will carry per-shape deployment defaults and an exit
  note — delivered via follow-up product items, not in this ADR.
- Pricing is time-sensitive: the exploration records access-dated sources;
  the guidance should be re-verified when a tier changes materially.
- We accept vendor concentration risk on Cloudflare (two of four shapes) in
  exchange for the lowest credible cost; the config-in-repo rule keeps exit
  cheap.
