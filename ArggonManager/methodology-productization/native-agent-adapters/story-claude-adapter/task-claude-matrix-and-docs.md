---
type: task
status: done
id: task-claude-matrix-and-docs
title: "Claude Code adapter: capability-matrix rows, agents.md seam section, spec resolution (spec S6/024 §Impact)"
assignee: arggon-delivery-lead
branch: feat/task-claude-matrix-and-docs
parent: story-claude-adapter
labels: []
created: "2026-10-14"
updated: "2026-10-14"
depends_on: [task-claude-plugin-seam]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-claude-adapter/task-claude-matrix-and-docs.md
  Leaves live only under a story. id is the filename stem: task-claude-matrix-and-docs.
  CLI `arggon create task claude-matrix-and-docs` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Claude Code adapter: capability-matrix rows, agents.md seam section, spec resolution (spec S6/024 §Impact)

## Context

The behavioral half of the Claude adapter wave
([story-claude-adapter](story-claude-adapter.md),
[spec-claude-code-adapter-024](../../../docs/specs/spec-claude-code-adapter-024.md)
§Impact): after `task-claude-plugin-seam` ships `templates/docs/claude/**` and the init
seam, this task updates the capability matrix to claim exactly what the bundle moves, adds
the Claude Code seam section to `ArggonManager/docs/agents.md` beside §ZCode, resolves spec
024's three open questions with the recorded probes and flips its status, and sweeps
statements the new seam makes false.

Probe outcomes this task records and re-runs (claude 2.1.289, throwaway HOME; transcripts in
the item comments):

- **Q1 (repo-local marketplace root): PASS** — `claude plugin marketplace add .claude-marketplace`
  - `claude plugin install arggon@arggon-local`.
- **Q2 (namespaced names):** `/arggon:<command>` for commands, `arggon:<agent>` for agents,
  `mcp__plugin_arggon_arggon__<tool>` for the plugin-bundled MCP tools (manifest-reference
  rule + `claude plugin details` evidence).
- **Q3 (both `arggon` keys validate): PASS** — the inline manifest key is kept; at runtime
  `claude mcp list` shows both `plugin:arggon:arggon` and the project `arggon` registration.

## Acceptance

- [x] `adapters/capability-matrix.json` + its byte-equal `templates/docs/adapters/capability-matrix.json` copy: claude `discipline-enforceable` becomes a non-gap `claude:plugin.hooks.PreToolUse` row (note records hooks-fail-open + the kernel as enforcement of record); `docs-travel-with-code` stays a gap (no session-context hook); every note satisfies the matrix lints and the size caps
- [x] `cli/src/capability-matrix.test.ts` pins updated; `cli/src/adapter-selection.test.ts` snapshot updated (claude file count + gap lines); `cli/src/init-claude.test.ts` doctor clause updated if it pins the pre-wave gap set
- [x] `ArggonManager/docs/agents.md` gains a Claude Code seam section beside §ZCode naming the marketplace install step, the one-server rule, the two-agent rule and the namespaced component names (`/arggon:<command>`, `arggon:<agent>`), with impact class stated as **Behavioral**; the §ZCode sentence about S6 updated to the shipped state
- [x] Spec 024: Open questions replaced by the recorded resolutions; `status: implemented`; no new `arggon spec analyze` finding naming the story/spec
- [x] Doc sweep: every statement the bundle makes false is updated (repo README/docs, seam README)
- [x] `ArggonManager/docs/adr/0020-*.md` gains a dated amendment under the repo's convention (the 2026-10-02 PR #610 amendments are the precedent): the claude seam is no longer "exactly those two destinations" / "today it remains docs + `CLAUDE.md`" — the shipped bundle, its PreToolUse gate and the marketplace install replace those clauses
- [x] `arggon validate`, full `npm test`, lint, structure, prettier, `arggon spec analyze` green
- [x] The PR states impact class **Behavioral**

## Notes

- Depends on `task-claude-plugin-seam` (claim only after it is merged — the matrix claims
  ship-state, and the snapshot needs the new destinations on disk).
- `adapters/capability-matrix.json` is hand-authored and byte-mirrored into
  `templates/docs/adapters/capability-matrix.json`; edit the pair together (the byte-equality
  test never hand-divides them). Mirror the zcode rows for shape.
- The story's acceptance boxes 10 and 11 land here; the lead closes the story and flips the
  items after merge verification.

### 2026-10-14 @arggon-maker

**Maker evidence — PR [#822](https://github.com/Arggon/ArggonManager/pull/822)** on `feat/task-claude-matrix-and-docs`, head `802d9ba6`, impact class **Behavioral** (stated in the PR body).

### Row deltas (`adapters/capability-matrix.json` + byte-equal `templates/docs/adapters/capability-matrix.json`)

| invariant × claude           | before                                                     | after                                                                                  |
| ---------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `discipline-enforceable`     | `gap: true`, `docs + CLI floor`, package `none`            | `gap: false`, `claude:plugin.hooks.PreToolUse (hooks/gate.mjs)`, package `claude-code` |
| `docs-travel-with-code`      | `gap: true`                                                | `gap: true`, note rewritten (plugin has no session-context hook)                       |
| `claim-integrity`            | delivered; mechanism said "no client-side backstop exists" | delivered; mechanism now names the plugin's reviewer backstop                          |
| `same-rules`, `state-in-git` | delivered                                                  | unchanged                                                                              |

`discipline-enforceable` mirrors the zcode row exactly: the fail-open posture and "kernel stays the enforcement of record" ride the `mechanism`, because a non-gap row must carry `note: null` — pinned by `cli/src/capability-matrix.test.ts` (**the mission's "its note records…" is satisfied by the mechanism text; adding a note would fail the lint**). Sizes: file 11 251 B ≤ 16 384 B cap; gap note 154 ≤ 200 chars. `claim-integrity` was swept too — the bundle makes its old "no client-side backstop exists" clause false.

### Files

`adapters/capability-matrix.json`, `templates/docs/adapters/capability-matrix.json`, `cli/src/capability-matrix.test.ts`, `cli/src/adapter-selection.test.ts`, `ArggonManager/docs/agents.md`, `ArggonManager/docs/specs/spec-claude-code-adapter-024.md`, `ArggonManager/docs/adr/0020-*.md`, `ArggonManager/docs/json-output.md`, `README.md`, `ArggonManager/.convention.yml`.

### Commands run vs observed (worktree, after `npm run build`)

| command                                   | expected                             | observed                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run arggon -- validate`              | ok                                   | `ok (0 warning(s), convention v5)`                                                                                                                                                  |
| `npm test`                                | all green                            | `158 files / 3457 tests passed` (first run had 1 failure in `provenance-audit.test.ts` — stale x-generated checksum for the edited matrix bytes; fixed in `bfac6de7`, re-run green) |
| `npm run lint`                            | clean                                | clean                                                                                                                                                                               |
| `npm run test:structure`                  | 5 passed                             | `5 passed; 0 failed`                                                                                                                                                                |
| `npx prettier --check` (10 touched files) | clean                                | `All matched files use Prettier code style!`                                                                                                                                        |
| `npm run arggon -- spec analyze`          | no new finding naming spec-024/story | 4 findings, all pre-existing on `spec-opencode-seam-010`, `spec-opencode2-009`, `spec-spec-import-openspec-005` ×2 — none names spec-024/story-claude-adapter                       |

**No test contradiction:** `cli/src/init-claude.test.ts` has no doctor/gap clause (grep: only a `doctor` word in a comment); the matrix lints did not contradict the spec's deltas — they forced the fail-open clause into the mechanism (above), which is the shipped zcode shape.

### Doc sweep (statements the bundle made false)

- `agents.md`: §Claude Code section added beside §ZCode (install step, one-server rule, two-agent rule, `/arggon:<command>` / `arggon:<agent>` / `mcp__plugin_arggon_arggon__<tool>`, gates, remaining gap, **Behavioral**); §ZCode S6 sentence → shipped state; seam list → `.claude-marketplace/` bundle.
- spec 024: Open questions → recorded resolutions (Q1 PASS; Q2 namespaced names; Q3 PASS), `status: implemented`, anchor updated.
- ADR 0020: dated 2026-10-14 amendments (frontmatter bullet + §Context + §Consequences) — the "exactly those two destinations" / "today it remains docs + `CLAUDE.md`" clauses are replaced by the shipped bundle; `Status: Accepted` untouched.
- README `doctor --agents` sample and `json-output.md` `init`/`agents` samples → real current numbers (claude 28 destinations, `1 capability gap(s)`, one docs-travel row; init artifacts 69); `.claude-marketplace` added to the documented detection markers.

### Notes for the reviewer

- Spec §Impact's "owned by another lane" sentence is about the historic lane; the row deltas land here per the acceptance and the spec's "What the bundle is expected to move" table, and are reported in the PR.
- `ArggonManager/.convention.yml` checksum refresh is required by `cli/src/provenance-audit.test.ts` for a hand-edited matrix destination (same repair as PR #611).
- The PR was created first, then the ADR number was stamped (`PR #822`) in `802d9ba6` — the repo's amendment convention.
- Live `claude` probes (Q1/Q3) were recorded from the dependency item's run on 2.1.289, per this item's Context; they were not re-run here (`claude` binary not required by the gates).

### handoff 2026-10-14 @arggon-maker — next: Delivery lead: standards review on PR #822, verify the merge, then close story box 11 and flip this item; spot-check the merged matrix row deltas and the agents.md §Claude Code section.

- branch: feat/task-claude-matrix-and-docs
- open questions: None blocking; json-output init sample count refreshed 39->69 (pre-bundle stale) - confirm the sweep call; spec 024 acceptance boxes left unchecked (story/item hold the live contract)

### 2026-10-14 @ses_eccc605dbffeHEwy9fqO3FP5tx

verdict: approve

### Lead review + merge verification — 2026-10-14 (delivery lead)

Merged as 16e3f979 (PR #822). Impact class: **Behavioral** — a new client surface agents must re-learn; stated in the PR, as the spec requires.

**Matrix.** claude `discipline-enforceable` → non-gap `claude:plugin.hooks.PreToolUse (hooks/gate.mjs)` with the fail-open + kernel-enforcement-of-record clause riding the mechanism (a non-gap row must carry `note: null` — the lint-forced shape, mirroring the shipped zcode row); `docs-travel-with-code` stays a gap with its pre-bundle-language note rewritten; `claim-integrity` swept (its old note claimed no client-side backstop exists). Both matrix copies byte-equal; the ledger checksum refresh is the provenance-audit-required repair for an edited destination.

**Evidence.** capability-matrix pins + the doctor inline snapshot (claude 28 files, 1 gap) updated; the lead re-ran 93 focused tests green on the branch head; CI green on all three lanes. Spec 024: open questions → recorded 2.1.289 resolutions, status `implemented`, the agents-omission correction carried; `arggon spec analyze` unchanged at 4 pre-existing findings, none naming the story/spec. Docs travel: `agents.md` §Claude Code beside §ZCode (install step, one-server rule, two-agent rule, namespaced names, gate contract, Behavioral) + the §ZCode S6 sentence updated; ADR 0020 dated amendments (the two clauses the 2026-10-02 amendment left standing are superseded; one-logic-path untouched); README + json-output doctor samples corrected.

**Coordinates.** Story boxes 10/11 land here. The story itself closes after `task-claude-gate-polish` (the standards-pass nits — the last open leaf under the story).
