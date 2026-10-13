---
type: task
status: done
id: task-lesson-promotion-implementation
title: "Implement ADR 0027 lesson promotion: agents.md rule + maker-prompt trigger (Behavioral)"
assignee: arggon-delivery-lead
branch: feat/task-lesson-promotion-implementation
parent: harness-research-transfer
labels: [methodology, context-budget]
created: "2026-10-13"
updated: "2026-10-13"
worktree_path: /home/arggon/Projects/ArggonManager-task-lesson-promotion-implementation
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-lesson-promotion-implementation.md
  Leaves live only under a story. id is the filename stem: task-lesson-promotion-implementation.
  CLI `arggon create task lesson-promotion-implementation` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Implement ADR 0027 lesson promotion: agents.md rule + maker-prompt trigger (Behavioral)

## Context

ADR 0027 (Accepted with PR #761) decided: no cross-run lesson store; lessons are promoted, bounded and cited into the carriers that already own the topic — `skills/arggon-cli/references/pitfalls.md` (mechanics), `ArggonManager/docs/playbooks/<tech>.md` (technology), an item's `## Context` (a refuted approach), an ADR (a decision). One line ≤160 chars with a mandatory citation; the trigger belongs in the generated maker prompt. This is the bounded implementation the spike deferred; if it needs a new command, generated surface, gate or package it upgrades to greenfield (ADR 0017) and stops.

## Acceptance

- [x] the promotion rule lands in `ArggonManager/docs/agents.md`; the trigger sentence lands in `templates/docs/opencode/agents/arggon-maker.md` (and the shipped seam copy if generated)
- [x] the ≤160-char bound + mandatory citation are stated where the agent meets them
- [x] `skills/arggon-cli/**` and `.agents/skills/**` stay byte-equal (Behavioral, skill-sync obligation); ADR 0016 adopter propose channel noted
- [x] context budget checked (`doctor --budget` / `context:report`) or the non-movement justified
- [x] `arggon validate` ok; affected tests green; impact class stated in the PR

## Notes

### 2026-10-13 @ses_ec8e84466ffeY3Gpdkc55cQeEv
## Implementation complete — PR #795 (Behavioral)

**Impact class: Behavioral** (`docs/agents.md` §Changing the methodology itself) — agents must re-learn a rule (nothing else: no command, no gate, no pipeline step, no command contract). Adopters meet it through the generated maker prompt as an ADR 0016 proposal, never by overwrite.

### Files (commit 24471883, 4 files, +33/−1)
- `ArggonManager/docs/agents.md` — new §Promoting lessons (promote, never store) + a change-type table row.
- `templates/docs/opencode/agents/arggon-maker.md` — the trigger sentence (bound + citation inline).
- `.opencode/agents/arggon-maker.md` — seam copy regenerated with `arggon init`; independently verified byte-equal to `---` + generated marker + template render (sha256 5e687b58…).
- `ArggonManager/.convention.yml` — only the moved `x-generated` record's checksum; the regen's version/generatedAt churn stays uncommitted (task-adopter-template-family-followups convention).

### Acceptance checklist evidence
- **rule in agents.md + trigger in the template and its seam copy** — `git show 24471883 --stat`; seam render verified independently (marker + template == committed bytes).
- **≤160-char bound + mandatory citation stated where the agent meets them** — agents.md bullet ("One line, ≤ 160 characters excluding the citation, with a mandatory citation") and the maker-prompt bullet (same two facts inline).
- **skill copies stay byte-equal; ADR 0016 noted** — `skills/arggon-cli/**` untouched, so `.agents/skills/**` = generated marker + source bytes holds; parity asserted by `cli/src/skill-copy.test.ts` in the full suite. The shipped prompt names the carrier as *the `arggon-cli` skill's `references/pitfalls.md`* because an adopting tree carries `.agents/skills/arggon-cli/**`, not `skills/` (`BUNDLED_SKILLS`, `cli/src/docs.ts`); `docs/agents.md` carries the exact source path. ADR 0016 is stated in the rule bullet ("A carrier edit is a methodology edit") and in the PR body.
- **context budget** — `npm run context:report -- --strict` → **verdict: all bounds pass** (exit 0); `arggon doctor --budget`: generated AGENTS.md 2,044/2,048 B, MCP `tools/list` 16,296/16,384 B — no fixed per-session surface moved. Only on-demand surfaces grew: maker prompt 3,375 → 3,985 B (READ-only assessment), `docs/agents.md` 108,665 → 111,660 B.
- **gates** — `npm run build` pass; `npm test` **155 files / 3,367 tests pass**; `npm run lint` pass; `npm run test:structure` 5/5; `arggon validate` ok (0 warnings, v5); `npx prettier --check` on every touched file pass; CI drift-gate reproduction (`node dist/cli.js init --no-commit`, state file excluded) leaves every generated file byte-identical to the generator's render; provenance audit repo-self block green.
- **impact class in the PR** — yes, § "Impact class: Behavioral" in PR #795.

### Open questions for the delivery lead
1. **ZCode seam** — `templates/docs/zcode/arggon/agents/arggon-maker.md` carries no trigger. Deliberate: the item scoped the opencode template + its generated seam copy. Decide whether ZCode adopters get it in a follow-up (needs its own wording pass + seam regen).
2. **Pre-existing doctor hint** — the `arggon-cli` skill frontmatter version (0.5.0) lags the package version (0.9.0). It surfaces only once `init` materializes the derived `.agents/skills/**` copy in a fresh worktree; report-only, untouched here.
3. **`references/pitfalls.md` still states a read contract in its header** — the write obligation now lives in agents.md §Promoting lessons and the prompt (ADR 0027 point 1 assigns it there). No skill edit, so the byte-equal copies are preserved.

Not flipped to `done` — completion is the delivery lead's call after merge.

### handoff 2026-10-13 @ses_ec8e84466ffeY3Gpdkc55cQeEv (session: ses_ec8e84466ffeY3Gpdkc55cQeEv) — next: Review PR #795 (Behavioral) against the acceptance checklist, then merge; delete the claim's worktree after merge (tools.arggon.cleanup).
- branch: feat/task-lesson-promotion-implementation
- open questions: ZCode maker prompt has no trigger (scoped out; follow-up?); pre-existing doctor hint: skill frontmatter version 0.5.0 vs package 0.9.0; references/pitfalls.md header still read-only-contract
