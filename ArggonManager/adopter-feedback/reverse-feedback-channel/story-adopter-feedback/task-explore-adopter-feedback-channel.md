---
type: task
status: todo
id: task-explore-adopter-feedback-channel
title: "Exploration: reverse feedback channel from adopter repos (friction capture, dedupe, human-gated publish)"
parent: story-adopter-feedback
labels: [methodology, adopters]
priority: p1
created: "2026-10-02"
updated: "2026-10-02"
---
<!--
  Placement (v0): ArggonManager/adopter-feedback/reverse-feedback-channel/story-adopter-feedback/task-explore-adopter-feedback-channel.md
  Leaves live only under a story. id is the filename stem: task-explore-adopter-feedback-channel.
  CLI `arggon create task explore-adopter-feedback-channel` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Exploration: reverse feedback channel from adopter repos (friction capture, dedupe, human-gated publish)

## Context

<!-- Why this task exists. -->

## Acceptance

<!-- The real acceptance criteria; tick each box when met. -->

## Notes

### 2026-10-02 @ses_f031e92afffeGv1n1RTkEsHjpb
**PR #586** — exploration + container chain + the CONTRIBUTING bug. Impact class: **advisory** (no methodology carrier touched; the carrier change lands with the ADR/spec).

Phase 0–5 complete. Summary of the verdict on the original proposal:

**Refuted — "instruct agents to open a GitHub issue":** the evidence is a named incident, not taste. `deftai/directive#3633` (2026-08-23) shipped a skill documented as *"the sanctioned route for a consumer agent to escalate a framework gap upstream"*, and it was missed **by an agent that was actively escalating and following the rule that pointed at it** (policy flag off by default, skill absent from the host inventory, `REFERENCES.md` never deposited). The friction was *"absorbed into the session"* — silent loss, which is worse than no channel because it looks like success. Three corroborating findings: it fights `docs/agents.md` §0 (the first section agents read); `claude-code#93077` shows cross-repo instruction precedence is unreliable; and the output shape is actively auto-closed by peers (OpenCode's `duplicate-issues.yml` rejects "AI-generated walls of text"; claude-code carries a 27.6% duplicate rate).

**Kept and improved — the instinct was right, only the writer of the issue was wrong.** Three projects converged (2026-07→09) on local capture → redact-before-exit → dedupe → human consent gate → publish (`ce-ai#426` shipped, `ContextDesk#325` shipped, `subfloor#543` declined-but-published). Their tiered output dissolves the auth objection *and* the doctrine conflict: tier B is a **prefilled `issues/new?title=…&body=…` URL** — no `gh`, no auth, **a human clicks submit**. The agent never opens an issue, so §0 is never violated and one canonical record survives. Sentry's fingerprint rules then constrain the dedupe key: never derive it from the narrative (an LLM-authored value is exactly the "frequently changing" case that produces bad groups).

**Correction to my own earlier framing:** I first called the privacy objection "concrete, precedent-backed". The research supports *structural* soundness (redact before render; whitelist capture) but found **no incident** of an adopter leaking paths into a maintainer's tracker via this trigger. PixelLeak is the same failure *shape* — no sanctioned channel, so the agent chose public — but a different cause. The exploration records that downgrade explicitly rather than keeping the stronger claim.

**Recommended, not decided:** `arggon friction` → local bounded log outside the tracker → stable-fields-only fingerprint → redacted report → human-gated tiered publish, in four independently shippable stages. Stage 1 needs no adopter opt-in and attacks this repo's 10 known duplicate items directly.

Gates green: `validate` ok (0 warnings, v5); `spec validate` ok (30 docs); `spec analyze` no new finding; prettier clean; placeholder scan clean.

Next per the ADR 0017 gate: an ADR (settling the carrier change's behavioral impact class, opt-out semantics, and the explicit non-goal of automatic publication), then the spec carrying the 13 hunted edge-case dimensions as acceptance criteria. No implementation task claimed before `spec analyze` reports no NEW findings.
