---
exploration_id: cheap-path-to-prod-001
title: "Cheapest credible path to production for generated projects"
status: resolved
created: 2026-09-14
---

# Exploration: cheap-path-to-prod (cheap-path-to-prod-001)

Operating principle 2 (2026-09-14): **infrastructure is expensive.** Every
ArggonManager-generated project needs a default answer to "how does this get
to production with the lowest setup and ongoing maintenance cost?" This
exploration compares candidates per common project shape and recommends a
decision framework (not a single vendor) that init/playbooks can apply.

Decision record: [ADR 0005 — Default cheap-path-to-prod guidance for generated projects](../adr/0005-cheap-path-to-prod.md) (Proposed).

## Candidates

By project shape:

- **Static site / docs:** GitHub Pages (free, repo-integrated) vs Cloudflare
  Pages (free, unlimited bandwidth) vs Netlify free plan.
- **SPA + small API:** Cloudflare Workers + Pages Functions (free tier,
  100k req/day) vs Vercel Hobby vs Render free web services vs Fly.io.
- **Full-stack server (long-running process, DB, websockets):** small VPS
  (Hetzner CX23/CAX11, Oracle Always-Free ARM) vs PaaS (Render paid, Fly.io).
- **Background jobs / cron:** cron + systemd timers on the same host vs
  platform schedulers (Workers Cron Triggers, Render cron jobs) vs queues.

## Criteria

Weighted for an agent-operated, low-staffing adopter:

1. **Setup effort — agent-executable?** A coding agent must be able to stand
   it up end-to-end from a repo (config files + CLI, no console-only steps).
2. **Monthly cost at small scale** — concrete, dated numbers; free-tier
   reality (hard caps vs soft limits, spin-down) counts.
3. **Maintenance burden** — patches, certificates, scaling, price-change
   exposure (free tiers get cut: Oracle halved its ARM allocation in 2026).
4. **Exit cost** — how expensive it is to move to another provider when the
   free tier is withdrawn or the project outgrows it.

## Findings

All sources accessed 2026-09-14 unless noted.

### Static site / docs

- GitHub Pages: free, integrated with the repo; **soft** 100 GB/month
  bandwidth limit, 10 builds/hour, 1 GB site size (source:
  https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits, 2026-09-14).
- Cloudflare Pages free: **unlimited bandwidth** for static assets, 500
  builds/month, 20k files/site (source:
  https://developers.cloudflare.com/pages/platform/limits/, 2026-09-14).
- Netlify free: 100 GB bandwidth, shifting to a credit model (~300
  credits/month); sites pause at the cap instead of billing overage
  (source: https://www.netlify.com/pricing/, 2026-09-14).
- **Take:** zero cost for all three; Cloudflare Pages has the most generous
  bandwidth, GitHub Pages has zero extra accounts/tooling. Both are
  push-to-deploy and fully agent-executable.

### SPA + small API

- Cloudflare Workers/Pages Functions free: 100,000 requests/day, 10 ms CPU
  per invocation, 3 cron triggers, KV 1k writes/day; $5/mo paid tier removes
  the caps (source: https://developers.cloudflare.com/workers/platform/limits/, 2026-09-14).
- Vercel Hobby: free, ~100 GB fast data transfer, functions up to 300 s,
  **non-commercial use only**, hard caps, Pro is $20/mo (source:
  https://vercel.com/docs/plans/hobby, 2026-09-14).
- Render free: 750 instance-hours/month per workspace, **spin-down after
  ~15 min inactivity with ~1 min cold start**, 5 GB/month free bandwidth,
  free databases expire after 30 days; paid starts $7/mo (source:
  https://render.com/docs/free, 2026-09-14).
- Fly.io: no meaningful free tier for new users; shared-cpu-1x/256 MB is
  ~$1.94/mo + $2/mo dedicated IPv4 → realistic floor ~$4/mo (source:
  https://fly.io/docs/about/pricing/, 2026-09-14).
- **Take:** Cloudflare Workers is the cheapest credible default (real free
  tier, no spin-down, agent-deployable via Wrangler config in-repo). Render
  free's cold starts make it unacceptable for anything user-facing.

### Full-stack server

- Hetzner cheapest VPS: CX23 **€5.49/mo** (prices raised up to ~3x in the
  June 2026 adjustment — a live example of free/cheap-tier price risk);
  CAX11 ARM ~€6.49/mo (source:
  https://www.hetzner.com/cloud/cost-optimized/, and
  https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/, 2026-09-14).
- Oracle Always-Free ARM: quietly **halved in 2026** from 4 OCPU/24 GB to
  2 OCPU/12 GB (1,500 OCPU-hours + 9,000 GB-hours/month), with widespread
  "out of capacity" reports — free tiers are not a stable foundation
  (source: https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/, July 2026).
- **Take:** a ~€5-7 VPS is the cheapest *credible* always-on full-stack
  host, but it carries the highest maintenance burden (OS patches, TLS,
  backups) — only default to it when the project genuinely needs a
  long-running process, and prefer managed Postgres/storage add-ons over
  self-hosting state where possible.

### Background jobs / cron

- Cron on the same host is free but couples job survival to the host.
- Cloudflare Workers Cron Triggers: up to 3 per Worker on free (source:
  https://developers.cloudflare.com/workers/platform/limits/, 2026-09-14).
- **Take:** if the app already runs on Workers, use Cron Triggers; on a VPS,
  systemd timers; avoid dedicated queue infrastructure until a real
  requirement exists — it is the single largest maintenance jump.

### Cross-cutting

- Free tiers are being cut industry-wide (Oracle 2026 halving; Hetzner June
  2026 price adjustment; Netlify credit-model shift). Defaults must be cheap
  **and** portable: config-in-repo, no proprietary state lock-in, documented
  exit path.

## Recommendation

Adopt a **decision framework keyed on project shape**, not a vendor pick:

1. **Static output only** → GitHub Pages if the repo already lives on GitHub
   (zero extra accounts); Cloudflare Pages if traffic is heavy or
   GitHub-bandwidth soft limits are a concern.
2. **SPA + small API (short-lived request handlers)** → Cloudflare Workers +
   static assets; free tier covers most small APIs; $5/mo is the escape hatch.
3. **Long-running server / DB / websockets** → cheapest always-on PaaS
   (Fly.io ~$4/mo, Render Starter $7/mo) for low-maintenance adopters;
   Hetzner CX23 €5.49/mo VPS for cost-optimal adopters who accept patching.
4. **Jobs/cron** → scheduler on the existing host (Workers Cron Triggers or
   systemd timers); no queues until required.

Every default must be expressible as files in the generated repo
(Wrangler/Pages config, GitHub Actions workflow, systemd units) so an agent
can execute it and an adopter can exit by redeploying elsewhere.

## Decision

[ADR 0005 — Default cheap-path-to-prod guidance for generated projects](../adr/0005-cheap-path-to-prod.md)
captures this framework (status: Proposed). Follow-up product items will
carry it into init/playbooks.
