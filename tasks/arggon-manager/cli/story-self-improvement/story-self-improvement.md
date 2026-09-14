---
type: story
status: todo
id: story-self-improvement
title: "Self-improvement loop: adversarial lab, audit protocol, telemetry mining"
parent: cli
labels: []
created: "2026-09-14"
updated: "2026-09-14"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-self-improvement/story-self-improvement.md (story index; required).
  parent MUST be the epic id. Optional style prefixes (e.g. story-) are not type discriminators.
-->

# Self-improvement loop: adversarial lab, audit protocol, telemetry mining

## Context

Five adoption experiments (cv, cuentas-claras, guardian, suizo, racha) + estanteria (MCP-first) proved the finding-source is NOT the side-project app (contributed zero findings) but the adversarial scenarios, adoption/upgrade flows, and doc-vs-behavior conformance. Building throwaway apps is the slow part. Research (2026-09-14: Anthropic evals loop, Arize closing-the-loop, agentic-patterns dogfooding, continuous red-teaming) converges on a standing loop: adversarial evals suite + audit agent protocol + telemetry mining of real usage. This story institutionalizes that loop inside ArggonManager.

## Acceptance

- [ ] The experiment scenarios live as a permanent lab suite (CI-runnable); the audit protocol and telemetry mining are documented with first runs executed; findings flow through the tracker as always
