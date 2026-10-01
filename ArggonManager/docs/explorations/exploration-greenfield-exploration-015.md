---
exploration_id: greenfield-exploration-015
title: Greenfield exploration protocol — think first by default for new projects, subsystems and interfaces
status: open
created: 2026-10-01
---

# Exploration: Greenfield exploration protocol — think first by default (greenfield-exploration-015)

Spike record: compare the candidates below, cite dated sources, and record a
recommendation. The decision itself lands in an ADR
(`ArggonManager/docs/adr/0017-greenfield-exploration-gate.md`) — linked under
Decision. Carrier wiring (skill reference, command/template updates, docs
pointer) is the sibling item `task-greenfield-explore-carriers`; this
exploration and that item implement the same design and must stay consistent.

Scope note: like [exploration-014](exploration-methodology-improvements-014.md),
this is a methodology change — per [ADR 0011](../adr/0011-native-first-architecture.md)
the methodology is the contract, so improvements here change what every
adopter's agents must do. That requires the full paper trail: exploration doc
first, then the ADR.

## Candidates

### C1 — Adopt the synthesized Greenfield Exploration Protocol (recommended)

A new skill reference `references/exploration.md` carrying the six-phase
protocol (classify → stance → ground → frontier rounds → edge-case hunt →
approaches/artifacts/gates; the full protocol is recorded under "The protocol"
below), plus command/template updates, and an ADR that makes think-first the
**default first phase for greenfield work** with a hard gate before any
implementation task is claimed.

### C2 — Minimal pointers-only

A paragraph in `skills/arggon-cli/references/methodology.md` telling agents to
think before building on greenfield work — no new reference file, no phases,
no gate.

### C3 — Kernel-enforced gate

The CLI refuses to claim an implementation task on a greenfield story until a
linked spec exists and passes `arggon spec analyze`. Same family as
exploration-014's C1 done-gate: structural enforcement at kernel cost.

## Criteria

Weighted; highest first (mirroring exploration-014):

1. **Enforceability** — does it turn "think first" from aspirational prose
   into something structural (a default phase with a gate), per engineering.md
   Goal 2 ("make discipline enforceable — not aspirational")?
2. **Anti-theater** — does it prevent a failure that actually occurs (F2:
   greenfield work jumping straight to spec/implementation and meeting its
   edge cases as bugs), adding less friction than the failure costs? Reject
   ritual.
3. **Context cost** — does the agent-facing token bill shrink or grow (ADR
   0006 spirit)? A lean reference file loaded only for greenfield work scores
   better than new always-loaded mandates.
4. **Adopter blast radius** — behavioral methodology changes reach every
   adopting repo through the generated seam (ADR 0011) and its upgrade
   channel (ADR 0016); the smaller and more additive, the better.
5. **Effort/risk** — small, testable, reversible steps; kernel gates need
   fixtures and a waiver path; docs-only first.

## Findings

- **F1 — The exploration methodology is a stack-spike record only.**
  `arggon stack explore` scaffolds candidates → criteria → findings →
  recommendation (`templates/exploration.md`), and `/arggon-explore` is
  per-topic — built for comparing library/framework candidates, not for
  planning a whole new project or subsystem (source:
  `templates/exploration.md`, `.opencode/commands/arggon-explore.md`,
  2026-10-01).
- **F2 — No greenfield kickoff phase exists.** The methodology work table
  routes a "non-trivial feature" straight to spec/plan. A NEW project has no
  existing flow to read, so there is nothing to ground the spec in — and edge
  cases surface during implementation as bugs instead of before it (source:
  `skills/arggon-cli/references/methodology.md`, 2026-10-01).
- **F3 — The three inspirations are complementary, not competing.** Stance +
  grounding + explicit capture (Fission-AI/OpenSpec
  `skills/openspec-explore/SKILL.md`); classification + hard gates + approaches
  + self-review (obra/superpowers `skills/brainstorming/`); frontier-round
  interrogation + ungrillable → prototype (mattpocock/skills
  `skills/productivity/grill-me/`). A synthesis covers what none covers alone:
  a default think-first phase that ends with edge cases already solved on
  paper (sources: the three skill files, accessed 2026-10-01).
- **F4 — The repo already automates the mechanical part of the grill.**
  `arggon spec analyze` scans for vague quantifiers, TODO/TBD markers, missing
  error paths and untestable acceptance criteria (source:
  `ArggonManager/docs/agents.md` §Specs and plans, 2026-10-01) — so the
  protocol can stay docs-only (C3's kernel gate is not needed to be
  enforceable-in-practice today).
- **F5 — Prior decisions constrain the shape (not re-litigated).** Context
  budgets → the detail lives in a lean reference file, progressive disclosure
  ([ADR 0006](../adr/0006-token-context-efficiency.md)); exploration-014 C5 —
  agents.md must stay lean → pointer only
  ([exploration-014](exploration-methodology-improvements-014.md)); methodology
  is the contract → behavioral impact class
  ([ADR 0011](../adr/0011-native-first-architecture.md)); adopter upgrade
  channel ([ADR 0016](../adr/0016-adopter-upgrade-channel.md)) (source:
  `docs/adr/`, `docs/explorations/`, 2026-10-01).

## Recommendation

**C1.**

- **C3 rejected for now** — anti-theater + kernel cost: F4 shows the
  enforceable-in-practice part (vague-quantifier / TODO-marker / error-path /
  acceptance-criteria scanning) already exists as `spec analyze`, so the hard
  gate can stay social today. Same posture as exploration-014's treatment of
  blocking gates: revisit only if the social gate proves leaky.
- **C2 rejected** — the protocol is too large for a paragraph and too
  load-bearing to bury in an existing file; progressive disclosure (criterion
  3) means a lean on-demand reference, not omission, and a structural default
  (criterion 1) is not served by aspiration-only prose.

## The protocol (what C1 adopts)

Phases 0–5. Phase 0 is the gate that makes the protocol a default; phase 5 is
the gate that makes it binding.

0. **Classify (gate)** — before any work: spike / bounded / greenfield.
   Greenfield = a new project, subsystem, or interface others will depend on
   (there is no existing flow to read — brainstorming's red-flag rule). The
   ratchet is one-way: complexity discovered mid-flight upgrades the
   classification, nothing downgrades.
1. **Stance** — thinking, not building: read-only on code; the only permitted
   writes are methodology artifacts (exploration doc, spec, ADR, plan, tracker
   items). If asked to implement, name the handoff instead.
2. **Ground** — inspect repo code, specs, ADRs, playbooks and docs before
   asking any factual question; never ask the user for a fact you can verify.
3. **Frontier rounds** — interview in whole-frontier rounds (grill-me
   semantics: each round asks every question whose prerequisites are settled),
   domains in dependency order: outcome/users → scope/decomposition →
   constraints → data → interfaces → failure/edge → ops/security → rollout.
   Ends when the frontier is empty: every branch visited, nothing silently
   assumed. "I don't know" routes to a spike/prototype, never a guess.
   Ballooning rounds = the scope is too large: decompose first, then grill
   each piece.
4. **Edge-case hunt** — an adversarial pass over the settled design, one
   checklist per dimension: input validation & hostile input; empty/loading/
   error states; concurrency & idempotency; failure/retry/timeout;
   authn/authz; limits/quota/perf; time/timezones/locale;
   persistence/migration/rollback; observability/debuggability;
   security/threat model; environment/platform differences; upgrade/data-loss.
   Every hunted case resolves into exactly one of: a spec acceptance
   criterion, an explicit non-goal, or a spike item. Nothing stays "unknown" —
   this is the mechanism that solves edge cases before they arrive.
5. **Approaches → artifacts + gates** — 2–3 candidate approaches with
   trade-offs and a recommendation (YAGNI ruthlessly; decompose
   multi-subsystem proposals first); then the artifacts: greenfield
   exploration doc (project-exploration variant of the exploration template),
   ADRs for cross-cutting decisions, spec with the hunted edge cases as
   acceptance criteria, plan + tasks with `depends_on`. **Hard gate**: no
   implementation task may be claimed before the spec exists and
   `arggon spec analyze` reports no NEW findings — the scanner is the
   automated grill. Self-review before handoff: placeholder scan, internal
   consistency, scope check, ambiguity check.

## Decision

Adopted — **C1**, recorded as [ADR 0017 — Greenfield exploration gate](../adr/0017-greenfield-exploration-gate.md)
(Proposed; becomes Accepted at PR merge). The Greenfield Exploration Protocol
(phases 0–5 above) becomes the **default first phase for greenfield work** — a
new project, subsystem, or interface others will depend on — with the hard
gate: no implementation task may be claimed before a spec exists and
`arggon spec analyze` reports no NEW findings. Carrier wiring (skill reference
`references/exploration.md`, command/template updates, docs pointer) lands via
`task-greenfield-explore-carriers` under the ADR 0011 behavioral impact class
and the ADR 0016 adopter-upgrade channel.
