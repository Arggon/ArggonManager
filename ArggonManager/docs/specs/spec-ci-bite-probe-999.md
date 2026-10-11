---
spec_id: ci-bite-probe-999
title: "CI bite probe: happy-path-only spec (throwaway)"
status: proposed
created: 2026-10-11
---

# Spec: CI bite probe (throwaway)

Throwaway fixture for the negative control that proves the new `cli` job step
blocks. It is written to describe only the happy path, so `spec analyze`
reports a fresh finding against the committed repo-root baseline. Not committed
to any tracked branch.

## Context

This probe exists only to demonstrate that a fresh finding reddens the gate.

## Acceptance

- [ ] The happy path returns the expected value.
