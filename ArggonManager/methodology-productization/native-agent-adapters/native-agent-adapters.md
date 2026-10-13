---
type: epic
status: todo
id: native-agent-adapters
title: Native agent adapters + methodology carriers as product
parent: methodology-productization
labels: []
created: "2026-10-02"
updated: "2026-10-02"
---

<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/native-agent-adapters.md (epic index; required).
  parent MUST be the initiative id. Container ids must not start with task-/bug-.
-->

# Native agent adapters + methodology carriers as product

## Context

The method should meet each helper where that helper is strongest, without ever
keeping a second copy of a rule. The governing docs plus the command surface
stay the complete method on their own; each supported helper then gets a seam
that uses what that helper does natively — and where a helper cannot express
something, the gap is written down rather than worked around with a private
rule.

The stories divide the surface: the carriers declare the method, setup installs
only the chosen seams, a matrix states per helper what is native and what is a
gap, and one story per helper carries that helper's own expansion. (ADR 0020;
spec-methodology-adapters-017.)

## Acceptance

Complete when every story under it — adapter selection, the capability matrix,
and the per-helper adapter stories — is terminal and the product owner has
recorded acceptance on this epic. Nothing further is checked at this level.

## Notes
