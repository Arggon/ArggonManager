---
type: bug
status: done
id: bug-retired-agent-ids-in-doc-samples
title: "Retired agent ids survive in shipped doc samples (json-output.md plain doctor sample; ArggonManager/docs/** sits outside the family walk)"
assignee: arggon-delivery-lead
branch: fix/bug-retired-agent-ids-in-doc-samples
parent: story-adapter-selection
labels: [docs, tests, adopters]
created: "2026-10-13"
updated: "2026-10-13"
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/bug-retired-agent-ids-in-doc-samples.md
  Leaves live only under a story. id is the filename stem: bug-retired-agent-ids-in-doc-samples.
  CLI `arggon create bug retired-agent-ids-in-doc-samples` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Retired agent ids survive in shipped doc samples (json-output.md plain doctor sample; ArggonManager/docs/** sits outside the family walk)

## Context

PR #762 re-measured the `doctor --agents` sample block and its caption, but the plain (non-`--agents`) `doctor` sample at `ArggonManager/docs/json-output.md:857` still names retired seam ids (`arggon-coordinator|arggon-reviewer|arggon-worker`). The family walk added by `bug-adopter-engineering-template-software-locked` (PR #758) sweeps `templates/docs/**` only — `ArggonManager/docs/**` and the `smokes/agents.md` samples sit outside it, so a retired id can still ship green. The PR #762 verdict explicitly assigns this to its own item.

## Acceptance

- [x] shipped doc samples name only shipped seam ids (json-output.md plain doctor sample + every other hit from a grep for retired ids across `ArggonManager/docs/**`)
- [x] a guard covers the shipped docs samples (or the template-family walk is extended to `ArggonManager/docs/**`) so a retired id cannot ship green
- [x] grep evidence in the item; `arggon validate` + affected suites green

## Notes

### 2026-10-13 @ses_ec8e84465ffexqO6yOcub1DHa4
### 2026-10-13 @arggon-maker — fix + guard shipped (PR #796, branch `fix/bug-retired-agent-ids-in-doc-samples`, commit `b08f1b05`)

**Files**

- `ArggonManager/docs/json-output.md` — the plain (non-`--agents`) `doctor` sample now lists the four shipped `.opencode/agents` ids in `doctor`'s sorted order: `arggon-delivery-lead`, `arggon-maker`, `arggon-standards-reviewer`, `arggon-verifier` (was `arggon-coordinator`, `arggon-reviewer`, `arggon-worker`).
- `cli/src/agent-id-doc-contract.test.ts` (new) — the sibling guard.

**Where the guard landed, and why (the dispatch's question)**

A sibling guard, not an extension of `adopter-template-invariant-drift.test.ts`. That walk's definition is "every adopter template, whatever its extension" — files `arggon init` renders byte-for-byte into an adopting tree. `ArggonManager/docs/**` is not that: it mixes live carriers/samples with **dated records** (`adr/`, `explorations/`, `plans/`, `specs/`, tracker items) that MUST keep the retired ids — ADR 0021 §6.2a′'s mapping table IS the single source of the rename, and `spec-agent-rename-019` records the migration as planned. Extending the walk wholesale would flag the record of the rename itself; excluding record subtrees inside it would make its own definition false. The live-vs-record boundary is already the repo's stated posture in `mcp-doc-contract.test.ts` and `adr-status-doc-contract.test.ts`; the sibling states it once for agent ids. Guard surface: every `.md` under `ArggonManager/docs/` except the four record subtrees, plus `README.md` and `skills/**` (`npm pack` ships both; PR #762 fixed the same drift class in the README sample).

**Rules (precise, not a word search)**

1. No live doc contains one of the four retired ids of ADR 0021 §6.2a′ (`arggon-standards-reviewer` does not contain `arggon-reviewer`, `arggon-maker` not `arggon-worker`; the control asserts that no overlap exists).
2. Every sample's `opencode.artifacts.agents` array equals, id for id and in order, the `.md` stems derived from `templates/docs/opencode/agents/*.md` (the corpus `doctor` lists). Catches a retired id, an invented id, or a stored id missing from the sample.
Premise guards: walk non-empty; the four record subtrees exist on disk and are outside the walk; every fenced `json` block parses (a sample that cannot be read cannot be checked); the scanner fires on the exact pre-fix text.

**Grep evidence (`git grep -n -E 'arggon-(coordinator|reviewer|worker|prover)'`)**

- `ArggonManager/docs/**`: 12 files, **all under the four record dirs** (adr 3, explorations 2, plans 2, specs 5). Live hits (outside those dirs): **0**. The only live hit before the fix was `json-output.md:857`, now clean.
- `smoke/`: **0** hits. There is no `smokes/` path in this checkout (the reviewer note's "two smokes/agents.md samples" does not resolve to any tracked file — measured, not assumed).
- `cli/src/docs.ts:991` names `arggon-coordinator` in a code comment — it documents the orphan-reaping rationale for the destination the rename retired, i.e. the id is the subject, not a stale seam reference. Out of the guard's doc surface by design.

**Negative control (reverted fix, then restored)**

Command: swap the fixed sample block back to the pre-fix bytes, then `npx vitest run cli/src/agent-id-doc-contract.test.ts`.
Observed: 2 failed / 3 passed — rule 1 reports `ArggonManager/docs/json-output.md: names the retired agent id "arggon-coordinator" …` (also worker, reviewer); rule 2 reports `json-output.md:828: expected ['arggon-coordinator', …(2)] to deeply equal ['arggon-delivery-lead', …(3)]`. Restored → 5 passed.

**Gates (all in this worktree)**

- `npm run build` → exit 0 (plugin bundle byte-identical)
- affected suites `adopter-template-invariant-drift`, `init-docs`, `mcp-doc-contract`, `agent-id-doc-contract` → 4 files / 69 tests passed
- `npm test` → 156 files / 3372 tests passed
- `npm run lint` → exit 0; `npm run test:structure` → 5 passed / 0 failed
- `npm run arggon -- validate` → ok (0 warnings, convention v5)
- `npx prettier --check` on both touched files → clean

**Acceptance checklist (ticked here — the boxes live in the comment record, not the live section)**

- [x] shipped doc samples name only shipped seam ids — `json-output.md` plain `doctor` sample fixed; grep over `ArggonManager/docs/**` shows 0 live hits (remaining hits are the four record dirs, which keep the mapping by design) and 0 under `smoke/`
- [x] a guard covers the shipped docs samples — `cli/src/agent-id-doc-contract.test.ts`, with the reverted negative control above
- [x] grep evidence in the item; `arggon validate` + affected suites green

**Found, not fixed (report to the delivery lead)**

- `ArggonManager/docs/adr/0010-opencode2-native-architecture.md:53-54` still names `arggon-coordinator` / `arggon-worker` / `arggon-reviewer` as the shipped agents. It is a dated record (exempt by this guard and by the same posture as ADR 0021's untouched rows), but it is factually stale. No item for it found in the tracker; the sibling item `bug-adr-0021-s5-lists-retired-agent-ids` flagged it as out of scope.

### handoff 2026-10-13 @ses_ec8e84465ffexqO6yOcub1DHa4 (session: ses_ec8e84465ffexqO6yOcub1DHa4) — next: Delivery lead: standards-review PR #796 (b08f1b05 + comment 378eb663): doc sample fixed, guard cli/src/agent-id-doc-contract.test.ts green with a reverted negative control; do not merge.
- branch: fix/bug-retired-agent-ids-in-doc-samples
- open questions: ADR 0010:53-54 still names retired ids (record, not fixed; no item found) - file one?; guard surface = ArggonManager/docs live + README + skills, record dirs exempt.

### 2026-10-13 @ses_eccc605dbffeHEwy9fqO3FP5tx
verdict: approve
### Lead merge verification — 2026-10-13 (delivery lead)
Merged as 78ae2b30 (PR #796); flipped by the lead (rows verified and ticked). The plain `doctor` sample now lists the four shipped agent ids; the new sibling guard (`cli/src/agent-id-doc-contract.test.ts`) covers live docs + README + skills minus the four record subtrees, pins the exact retired-id set AND the corpus-derived shipped set, and its reverted negative control fails as designed. Grep evidence: zero live hits (the only pre-fix hit was `json-output.md:857`); the item's `smokes/` reference does not exist in this checkout (measured, 0 hits). Full suite 3,372 green; CI green.
