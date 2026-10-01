---
plan_id: worktree-env-contract-015
title: Plan for Worktree environment contract
spec: ArggonManager/docs/specs/spec-worktree-env-contract-015.md
status: proposed
created: 2026-10-01
---

# Plan: Worktree environment contract (worktree-env-contract-015)

Derived from `ArggonManager/docs/specs/spec-worktree-env-contract-015.md`. Each task carries a
verifiable acceptance criterion and links back to the spec.

## Tasks

### T1: Kernel — env contract in `prepareWorktreeDependencies`

- Extend `lib/src/worktree.ts` dependency preparation: write `.arggon.env`
  (never-overwrite), seed `.env` copy-if-absent, `mkdir -p` the two
  suffixed dirs, probe `git check-ignore` read-only; return the bounded
  `env` receipt fragment. Opt-out key `x-worktree.env` parsed in
  `lib/src/convention.ts`.
- Every failure mode is best-effort: collect a warning, never throw into
  the claim path.
- **Acceptance:** unit tests cover: keys+shape on fresh start, attach
  byte-identical, `.env` seed only-if-absent, dirs exist, disabled flag,
  warning-on-failure; the kernel keeps no CLI imports.

### T2: Surfaces — CLI and native receipt parity

- CLI `start --worktree --json` includes `preparation.env` (additive);
  native `tools.arggon.start` preparation receipt carries the same fragment.
- Rebuild the plugin bundle (`npm run build:plugin`), gate with
  `npm run check:plugin`.
- **Acceptance:** `cli/src/mcp-parity.test.ts` and `skill-copy.test.ts`
  green unchanged; `--json` envelope shows `preparation.env` on a fixture
  run (probe evidence in the PR).

### T3: Docs and init template (same PR as T1/T2 per the docs-maintenance rule)

- `README.md` worktree section: the contract, the six keys, the
  ephemeral-port/identifier convention (one short subsection).
- `ArggonManager/docs/json-output.md`: `preparation.env` payload.
- `ArggonManager/docs/agents.md` §4: one paragraph pointing adopters at the
  contract; `ArggonManager/docs/convention.md`: `x-worktree.env` key.
- init `.gitignore` template gains `.arggon.env` (provenance/test update).
- Impact class **Behavioral** stated in the PR (ADR 0016) — agents re-learn
  a new receipt field and a new convention key; skill copies byte-equal.
- **Acceptance:** doc grep — every statement about the new field/key matches
  the implemented behavior; init test green; `arggon validate` ok.

### T4: Smoke — `smoke:native-start-cold` env leg

- Extend the model-free cold-start smoke: assert `.arggon.env` written with
  the six keys, absent from the claim commit, and byte-identical on attach.
- **Acceptance:** the smoke passes beside anything (offline, no provider),
  and fails if a future change starts committing or overwriting env files.
