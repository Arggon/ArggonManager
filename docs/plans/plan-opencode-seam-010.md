---
plan_id: opencode-seam-010
title: Plan for Generated OpenCode seam (config, agents, commands)
spec: docs/specs/spec-opencode-seam-010.md
status: implemented
created: 2026-09-18
---

# Plan: Generated OpenCode seam (config, agents, commands) (opencode-seam-010)

Derived from `docs/specs/spec-opencode-seam-010.md`. Each task carries a
verifiable acceptance criterion and links back to the spec.

## T1: Templates

- Write the ten tier-1 templates under `templates/docs/`: `opencode.jsonc` and
  `opencode/{agents,commands}/*.md` with the content defined in the spec
  Synopsis.
- **Acceptance:** templates exist, JSONC parses, Markdown starts with `---`,
  no template restates kernel rules (I5) — checked in review.

## T2: Generator changes

- In `cli/src/docs.ts`: prefix path mapping for `opencode/`, the
  `opencode.jsonc` destination entry, `isJsonDestination` (`.json`/`.jsonc`
  marker skip), frontmatter marker insertion for `.opencode/**.md`, a shared
  `stampGeneratedContent` used by both `planGenerateDocs` and
  `renderGeneratedDoc`, `findOpenCodeConfig` + the `present-skip` decision, and
  the `skipped[]` inclusion.
- **Acceptance:** `init --propose` (dry-run plan) reports the same buckets a
  real run produces; `present-skip` appears only when an adopter config exists;
  no behavior change for existing destinations (existing tests untouched except
  derived counts).

## T3: Tests

- New `cli/src/init-opencode.test.ts`: creation of every destination on a fresh
  init; JSONC validity + marker absence; YAML marker + frontmatter-first;
  conditional skip for all four adopter-config shapes; provenance round-trip
  (modified → skip, `--backup` → archive+regenerate).
- Update `cli/src/init-docs.test.ts` to derive its counts (replace the
  hardcoded 12 with the derived tier-1+skills expression) instead of pinning a
  magic number.
- **Acceptance:** focused suite green; full `vitest run` green.

## T4: Docs

- `docs/agents.md` §Reference integrations: list the OpenCode seam as part of
  what `init` generates and what it means for OpenCode users; README init notes
  if they enumerate the generated set.
- **Acceptance:** no doc statement contradicts the shipped behavior; grep for
  `init` file lists is consistent.

## T5: Evidence and statuses

- Smoke probe on a fresh fixture: `init` → assert the ten files + `x-generated`
  entries + a second run's buckets; capture the transcript in the review
  verdict (ADR 0008 spirit for generated output).
- Flip `spec-opencode-seam-010` and this plan to `implemented` in the landing
  PR; hand off to W2 (plugin) with the seam as the integration base.
- **Acceptance:** PR references task-opencode-v2-spec; statuses flipped;
  `opencode2` receives the merge.
