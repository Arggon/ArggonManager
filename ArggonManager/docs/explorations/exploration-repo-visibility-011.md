---
exploration_id: repo-visibility-011
title: Repository visibility: public vs private impact and main/opencode2 parity
status: open
created: 2026-09-22
---

# Exploration: Repository visibility: public vs private impact and main/opencode2 parity (repo-visibility-011)

Spike record requested by the product owner (2026-09-22): measure the impact of
turning the public `Arggon/ArggonManager` repository private, and verify whether
`main` and `opencode2` still carry the same features and follow the same rules
and principles. All repository facts below were read from the GitHub API and the
local git history on **2026-09-22**; platform facts cite the linked docs
(accessed 2026-09-22). Follow-ups filed: `bug-docs-retired-opencode2-split`,
`task-retire-opencode2`, `task-ci-recipe-published-one-liner`,
`task-repo-visibility-decision`.

## Candidates

1. **Stay public** (current state): free/unlimited Actions on larger runners,
   branch protection and rulesets on Free, secret scanning and npm provenance
   available, public source and fork network.
2. **Go private on the current plan (GitHub Free)**: no Actions cost cap,
   but 2,000 included minutes/month, 2 vCPU runners, no protected branches or
   rulesets on private repos, secret scanning/provenance unavailable.
3. **Go private on GitHub Pro**: keeps protected branches and rulesets on
   private repos, 3,000 included minutes/month; everything else from (2) still
   applies (2 vCPU runners, no provenance, paid secret scanning).

## Criteria

1. **Adopter impact** — can adopters keep installing and running the generated
   CI without credentials?
2. **Cost** — Actions minutes and plan changes, measured against the current
   burn rate.
3. **Governance** — branch protection, required checks, rulesets, code owners.
4. **Security/supply chain** — secret scanning, provenance, artifact
   attestations.
5. **Licensing/community** — what is already distributed, MIT obligations,
   contribution and discovery surface.
6. **Readiness effort** — what must change before the switch is safe.

## Findings

### Branch parity: `main` and `opencode2` are the same product

- `git rev-list --left-right --count origin/main...origin/opencode2` → `0 2`:
  opencode2 is **main + 2 tracker commits**, not a divergent branch. The only
  file difference is the tracker item `bug-stale-vendored-plugin-copy.md`
  (`git diff --name-status origin/main origin/opencode2` → 1 added file;
  801 vs 802 tracked files). (source: local git, 2026-09-22)
- The rules surfaces are byte-identical: `ArggonManager/docs/{agents,engineering,convention,tracking}.md`,
  `README.md`, `CONTRIBUTING.md`, `templates/`, `skills/`, `opencode/plugins/`,
  `.opencode/agents|commands`, and all three workflows.
- The release checklist `task-release-0-4-0` step 3 is "Merge `opencode2` →
  `main`; `git tag v0.4.0`" and is checked; `v0.4.0` (`394654f5`) is an ancestor
  of `origin/main`, and CHANGELOG `[0.4.0]` on main lists the whole native-first
  OpenCode V2 surface. So **main already ships the OpenCode surface**; the docs
  that claim "main is untouched by product decision" are pre-release stale.
- Practical trap: the primary checkout `/home/arggon/Projects/ArggonManager` is
  on local `main` at `5bfb52f6` (2026-09-17), **785 commits behind**
  `origin/main` — inspecting that checkout suggests main lacks features it has.
- The only open item in the whole tracker (284 items: 281 done, 2 cancelled,
  1 todo) is `bug-stale-vendored-plugin-copy`, and it exists **only on
  opencode2**. (source: `tools.arggon.list`, 2026-09-22)

### Repository state (public today)

- Public since 2026-09-03, owned by a **user account** (not an org), 0 stars,
  0 forks, 1 collaborator, issues enabled but unused (tracker is in-tree),
  Pages/wiki/discussions off, no Actions secrets, environments, webhooks or
  deploy keys. (source: GitHub REST API `repos/Arggon/ArggonManager`,
  `actions/secrets`, `environments`, `hooks`, `keys`, 2026-09-22)
- `main` is protected: required `cli` status check (strict/up-to-date), linear
  history, conversation resolution, no force pushes, no deletions; admins are
  not enforced. `opencode2` is unprotected. (source: branch protection API,
  2026-09-22)
- Dependabot security updates enabled; **secret scanning and push protection
  disabled**. (source: repo `security_and_analysis`, 2026-09-22)
- Both packages are published publicly on npm since 0.4.0: `arggon-manager@0.4.0`
  and `@arggondev/lib@0.4.0`, MIT, **no `repository` field and no provenance
  attestations**; publishing is manual (release runbook). (source:
  registry.npmjs.org, 2026-09-22)

### Actions cost and runner size

- Public repos: standard GitHub-hosted runners are **free and unlimited**, and
  `ubuntu-latest` is **4 vCPU / 16 GB**. (source:
  <https://docs.github.com/en/actions/reference/runners/github-hosted-runners>,
  <https://docs.github.com/en/billing/concepts/product-billing/github-actions>,
  2026-09-22)
- Private repos: `ubuntu-latest` is **2 vCPU / 8 GB**, usage consumes the plan
  quota (Free 2,000 min/month, Pro 3,000) and overage is billed at
  **$0.006/min** for Linux 2-core, with each job rounded up to the whole minute;
  the quota is account-wide across all private repos. (source:
  <https://docs.github.com/en/billing/reference/actions-runner-pricing>,
  <https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job>,
  2026-09-22)
- Measured burn on this repo: **1,489 runs / 2,782 wall-minutes in 18.2 days**
  (CI 1,107 runs / 2,484 min; auto-done 266 / 219; arggon 114 / 77) ≈ 150
  min/day → **~4.6k–5.9k billable minutes/month** after per-job rounding,
  i.e. ~$16–23/month over the Free allowance, plausibly **$25–50/month** once
  2-core runners slow the suites. (source: Actions runs API pagination,
  2026-09-22)
- Since 2026-03-01 self-hosted runners on private repos also consume the quota
  and carry the $0.002/min platform charge, so "move CI to self-hosted" is not
  a free escape on private. Public-repo usage remains free. (source:
  <https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/>,
  2026-09-22)

### Governance and security features differ by visibility

- **Protected branches and rulesets are Pro+ features for private repos**;
  public repos get them on Free. On Free, going private would stop enforcing
  main's required `cli` check, strict up-to-date, linear history and
  conversation resolution — the `auto-done` workflow's race-recovery design
  assumes them. (source:
  <https://docs.github.com/en/get-started/learning-about-github/githubs-plans>,
  <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets>,
  2026-09-22)
- Secret scanning/push protection are free for public repositories and require
  GitHub Secret Protection on private ones (currently disabled either way).
  Artifact attestations are public-only on Free/Pro/Team. (source:
  <https://docs.github.com/en/code-security/getting-started/github-security-features>,
  2026-09-22)
- **npm provenance is not supported from private repositories**, even for public
  packages — a use-it-or-lose-it capability while public. (source:
  <https://docs.npmjs.com/trusted-publishers/>, 2026-09-22)

### What private would and would not protect

- Already distributed: the npm tarballs contain `dist/`, `templates/`,
  `skills/` and `opencode/` (MIT), and 19 days of public git history may be
  mirrored/crawled. MIT rights already granted cannot be retracted; private
  only protects **future** source and the tracker. (source: `package.json`
  `files`, registry tarballs, 2026-09-22)
- The tracker is **not** shipped in npm tarballs — it is the only genuinely
  private-worthy surface, and it currently contains machine paths
  (`/home/arggon/...`), session IDs and internal handoffs in public items.
  (source: `git grep /home/arggon`, 2026-09-22)
- Adopter breakage risk: the generated CI recipe
  (`.github/workflows/arggon.yml`, template
  `templates/docs/github/workflows/arggon.yml`) runs an **unauthenticated**
  `git clone https://github.com/Arggon/ArggonManager.git`; `arggon init`
  vendors it to every adopter. Private would break this repo's job and every
  adopter that committed the seam until the recipe installs the published npm
  package (`task-ci-recipe-published-one-liner`). (source: workflow files,
  2026-09-22)

## Recommendation

1. **Land the readiness fixes regardless of the visibility decision**:
   `task-ci-recipe-published-one-liner` (adopters stop depending on a public
   clone), `task-retire-opencode2` (main is canonical; the branch is a
   pre-release artifact), and `bug-docs-retired-opencode2-split` (docs match
   reality).
2. **Stay public unless hiding the tracker/roadmap is worth the cost.** The code
   is already public and MIT; going private costs ~$16–50/month in Actions
   (plus Pro if main's protection must survive), loses free secret scanning and
   npm provenance, halves runner size, and removes the public contribution and
   discovery surface. With 0 stars/forks today the community loss is small, but
   the security/supply-chain loss is real and the source cannot be re-hidden.
3. **If private is chosen**, do it in this order: land (1) first; decide
   Pro vs Free (protection) and the Actions budget; enable secret scanning +
   push protection while public (free); decide npm metadata and provenance
   while public; then flip visibility. Track it in `task-repo-visibility-decision`.

## Decision

Pending — tracked in `task-repo-visibility-decision` (record as an ADR or an
item comment when made). Branch retirement and CI-recipe follow-ups are filed
and linked above.
