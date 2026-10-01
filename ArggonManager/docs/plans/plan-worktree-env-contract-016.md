---
plan_id: worktree-env-contract-016
title: Plan for Worktree environment contract
spec: ArggonManager/docs/specs/spec-worktree-env-contract-016.md
status: proposed
created: 2026-10-01
---

# Plan: Worktree environment contract (worktree-env-contract-016)

Derived from `ArggonManager/docs/specs/spec-worktree-env-contract-016.md`. Each task carries a
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
  - [x] keys+shape fresh (lib/src/worktree.test.ts, hermetic env/home)
  - [x] attach byte-identical (FS-level `wx`/`COPYFILE_EXCL` guarantee)
  - [x] `.env` seed only-if-absent (three cases)
  - [x] dirs exist (existence, not location)
  - [x] disabled flag (`x-worktree.env: false` → `written:false` + reason)
  - [x] warning-on-failure (uncreatable state base → warning, no throw)
  - [x] kernel keeps no CLI imports (probe is an injected/read-only `git check-ignore`)

### T2: Surfaces — CLI and native receipt parity

- CLI `start --worktree --json` includes `preparation.env` (additive);
  native `tools.arggon.start` preparation receipt carries the same fragment.
- Rebuild the plugin bundle (`npm run build:plugin`), gate with
  `npm run check:plugin`.
- **Acceptance:** `cli/src/mcp-parity.test.ts` and `skill-copy.test.ts`
  green unchanged; `--json` envelope shows `preparation.env` on a fixture
  run (probe evidence in the PR).
  - [x] CLI envelope gains additive `env` (flat, like `gateBins`); parity test green unchanged
  - [x] native receipt forwards bounded `preparation.env` (tools.test.ts assertion)
  - [x] bundle regenerated; `check:plugin` green after the regen commit
  - [x] CLI worktree-suite fixture run asserts the envelope `env` receipt

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
  - [x] README env-contract subsection (+ cleanup reap sentence)
  - [x] json-output `env` row + prose (prettier-stable)
  - [x] agents.md §4 subsection; convention.md `env` bullet; template row
  - [x] init `.gitignore` destination + tests (created-when-missing, adopter-owned kept)

### T4: Smoke — `smoke:native-start-cold` env leg

- Extend the model-free cold-start smoke: assert `.arggon.env` written with
  the six keys, absent from the claim commit, and byte-identical on attach.
- **Acceptance:** the smoke passes beside anything (offline, no provider),
  and fails if a future change starts committing or overwriting env files.
  - [x] four env legs green (written+keys, identity values, dirs+suffix, probe+env-free commit)
  - [x] attach leg byte-identical (receipt `written:false` + warning)
  - [x] smoke green end-to-end (47 checks)
