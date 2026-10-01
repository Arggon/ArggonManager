---
type: task
status: todo
id: task-greenfield-explore-adr
title: "Record exploration + ADR 0017: greenfield exploration gate"
parent: greenfield-explore
labels: []
created: "2026-10-01"
updated: "2026-10-01"
---
<!--
  Placement (v0): ArggonManager/agent-native/ecosystem-ops/greenfield-explore/task-greenfield-explore-adr.md
  Leaves live only under a story. id is the filename stem: task-greenfield-explore-adr.
  CLI `arggon create task greenfield-explore-adr` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Record exploration + ADR 0017: greenfield exploration gate

## Context

This is a methodology change (see the scope note in
`exploration-methodology-improvements-014.md`), so it needs the paper trail:
an exploration doc recording the decision, then an ADR. The decision itself was
made by the coordinator after analyzing the three inspiration skills and the
current carriers; your job is to transcribe it faithfully into the repo's own
pipeline format (exploration → ADR), not to re-litigate it.

**Design to record (the contract task-greenfield-explore-carriers implements — keep both consistent):**

Candidates:

- **C1 — Adopt the synthesized Greenfield Exploration Protocol** (new skill
  reference `references/exploration.md` + command/template updates + ADR) —
  recommended.
- **C2 — Minimal pointers-only**: a paragraph in
  `skills/arggon-cli/references/methodology.md`, no new reference file.
- **C3 — Kernel-enforced gate**: the CLI refuses to claim an implementation
  task on a greenfield story until a linked spec passes `spec analyze`.

Criteria (mirror exploration-014): enforceability, anti-theater, context cost
(ADR 0006), adopter blast radius (ADR 0011/0016), effort/risk.

Findings:

- **F1** — the current exploration methodology is a stack-spike record only:
  `arggon stack explore` scaffolds candidates/criteria/findings/recommendation
  (`templates/exploration.md`), and `/arggon-explore` is per-topic
  (source: `templates/exploration.md`, `.opencode/commands/arggon-explore.md`, 2026-10-01).
- **F2** — no greenfield kickoff phase exists: the methodology work table
  routes a "non-trivial feature" straight to spec/plan; a NEW project has no
  existing flow to read, so there is nothing to ground the spec in, and edge
  cases surface during implementation as bugs (source:
  `skills/arggon-cli/references/methodology.md`, 2026-10-01).
- **F3** — the three inspirations are complementary, not competing:
  stance + grounding + explicit capture (openspec-explore), classification +
  hard gates + approaches + self-review (superpowers brainstorming),
  frontier-round interrogation + ungrillable→prototype (grill-me). A synthesis
  covers what none covers alone: a default think-first phase that ends with
  edge cases already solved on paper (sources: the three skill files,
  accessed 2026-10-01).
- **F4** — the repo already automates the mechanical part of the grill:
  `arggon spec analyze` scans for vague quantifiers, TODO/TBD markers, missing
  error paths and untestable acceptance criteria (source:
  `ArggonManager/docs/agents.md` §Specs and plans, 2026-10-01) — so the
  protocol can stay docs-only (C3's kernel gate is not needed to be
  enforceable-in-practice today).
- **F5** — prior decisions constrain the shape: ADR 0006 (context budgets →
  the detail lives in a lean reference file, progressive disclosure),
  exploration-014 C5 (agents.md must stay lean → pointer only), ADR 0011
  (methodology is the contract → behavioral impact class), ADR 0016 (adopter
  upgrade channel).

Recommendation: **C1**. C3 rejected for now (anti-theater + kernel cost;
revisit only if the social gate proves leaky — same posture as
exploration-014's treatment of blocking gates). C2 rejected (the protocol is
too large for a paragraph and too load-bearing to bury in an existing file).

**The six-phase protocol to record (the ADR's Decision substance):**

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

## Acceptance

- [ ] `ArggonManager/docs/explorations/exploration-greenfield-exploration-015.md` (use the next free number; `exploration_id: greenfield-exploration-015`) records C1/C2/C3, the criteria, F1–F5 with dated sources (the three GitHub skill paths + the repo files, accessed 2026-10-01), the recommendation (C1), and the six-phase protocol as the proposed methodology.
- [ ] The exploration doc follows the existing exploration doc structure (frontmatter `exploration_id`/`title`/`status: open`, Candidates/Criteria/Findings/Recommendation/Decision sections — see `exploration-methodology-improvements-014.md` as the quality bar).
- [ ] `ArggonManager/docs/adr/0017-greenfield-exploration-gate.md` (verify the next free 4-digit id under `docs/adr/` first): Context / Decision / Consequences / Alternatives considered, per `docs/engineering.md` §ADR process; Decision states the protocol is the **default first phase for greenfield work** and the hard gate (no implementation task claimed before an approved spec with a clean `spec analyze`).
- [ ] The exploration's Decision section links the ADR (placeholder while Proposed is fine; link format as in other explorations).
- [ ] `npm run arggon -- validate` ok; no files touched outside `docs/explorations/` and `docs/adr/`.

## Notes

PR references this item id. Never flip this item done yourself — the
coordinator flips after merge verification.

### 2026-10-01 @Arggon
Change recorded on branch feat/task-greenfield-explore-adr (commit 8e59da92), PR Arggon/ArggonManager#519 (draft).

Evidence:
- Files created: ArggonManager/docs/explorations/exploration-greenfield-exploration-015.md (exploration_id: greenfield-exploration-015, status: open, created 2026-10-01) and ArggonManager/docs/adr/0017-greenfield-exploration-gate.md (Status: Proposed, Date: 2026-10-01). Only other edit: this item's acceptance checkboxes + notes.
- Numbering verified before writing: docs/adr/ max was 0016 (0017 free); docs/explorations/ max was 014 (015 free).
- `npm run arggon -- validate --json` → ok:true, 0 errors, 0 warnings (ran before staging and again via the pre-commit gate).
- Content check vs design brief: C1/C2/C3, five criteria, F1–F5 with dated sources (three GitHub skill paths — Fission-AI/OpenSpec skills/openspec-explore/SKILL.md, obra/superpowers skills/brainstorming/, mattpocock/skills skills/productivity/grill-me/ — plus templates/exploration.md, .opencode/commands/arggon-explore.md, skills/arggon-cli/references/methodology.md, docs/agents.md §Specs and plans, accessed 2026-10-01), recommendation C1, six-phase protocol (0–5) all transcribed; ADR Decision states default-first-phase for greenfield (new project / subsystem / interface others depend on), one-way ratchet, and the hard gate verbatim from the brief (spec exists + `arggon spec analyze` reports no NEW findings).
- Wording nuance for the reviewer: the acceptance checklist paraphrases the gate as "an approved spec"; the item body protocol and the coordinator's step 4 say "a spec exists and `arggon spec analyze` reports no NEW findings" — the docs use the latter (more precise) phrasing.
