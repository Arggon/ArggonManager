# 0017 Greenfield exploration gate

- Status: Proposed
- Date: 2026-10-01
- Deciders: product owner (Gonzalo), coordinator/architect (Arggon)

## Context

The repo's exploration methodology is a stack-spike record (`arggon stack
explore` → candidates/criteria/findings/recommendation; `/arggon-explore`
per-topic) — built for comparing library/framework candidates, not for
planning a whole new project or subsystem. The methodology work table routes a
"non-trivial feature" straight to spec/plan; a NEW project has no existing
flow to read, so there is nothing to ground the spec in, and edge cases
surface during implementation as bugs instead of before it. Nothing makes
think-first the **default** for greenfield work. Full analysis:
[exploration-greenfield-exploration-015](../explorations/exploration-greenfield-exploration-015.md).

Three external skills model the missing pieces and are complementary, not
competing (all accessed 2026-10-01): Fission-AI/OpenSpec
`skills/openspec-explore` (thinking-not-building stance, ground-in-code before
asking, explicit capture), obra/superpowers `skills/brainstorming` (classify
before the first question, hard gates, 2–3 approaches, self-review) and
mattpocock/skills `skills/productivity/grill-me` (frontier-round
interrogation, ungrillable → prototype). Their synthesis is a default
think-first phase that ends with edge cases already solved on paper.

Prior decisions constrain the shape: context budgets and progressive
disclosure ([ADR 0006](0006-token-context-efficiency.md)) — the protocol's
detail lives in a lean skill reference, not the always-loaded docs;
"methodology is the contract" ([ADR 0011](0011-native-first-architecture.md))
— this is a behavioral change reaching every adopting repo through the ADR 0016
adopter-upgrade channel; and `arggon spec analyze` already automates the
mechanical part of an interrogation (vague quantifiers, TODO/TBD markers,
missing error paths, untestable acceptance criteria).

## Decision

The **Greenfield Exploration Protocol** (phases 0–5) is the **default first
phase for greenfield work**: a new project, a new subsystem, or a new
interface others will depend on — i.e. work with no existing flow to read.
Spikes and bounded changes are exempt; the classification is a one-way
ratchet: complexity discovered mid-flight upgrades the classification, nothing
downgrades.

0. **Classify (gate)** — before any work: spike / bounded / greenfield.
1. **Stance** — thinking, not building: read-only on code; the only permitted
   writes are methodology artifacts (exploration doc, spec, ADR, plan, tracker
   items). If asked to implement, name the handoff instead.
2. **Ground** — inspect repo code, specs, ADRs, playbooks and docs before
   asking any factual question; never ask the user for a fact you can verify.
3. **Frontier rounds** — interview in whole-frontier rounds (each round asks
   every question whose prerequisites are settled), domains in dependency
   order: outcome/users → scope/decomposition → constraints → data →
   interfaces → failure/edge → ops/security → rollout. Ends when the frontier
   is empty: every branch visited, nothing silently assumed. "I don't know"
   routes to a spike/prototype, never a guess. Ballooning rounds = the scope
   is too large: decompose first, then grill each piece.
4. **Edge-case hunt** — an adversarial pass over the settled design, one
   checklist per dimension: input validation & hostile input; empty/loading/
   error states; concurrency & idempotency; failure/retry/timeout;
   authn/authz; limits/quota/perf; time/timezones/locale;
   persistence/migration/rollback; observability/debuggability;
   security/threat model; environment/platform differences; upgrade/data-loss.
   Every hunted case resolves into exactly one of: a spec acceptance
   criterion, an explicit non-goal, or a spike item. Nothing stays "unknown".
5. **Approaches → artifacts + gates** — 2–3 candidate approaches with
   trade-offs and a recommendation (YAGNI ruthlessly; decompose
   multi-subsystem proposals first); then the artifacts: greenfield
   exploration doc (project-exploration variant of the exploration template),
   ADRs for cross-cutting decisions, spec with the hunted edge cases as
   acceptance criteria, plan + tasks with `depends_on`. **Hard gate: no
   implementation task may be claimed before a spec exists and `arggon spec
   analyze` reports no NEW findings** — the scanner is the automated grill.
   Self-review before handoff: placeholder scan, internal consistency, scope
   check, ambiguity check.

The protocol's operational detail is carried by the `arggon-cli` skill
(`references/exploration.md`, wired by `task-greenfield-explore-carriers`);
`docs/agents.md` / `docs/engineering.md` carry pointers only (ADR 0006,
exploration-014 C5).

## Consequences

- Greenfield work front-loads thinking: specs arrive grounded in repo reality,
  with edge cases pre-solved as acceptance criteria, explicit non-goals or
  spikes — "unknown" is no longer an allowed terminal state on paper, and
  edge-case bugs found during implementation should get rarer.
- The hard gate is social (item-claim discipline), not kernel-enforced.
  Accepted for now: `spec analyze` already provides the automated check
  (exploration-015 F4). If the social gate proves leaky, a kernel gate is the
  documented fallback — same posture as exploration-014's treatment of
  blocking gates.
- Behavioral methodology change (ADR 0011): every adopting repo's agents must
  re-learn their default first phase for new work. The change reaches adopters
  through the ADR 0016 upgrade channel; release notes should call it out.
- Cost: one more skill reference file, and one more artifact per greenfield
  project (the project-exploration doc). Accepted: the protocol is gated on
  classification, so spikes and bounded work do not pay it.

## Alternatives considered

- **C2 — Minimal pointers-only** (a paragraph in
  `skills/arggon-cli/references/methodology.md`, no new reference file):
  rejected — the protocol is too large for a paragraph and too load-bearing to
  bury in an existing file; progressive disclosure means a lean on-demand
  reference, not omission.
- **C3 — Kernel-enforced gate** (the CLI refuses to claim an implementation
  task on a greenfield story until a linked spec passes `spec analyze`):
  rejected for now — anti-theater + kernel cost; exploration-015 F4 shows the
  mechanical part is already automated, so the gate is
  enforceable-in-practice socially. Revisit only if the social gate proves
  leaky.
- **Status quo** (non-trivial feature → spec/plan directly): rejected — it is
  the failure mode this ADR exists to prevent (exploration-015 F2: edge cases
  surface during implementation as bugs).
