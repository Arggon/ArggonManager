---
type: task
status: done
id: task-adopt-compaction-three-questions
title: "Adopt AutoCompact's three-question compaction diagnostic (when / what / how to continue) in the review bar"
assignee: arggon-delivery-lead
branch: feat/task-adopt-compaction-three-questions
parent: harness-research-transfer
labels: [methodology, context-budget]
priority: p3
created: "2026-10-05"
updated: "2026-10-14"
worktree_path: /home/arggon/Projects/ArggonManager-task-adopt-compaction-three-questions
---
<!--
  Placement (v0): ArggonManager/methodology-productization/external-agent-tooling/harness-research-transfer/task-adopt-compaction-three-questions.md
  Leaves live only under a story. id is the filename stem: task-adopt-compaction-three-questions.
  CLI `arggon create task adopt-compaction-three-questions` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Adopt AutoCompact's three-question compaction diagnostic (when / what / how to continue) in the review bar

## Context

F8 of [exploration-021](../../../docs/explorations/exploration-harness-research-transfer-021.md),
from [AutoCompact (arXiv:2610.02163v1)](https://arxiv.org/abs/2610.02163v1).

AutoCompact reduces context management to three questions: **when** to compact, **what** to
preserve, and **how to continue** from the compacted state. It reports +9.2% absolute on
SWE-bench Verified and +5.0% on SWE-PolyBench Verified by _training_ a coding agent to
answer those three inside its policy (judge-corrected trajectories → SFT → outcome RL).

**We do not train models, and that is not the transfer.** What transfers is the
diagnostic: three questions we can ask of any degrading session with no compute at all.

Two details from the paper make it sharper:

- its failure mode for _how to continue_ is that an agent revisits completed exploration
  or ignores the intended next action — which is exactly what our **handoff** exists to
  prevent, and exactly what we do not verify
- its self-check is **removing the behaviour while keeping the training**: ignoring the
  compaction calls of the same trained model lowers pass rates, so the gain is
  behavioural. That is the shape of evidence we should demand of our own loop changes,
  and it is the discipline the smoke gate already applies.

**Deliberately out of scope:** changing `templates/docs/opencode.jsonc`'s
`compaction: { keep: { tokens: 15000 } }`. AutoCompact's Conclusion names Codex and Claude
Code — our exact category — as length-triggered harnesses where combining learned
proactive compaction "could further improve these systems, which we leave for future
work". We are on a **named open gap**, not a missing fix, and the published fix needs RL
we do not have.

## Acceptance

- [x] Adds the three questions to `docs/engineering.md`'s review bar (or the nearest
      prose carrier) as **advice with a trigger** — "when the session's context is visibly
      degrading" — not as a gate and not as a new command
- [x] Each question is answerable against artifacts that exist: _when_ → what signal is
      visible (re-reading the same files, restarting exploration, long tool output);
      _what_ → the bounded surfaces ADR 0006 already measures; _how to continue_ → the
      handoff fields
- [x] States the honest limitation inline, so a future reader does not mistake this for a
      compaction fix: our compaction stays length-triggered by choice, and the published
      alternative requires training
- [x] Accounts for ADR 0006's budget — anything added to always-loaded context is paid
      every session, so the addition is prose in an existing doc, not a new surface, and
      `doctor --budget` is checked if it moves
- [x] **Does not** add a `compact()` action, a compaction tool, or any executor
- [x] `arggon validate` green; PR opened. Impact class **Advisory**

## Notes

### 2026-10-05 @ses_ef83b74e6ffeC6D8RVXoC2u06K

## Context

F8 of [exploration-021](../../../docs/explorations/exploration-harness-research-transfer-021.md),
from [AutoCompact (arXiv:2610.02163v1)](https://arxiv.org/abs/2610.02163v1).

AutoCompact reduces context management to three questions: **when** to compact, **what** to
preserve, and **how to continue** from the compacted state. It reports +9.2% absolute on
SWE-bench Verified and +5.0% on SWE-PolyBench Verified by _training_ a coding agent to
answer those three inside its policy (judge-corrected trajectories → SFT → outcome RL).

**We do not train models, and that is not the transfer.** What transfers is the
diagnostic: three questions we can ask of any degrading session with no compute at all.

Two details from the paper make it sharper:

- its failure mode for _how to continue_ is that an agent revisits completed exploration
  or ignores the intended next action — which is exactly what our **handoff** exists to
  prevent, and exactly what we do not verify
- its self-check is **removing the behaviour while keeping the training**: ignoring the
  compaction calls of the same trained model lowers pass rates, so the gain is
  behavioural. That is the shape of evidence we should demand of our own loop changes,
  and it is the discipline the smoke gate already applies.

**Deliberately out of scope:** changing `templates/docs/opencode.jsonc`'s
`compaction: { keep: { tokens: 15000 } }`. AutoCompact's Conclusion names Codex and Claude
Code — our exact category — as length-triggered harnesses where combining learned
proactive compaction "could further improve these systems, which we leave for future
work". We are on a **named open gap**, not a missing fix, and the published fix needs RL
we do not have.

## Acceptance

- [ ] Adds the three questions to `docs/engineering.md`'s review bar (or the nearest
      prose carrier) as **advice with a trigger** — "when the session's context is visibly
      degrading" — not as a gate and not as a new command
- [ ] Each question is answerable against artifacts that exist: _when_ → what signal is
      visible (re-reading the same files, restarting exploration, long tool output);
      _what_ → the bounded surfaces ADR 0006 already measures; _how to continue_ → the
      handoff fields
- [ ] States the honest limitation inline, so a future reader does not mistake this for a
      compaction fix: our compaction stays length-triggered by choice, and the published
      alternative requires training
- [ ] Accounts for ADR 0006's budget — anything added to always-loaded context is paid
      every session, so the addition is prose in an existing doc, not a new surface, and
      `doctor --budget` is checked if it moves
- [ ] **Does not** add a `compact()` action, a compaction tool, or any executor
- [ ] `arggon validate` green; PR opened. Impact class **Advisory**

### 2026-10-14 @Arggon
Impact class: **Advisory** — `ArggonManager/docs/engineering.md` prose only; no rule, gate, command contract or pipeline step changed; no new surface and no executor.

Change (commit `7be8ba66`, PR #801): added `### Session context (advice, never a gate)` at the end of §Review bar (after §Docs). Trigger: when the session's context is visibly degrading. The three questions map to artifacts that exist: _when to compact_ → visible signals (re-reading the same files, restarted exploration, long tool output) and never a token count; _what to preserve_ → the ADR 0006 bounded surfaces (item frontmatter, acceptance checklist + latest verdict, injected item block); _how to continue_ → the handoff fields (`branch`, `next`, `open_questions`). The limitation is inline: compaction stays length-triggered by choice (`compaction.keep` untouched) and the published alternative requires training we do not run — a diagnostic, never a compaction fix; no `compact()` action, no compaction tool, no executor.

Evidence (all from the item worktree):

- `npm run arggon -- validate` → expected green; observed `ok (0 warning(s), convention v5)`
- `npm run arggon -- spec validate` → expected green; observed `ok (38 doc(s), 0 warning(s))`
- `npm run arggon -- spec analyze` → expected no NEW finding naming this work; observed byte-identical to the pre-change baseline: 4 pre-existing ambiguity warnings (spec-opencode-seam-010, spec-opencode2-009, spec-spec-import-openspec-005 ×2); `consistency`/`decisions`/`productAcceptance`/`unansweredDecisionBrief` empty
- `npx prettier --check ArggonManager/docs/engineering.md` → expected clean; observed `All matched files use Prettier code style!`
- `npm run arggon -- doctor --budget` before → after: `initTreeBytes` 808378 → 808378, `generatedAgentsMdBytes` 2044 → 2044, MCP tool schema 16296 B → 16296 B — unchanged, so nothing enters always-loaded context
- `npm test` NOT run: docs-only change (the smoke bar exempts docs-only PRs, engineering.md §Smoke test) and no test pins this prose

Observations for the delivery lead (no items filed):

- `tools.arggon.show` (native) resolved the tracker in the primary checkout and answered `todo`/unclaimed, while `npm run arggon -- show` from the worktree answered `in_progress`/`arggon-delivery-lead`; the claim itself is correct and committed on the branch (`ab9006d1`), so only the native root resolution needs a separate look.
- `templates/docs/docs/engineering.md` (the adopter template copy) was deliberately left untouched — candidate follow-up if this advice should reach adopter trees.

### handoff 2026-10-14 @ses_ec5ee8018ffd2NuzH1nxDyMjq7 (session: ses_ec5ee8018ffd2NuzH1nxDyMjq7) — next: Address review findings on PR #801; on approval the delivery lead merges and flips done — maker does not merge. Docs-only; no known blockers.
- branch: feat/task-adopt-compaction-three-questions
- open questions: Adopter template copy untouched (candidate follow-up?); native tools.arggon.show read the primary checkout (todo) while worktree CLI read in_progress — native root resolution worth checking.
