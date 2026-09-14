---
type: task
status: in_progress
id: task-adr0006-docs-budget
title: "ADR 0006: generated-docs context budget (AGENTS.md <=2KB) + SKILL.md dedup"
assignee: Arggon
branch: feat/task-adr0006-docs-budget
parent: operating-principles
labels: []
created: "2026-09-14"
updated: "2026-09-14"
claimed_at: "2026-09-14T21:15:30.367Z"
---
<!--
  Placement (v0): tasks/arggon-manager/cli/operating-principles/task-adr0006-docs-budget.md
  Leaves live only under a story. id is the filename stem: task-adr0006-docs-budget.
  CLI `arggon create task adr0006-docs-budget` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# ADR 0006: generated-docs context budget (AGENTS.md <=2KB) + SKILL.md dedup

## Context

Implements the generated-docs part of accepted [ADR 0006](../../../docs/adr/0006-token-context-efficiency.md): a fresh `init --full` emits ~43.7 KB (~10.9k tokens) of fixed reads per session; SKILL.md is 37% of the tree and duplicated at `skills/` + `.agents/`; the generated AGENTS.md is 3.7 KB against a <=2 KB budget. SPEC FIRST for the budget mechanism.

## Acceptance

- [x] Context budget defined and enforced: generated AGENTS.md <=2 KB (pointers over inline rules), SKILL.md deduplicated in-tree (single copy or generated-on-demand instead of two committed 16 KB copies), budget asserted by a test so it cannot regress silently
- [x] init-docs tests updated for the new shape; doctor reporting unchanged (0 modified / 0 drifted for adopters)

## Notes

### Result (2026-09-14)

- `templates/docs/AGENTS.md`: 3,921 B → 1,966 B; rendered (with `{{PROJECT_NAME}}` = "ArggonManager" + generated marker): ~2,016 B — inside the 2 KB budget with ~32 B headroom. All normative content kept: claim rules, never-steal, never-reopen + follow-ups, PR rules, validate gate (pre-commit + CI comments), Orchestration subsection (delegated by default, file-disjoint waves, coordinator as lead architect code-reviewing every PR), skill-by-default pointer, MCP pointer, deploy.md pointer, playbooks pointer. Shrunk by compressing bullets into dense paragraphs and dropping explanatory prose, not normative rules.
- Budget assertion added in `cli/src/init-docs.test.ts` (fresh init, asserts rendered AGENTS.md <= 2048 bytes) — regresses loudly.

### SKILL.md dedup design (chosen option)

Single committed source: `skills/arggon-cli/SKILL.md` (16,619 B). `.agents/skills/arggon-cli/SKILL.md` is now **gitignored** (was a second committed 16.6 KB copy).

- Generator: `npm run skills:sync` → `cli/src/sync-skills.ts` writes marker + source (reuses `generatedMarker` from `cli/src/docs.ts`) for local dev and skill-reading clients; README documents the post-clone step.
- Parity test (`cli/src/skill-copy.test.ts`) is **self-healing**: when the copy is absent it regenerates from source, then asserts byte equality — the skip-if-absent masking risk is avoided because generation makes the equality assertion unconditional.
- Consequence (a) — `x-generated` entry: **dropped** the `.agents/skills/arggon-cli/SKILL.md` entry from `tasks/.convention.yml`. Keeping it would make doctor report `missing` on any clone where tests haven't run yet. The copy is now un-managed and covered by the plain parity test. Verified: `arggon validate --json` ok:true, doctor 0 modified / 0 drifted / 0 missing (managed docs 12 → 11).
- Adopter-side `init` behavior unchanged: init still bundles the skill into adopter repos and records provenance there; only this repo's own in-tree duplication was removed.
