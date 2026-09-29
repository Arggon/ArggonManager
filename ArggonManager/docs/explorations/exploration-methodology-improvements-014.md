---
exploration_id: methodology-improvements-014
title: Methodology improvements: enforcing the aspirational bars and closing the pipeline loops
status: open
created: 2026-09-29
---

# Exploration: Methodology improvements: enforcing the aspirational bars and closing the pipeline loops (methodology-improvements-014)

Spike record: compare the candidates below, cite dated sources, and record a
recommendation. The decision itself lands in an ADR (`ArggonManager/docs/adr/`) — link it
under Decision. A technology playbook (`arggon playbook new`) is generated
after the decision.

Scope note: "the methodology" is the work loop and its paperwork — the
find → claim → work → PR loop, the spec/plan/ADR/exploration/playbook/runbook
pipeline, the review bar, and the docs that carry them (`ArggonManager/docs/agents.md`,
`docs/engineering.md`, `docs/convention.md`, the bundled `arggon-cli` skill and
its `references/`). Per [ADR 0011](../adr/0011-native-first-architecture.md) the
methodology is the contract, so improvements here change what every adopter's
agents must do — that raises the bar for proposing them, and is exactly why they
should be explored explicitly instead of accreting silently.

## Candidates

### C1 — Done gate: enforce acceptance-checklist completeness on the terminal flip

`arggon update <id> --status done` currently accepts the flip regardless of
unchecked acceptance checkboxes in the item body; the rule "done = acceptance
checklist complete (or explicitly waived in Notes)" is prose only. Add a kernel
check on the terminal transition for claimable types: refuse when
`acceptanceComplete(body)` is false unless the caller passes an explicit waiver
flag recording a reason (mirroring the existing cascade awareness, which already
computes the same predicate). The auto-done workflow keeps its current limits —
it would simply inherit an honest refusal instead of flipping silently.

### C2 — Structured review verdicts

The review bar requires verdicts and smoke evidence to land on the item via
`arggon comment` (never as GitHub PR comments), but a verdict is free-form
prose: nothing distinguishes an approval from a change request, and nothing
checks that a passing verdict exists before a PR merges. Define a minimal,
human-written verdict convention — a bounded header line
(`verdict: approve | request-changes`, item id, reviewer) followed by the
evidence list — as a comment convention (not frontmatter), plus a report-only
checker first (CI or `arggon doctor`) that flags PRs whose referenced item has
change-request verdicts newer than the last approval. A blocking gate is a
possible second step, only if the report-only linter proves low-noise.

### C3 — Decision-pipeline gap detector

The explore → ADR → playbook pipeline leaks: decisions stay pending after the
exploration recommends them. Extend the existing report-only consistency
scanner (`arggon spec analyze`) to flag: (a) explorations whose Decision section
still names an unwritten/placeholder ADR after N days, (b) ADRs stuck in
`Proposed` beyond N days, (c) specs left `proposed` after every task of their
linked plan is terminal. Report-only, never edits — the same contract as
`spec analyze` today.

### C4 — Methodology change protocol

There is no defined process for changing the methodology itself: a PR editing
`agents.md`/`engineering.md`/`SKILL.md`/`references/` carries no impact
classification, no adopter-facing version note, and no check that the
adopter-upgrade story was considered. Define a lightweight protocol: any PR
touching the methodology carriers must state (in the PR and as an item comment)
the impact class — advisory vs behavioral (agents must re-learn something) —
and behavioral changes must reference the adopter-upgrade channel decision.
This candidate depends on first filling the adopter-upgrade-channel ADR that
[exploration-007](exploration-adopter-upgrade-experience-007.md) left as a
placeholder (see F3).

### C5 — Context-budget discipline for the methodology carriers themselves

ADR 0006 set a context budget for the JSON/envelope surfaces and
`arggon doctor --budget` measures the adopter-facing generated docs, but the
repo's own methodology carriers have no budget and have grown dense
mega-paragraphs (see F4). Restructure the worst offenders into bounded
subsections/tables, and consider a soft doc-size budget (warnings via
`doctor`) for `agents.md`, `engineering.md`, `SKILL.md` and the skill
references. Incremental edits in the PRs that touch those sections — no
big-bang rewrite.

## Criteria

Weighted; highest first.

1. **Enforceability** — does it turn a stated bar into something structural
   (kernel gate, CI check, report-only scanner), per engineering.md Goal 2
   ("make discipline enforceable — not aspirational")?
2. **Anti-theater** — does it prevent a failure that actually occurred (F1–F4),
   adding less friction than the failure costs? Reject ritual.
3. **Context cost** — does the agent-facing token bill shrink or grow (ADR 0006
   spirit)? Report-only scanners and doc restructuring score better than new
   mandatory artifacts.
4. **Adopter blast radius** — behavioral methodology changes reach every
   adopting repo through the generated seam; the smaller and more additive,
   the better (ADR 0011 contract care).
5. **Effort/risk** — small, testable, reversible steps; kernel gates need
   fixtures and a waiver path; report-only first.

## Findings

- **F1 — The done gate is real, not hypothetical.** Acceptance-awareness exists
  only in the container cascade: `acceptanceComplete` gates ancestor
  auto-completion (`lib/src/update.ts:916`), but the claimable item's own
  `→ done` flip is not checked, and the auto-done workflow explicitly "never
  edits acceptance checklists" (`ArggonManager/docs/agents.md` §5) — so an item
  can reach `done` with an unchecked checklist via a plain update or a merged
  PR (source: `lib/src/update.ts`, repo, 2026-09-29).
- **F2 — Verdicts are unstructured.** The review bar requires probe evidence
  "in the review verdict" and that only a passing review merges
  (`ArggonManager/docs/engineering.md` §Review bar), but no schema, parser or
  check for verdict comments exists anywhere in `cli/src` or `lib/src` — the
  bar is social, enforced by the coordinator's diligence (source: repo grep +
  `docs/engineering.md`, 2026-09-29).
- **F3 — The decision pipeline demonstrably leaks.** Three instances in the
  repo today: exploration-adopter-upgrade-experience-007 recommends an ADR
  whose placeholder (`0009-adopter-upgrade-channel`) was never written;
  exploration-open-source-agent-tooling-013 ends in a pending decision gate
  after a successful pilot; and ADRs 0002, 0003 and 0004 remain `Proposed`
  indefinitely (0003/0004's milestone model was effectively superseded by
  convention v4/v5 without a superseding ADR) (source: `docs/adr/` frontmatter
  + explorations 007/013, 2026-09-29).
- **F4 — The methodology carriers are heavy and getting denser.**
  `docs/agents.md` is 374 lines; §4 (branch/worktree) carries a single
  paragraph of roughly 700 words describing the start/link-farm contract, and
  §0's merge/squash bullet is similarly dense — real cost, since every agent
  session in every adopting repo loads this file (source: `wc -l` +
  `docs/agents.md`, 2026-09-29).
- **F5 — Prior decisions constrain this exploration (not re-litigated).** Token
  budgets and progressive disclosure: ADR 0006. Smoke gate and verdict-on-item:
  ADR 0008. "Methodology is the contract, only mechanics go native": ADR 0011.
  Ranked backlog and standing rejected-list: exploration-002. Agent tooling
  lane (worktree readiness P1, ast-grep/fast-check, rejected shell-tasks):
  exploration-013 (source: `docs/adr/`, `docs/explorations/`, 2026-09-29).

## Recommendation

Adopt in this order:

1. **C3 now** — wins on criteria 1+3+5: report-only, small, and it closes a
   leak with three live instances (F3). Land as a `spec analyze` extension
   behind its own spec; it also generates the cleanup work (fill or supersede
   the stale ADRs) as findings, not as scope creep.
2. **C1 next** — highest enforceability-per-line: the predicate already exists
   in the kernel; add the terminal-flip check, a `--waive "<reason>"` escape
   hatch, fixtures, and parity with the auto-done workflow. Kernel/contract
   change → ADR before implementing.
3. **C5 continuously** — restructure dense sections opportunistically in PRs
   already touching them; add a soft `doctor` warning only if restructuring
   alone stalls. No big-bang rewrite: doc churn is its own context cost.
4. **C2 as a report-only linter first** — the anti-theater risk is real (F2
   shows diligence currently works); promote to a blocking gate only with
   evidence the linter is low-noise.
5. **C4 blocked on its prerequisite** — fill the adopter-upgrade-channel ADR
   first (C3 will surface it); the protocol then falls out of that decision.

Rejected: a mandatory methodology-version stamp on every methodology PR
(theater without a failure), and any blocking merge gate that parses prose
verdicts before the linter proves itself (criterion 2).

## Decision

<!-- ADR reference placeholder: ArggonManager/docs/adr/0000-<slug>.md once the ADR lands. -->

- C1 needs an ADR (kernel/contract change: terminal-transition gate + waiver
  semantics); C3 needs a spec (`spec-spec-analyze` follow-up); C2/C5 start
  report-only and need no ADR yet; C4 waits on the adopter-upgrade-channel ADR.
