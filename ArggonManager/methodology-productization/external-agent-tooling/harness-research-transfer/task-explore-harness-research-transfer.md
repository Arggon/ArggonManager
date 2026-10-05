---
type: task
status: todo
id: task-explore-harness-research-transfer
title: "Spike: what do the AutoHarness / AutoContext / AutoCompact papers change for ArggonManager? (corrects exploration-020's candidate set)"
parent: harness-research-transfer
labels: [methodology, exploration, research]
priority: p2
created: "2026-10-05"
updated: "2026-10-05"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-explore-harness-research-transfer.md
  Leaves live only under a story. id is the filename stem: task-explore-harness-research-transfer.
  CLI `arggon create task explore-harness-research-transfer` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Spike: what do the AutoHarness / AutoContext / AutoCompact papers change for ArggonManager? (corrects exploration-020's candidate set)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K
## Context

**This item corrects the premise of exploration-020 / ADR 0022.** The product owner supplied
the three papers on 2026-10-05:

- **AutoHarness** — arXiv:2603.03329v1 (2026-02-10), Lou, Lázaro-Gredilla, Dedieu,
  Wendelken, **Lehrach**, **Murphy** — *"improving LLM agents by automatically synthesizing a
  code harness"*
- **AutoContext** — arXiv:2510.02369v3 (2025-09-29), Cai, Liu, Yang, Niu, Xiao, Chen —
  *"Instance-Level Context Learning for LLM Agents"*
- **AutoCompact** — arXiv:2610.02163v1 (2026-10-01), Zhang, Zheng, Du, An, Dong — *"Learning
  When to Compact Context in Long-Horizon Coding Agents"*

Exploration-020 evaluated **npm packages that happen to share those names** and concluded
"there is no such stack" — which was true of the registry and **wrong about the question**:
these are three peer-reviewed research results, not a vendor stack. The registry names
collide by coincidence; `autoharness@0.0.1` is an unrelated one-day placeholder (re-verified
2026-10-05: still `0.0.1`, still "Reserved", still 8 downloads/month, repo still empty),
and `autoctx` (greyhaven-ai, 1304 stars) is a **different** project from the AutoContext
paper. ADR 0022's *decision* survives (we do not adopt a second loop), but its **evidence**
was about the wrong artifacts and must be superseded, not quietly left standing.

## Acceptance

- [ ] Classified first, with the ratchet recorded
- [ ] Each paper read from source (arXiv HTML), its **method** recorded — not its abstract
- [ ] For each: what it claims, measured on what, and **what it does not claim**
- [ ] Compared against what the methodology **already owns**, naming the specific substrate
      (the kernel's refusal layer, ADR 0006's context budget, the smoke harnesses) — the
      interesting question is where a paper's contribution is *already* ours
- [ ] The honest read on transferability: a research result on games/benchmarks is not a
      spec for our loop, and the record says which of these three could ever be more than an idea
- [ ] Records that exploration-020's candidate set was the **wrong artifacts** and supersedes
      it explicitly — ADR 0022 amended, not left to mislead the next reader
- [ ] One recommendation with trade-offs; follow-ups filed as tracked items
- [ ] `arggon validate` + `spec validate` green; PR opened with the methodology impact class
- [ ] `arggon spec analyze` reports no NEW finding naming this item
