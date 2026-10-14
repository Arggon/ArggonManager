---
type: bug
status: in_progress
id: bug-zcode-agents-brace-elided-retired-ids
title: "docs/agents.md §ZCode brace-elides retired agent ids (arggon-{worker,reviewer}.md) and the id guard is substring-based, so it ships green"
assignee: arggon-delivery-lead
branch: fix/bug-zcode-agents-brace-elided-retired-ids
parent: story-adapter-selection
labels: [docs, tests, roles]
created: "2026-10-14"
updated: "2026-10-14"
claimed_at: "2026-10-14T11:54:17.362Z"
worktree_path: /home/arggon/Projects/ArggonManager-bug-zcode-agents-brace-elided-retired-ids
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/bug-zcode-agents-brace-elided-retired-ids.md
  Leaves live only under a story. id is the filename stem: bug-zcode-agents-brace-elided-retired-ids.
  CLI `arggon create bug zcode-agents-brace-elided-retired-ids` adds the bug- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# docs/agents.md §ZCode brace-elides retired agent ids (arggon-{worker,reviewer}.md) and the id guard is substring-based, so it ships green

## Context

Found by the `task-zcode-maker-lesson-trigger` maker (PR #802): `ArggonManager/docs/agents.md` §ZCode names the retired agent ids **brace-elided** (`agents/arggon-{worker,reviewer}.md`), and the live-doc guard added by `bug-retired-agent-ids-in-doc-samples` (`cli/src/agent-id-doc-contract.test.ts`) is substring-based — the elided form matches neither the retired literals nor the shipped-id set, so it ships green. Third instance of the class (`bug-retired-agent-ids-in-doc-samples` caught `json-output.md`; `bug-adr-0021-s5-lists-retired-agent-ids` caught ADR 0021 §5).

## Acceptance

- [x] `docs/agents.md` §ZCode names the shipped ZCode seam agents (verify against `templates/docs/zcode/arggon/agents/` and the plugin manifest — what actually ships)
- [x] the id guard detects brace/elision forms, or the ids are enumerated so an elision cannot hide a retired id; a reverted negative control fails as designed
- [x] grep evidence in the item; `arggon validate` + affected suites green; prettier clean on touched files

## Notes

### 2026-10-14 @ses_ec5bbe5d7ffecjNObAb0WvEEZK
### 2026-10-14 @arggon-maker — fix + guard + lesson (PR #809, commit `564c6918`)

**Decision (recorded per dispatch).** Strengthen the checker, not only the prose. `braceElidedIds()` expands every `arggon-{a,b}` group in a live doc (a part-local `.md` is stripped) and each expanded id runs the same retired-id predicate as the literal rule. Chosen over enumerating the §ZCode ids alone: enumerating one line leaves the hiding mechanism in place for the next elision, and the acceptance allows either. Brace style stays legal when every expansion is a shipped id. Both existing rules and the record-dirs exemption are untouched.

**Findings the new rule surfaced (all fixed; all pre-existing).** Four elided sites in three live docs:

| site | was | now (shipped set) |
| --- | --- | --- |
| `docs/agents.md` §ZCode | `agents/arggon-{worker,reviewer}.md` | `agents/arggon-{maker,standards-reviewer}.md` |
| `docs/agents.md` §OpenCode V2 | `.opencode/agents/arggon-{coordinator,worker,reviewer,prover}.md` | `.opencode/agents/arggon-{delivery-lead,maker,standards-reviewer,verifier}.md` |
| `docs/opencode2.md` init table | `.opencode/agents/arggon-{coordinator,worker,reviewer}.md` | `arggon-{delivery-lead,maker,standards-reviewer,verifier}` |
| `docs/playbooks/opencode.md` | `.opencode/agents/arggon-{coordinator,worker,reviewer}.md` | `arggon-{delivery-lead,maker,standards-reviewer,verifier}` |

ZCode verification (acceptance row 1): `templates/docs/zcode/arggon/agents/` holds exactly `arggon-maker.md` and `arggon-standards-reviewer.md`; the plugin manifest (`templates/docs/zcode/arggon/.zcode-plugin/plugin.json`, `agents: "agents"`) and the seam README ("there is no `arggon-delivery-lead` agent here") agree.

**Evidence (command → expected vs observed)**

1. `npx vitest run cli/src/agent-id-doc-contract.test.ts` at HEAD (pre-change) → 5 passed: the elision matched nothing — the defect, reproduced.
2. Same suite with the expanded rule, docs still unfixed → 1 failed / 4 passed, exactly 12 `brace-elides the retired agent id` failures: agents.md ×6 (via `arggon-{coordinator,worker,reviewer,prover}` and `arggon-{worker,reviewer}`), opencode2.md ×3, playbooks/opencode.md ×3.
3. Reverted negative control: §ZCode put back to `agents/arggon-{worker,reviewer}.md` → suite fails with `brace-elides the retired agent id "arggon-worker"` and `"arggon-reviewer"` (via `arggon-{worker,reviewer}`); file restored from its byte copy → 5 passed. The in-suite control also pins the pre-fix elided text: `braceElidedIds` on it yields both retired ids, on the shipped `arggon-{maker,standards-reviewer}` yields none, and `arggon-{worker.md,reviewer.md}` normalizes to the retired pair.
4. Grep, live surface (`ArggonManager/docs/**` minus `adr/explorations/plans/specs`, `README.md`, `skills/**`): literal `arggon-(coordinator|worker|prover|reviewer)` → **0 hits**. Every remaining `arggon-{...}` expands to shipped ids or command names only: `arggon-{maker,standards-reviewer}` (ZCode), `arggon-{delivery-lead,maker,standards-reviewer,verifier}` (OpenCode), `arggon-{next,...}` (commands).
5. Gates on the final tree: `npm run build` ok; `npm test` **157 files / 3393 tests passed**; affected suites (`agent-id-doc-contract`, `adopter-template-invariant-drift`, `mcp-doc-contract`) 25 passed; `npm run lint` clean; `npm run test:structure` 5 passed; `arggon validate` ok (0 warnings); prettier clean on all 6 touched files. Record-dirs exemption intact (the premise guard still asserts all four dirs exist and stay outside the walk).
6. Lesson promoted to `skills/arggon-cli/references/pitfalls.md` (one line, 148 chars + citation); `npm run skills:sync` refreshed the `.convention.yml` ledger row for the derived `.agents/skills/...` copy — without it `provenance-audit.test.ts` fails (`stale-derived-checksum`).

**Open observations (not fixed here — different class, delivery lead's call)**
- Retired role *vocabulary* (Coordinator / worker / reviewer) remains in the touched live docs' prose and table cells. `task-retired-role-words-product-text` (done) reported the `docs/agents.md` instances as out of scope; no item covers the rest.
- Command elisions (`arggon-{next,...}` in `docs/playbooks/opencode.md`, `skills/arggon-cli/SKILL.md`) are accurate today (11 OpenCode commands, 13 ZCode commands) and are command names, not agent ids — out of this guard's scope.

PR: https://github.com/Arggon/ArggonManager/pull/809 — maker's work complete; review/merge and the `done` flip belong to the delivery lead.

### handoff 2026-10-14 @ses_ec5bbe5d7ffecjNObAb0WvEEZK (session: ses_ec5bbe5d7ffecjNObAb0WvEEZK) — next: Delivery lead: review PR #809; merge, then flip done — acceptance ticked, evidence in the comment above.
- branch: fix/bug-zcode-agents-brace-elided-retired-ids
- open questions: Retired role vocabulary still in touched live docs (opencode2/agents/playbooks): file a follow-up?; command elisions are out of this guard's scope.
