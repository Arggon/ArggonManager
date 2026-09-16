---
type: task
status: done
id: task-adopt-corpus-fingerprints
title: "adopt/init inventory: CLI-native spec-corpus detection by fingerprints"
assignee: Arggon
branch: feat/task-adopt-corpus-fingerprints
parent: story-adoption-state
labels: [p3]
created: "2026-09-16"
updated: "2026-09-16"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/story-adoption-state/task-adopt-corpus-fingerprints.md
  Leaves live only under a story. id is the filename stem: task-adopt-corpus-fingerprints.
  CLI `arggon create task adopt-corpus-fingerprints` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# adopt/init inventory: CLI-native spec-corpus detection by fingerprints

## Context

Rollout step beyond the text-first proposal (extends task-adopt-spec-corpus-phases): make the CLI ITSELF detect spec corpora at inventory time (adopt and init --dry-run). Fingerprints: openspec/config.yaml + specs/*/spec.md (OpenSpec); docs/specs/spec-*.md with arggon frontmatter (already migrated); ADR directories; RFC markdown. The inventory reports: format detected, file count, origin tool. With detection in the inventory, the adoption task template can reference the detected corpus specifically (task-adopt-spec-corpus-phases text covers the procedure).

## Acceptance

- [x] adopt inventory (and init --dry-run) detects spec corpora by fingerprint and reports format/count/origin in the inventory output (--json additive) — see Notes: init has no dry-run inventory path; scoped to `adopt` (both dry-run and normal)
- [ ] The detection feeds the adoption task body (the corpus section becomes specific: "detected OpenSpec corpus: N specs — follow the phased checklist") — ADOPT_TASK_BODY is a static template owned by a parallel PR (task-adopt-spec-corpus-phases region); wiring detected corpora into the task body is deferred (see Notes)
- [x] Tests per fingerprint (OpenSpec fixture, already-migrated fixture, no-corpus fixture); docs additive — plus ADR fixture, RFC fixture, multiple-corpora case, human-report and --json assertions in cli/src/adopt.test.ts

## Notes

- Scope: detection lives in `detectSpecCorpora(root)` (pure read, cli/src/adopt.ts), added to `Inventory.corpora` so `adopt --json` is additive; human report gains a `spec corpora:` line when non-empty.
- `arggon init --dry-run` does not exist / does not inventory docs today — the only dry-run inventory is `adopt --dry-run`, which now reports corpora. Extending init is out of scope here.
- Fingerprint rules: openspec = `openspec/config.yaml` + count of `openspec/specs/<capability>/spec.md`; arggon (migrated) = `docs/specs/spec-*.md` with a `spec_id` frontmatter field; adr = `docs/adr/*.md`; rfc = `docs/rfc/*.md` (plain `rfc/*.md` alternate). Multiple corpora coexist and are all reported, in detection order (openspec, arggon, adr, rfc).
- Follow-up (unfiled): inject the detected corpora into the task-adopt-arggon task body at creation time (template would need to become composed, or the corpus line appended) — coordinate with the parallel PR that owns ADOPT_TASK_BODY text.

## Notes
