---
type: task
status: todo
id: task-capability-matrix
title: Committed capability matrix + doctor gap rows (plan T3)
parent: story-capability-matrix
labels: []
created: "2026-10-02"
updated: "2026-10-02"
depends_on: [task-methodology-carriers]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-capability-matrix/task-capability-matrix.md
  Leaves live only under a story. id is the filename stem: task-capability-matrix.
  CLI `arggon create task capability-matrix` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# Committed capability matrix + doctor gap rows (plan T3)

## Context

Commit `adapters/capability-matrix.json`: methodology invariant × agent → mechanism/package/gap note; `arggon doctor` prints gap rows report-only

## Acceptance

- [ ] JSON validates in CI (schema test)
- [ ] every gap row carries a note
- [ ] doctor output bounded and report-only

## Notes

### 2026-10-02 @arggon-reviewer
verdict: request-changes (two bounded corrections: two claude rows assert absences the shipped seam contradicts; the JSON contract doc + 3 code comments still describe the removed package fallback)

Review by reading only (no gates run by me — evidence below is file-level; the blocking CLI probes are in the `## Probes needed` section for the prover/coordinator).

## Findings (severity order)

**F1 — blocking. `claude × same-rules` and `claude × state-in-git` name gaps the shipped seam does not have.** `adapters/capability-matrix.json`:
- `same-rules/claude` note: "no adapters/claude/ plugin bundle (skills, agents, hooks, commands, `arggon mcp` wiring)", mechanism "there is no plugin and no native tool surface".
- `state-in-git/claude` note: "a plugin bundle would register the arggon tools so item mutations never depend on the agent hand-writing shell commands correctly".

Both are contradicted by the tree this PR ships in: `.mcp.json` at the repo root registers `arggon mcp` (`{"command":"arggon","args":["mcp"]}`), it is an init-generated destination (`cli/src/docs.ts:278` `"mcp-json": ".mcp.json"` in `DOC_PATH_MAP`; `cli/src/init.test.ts:389` asserts init writes it), and the product doc says that file "still serves other clients (e.g. Claude Code)" (`ArggonManager/docs/agents.md:546`), returning the identical envelopes for the 15 tools (`ArggonManager/docs/json-output.md:14`). The zcode bundle registers the *same* server the same way (`cli/src/init-zcode.test.ts:103-104`, `mcpServers.arggon = {command:"arggon",args:["mcp"]}`), and this matrix credits that identical surface with `gap: false` on zcode `same-rules` and `state-in-git`. So the asymmetry is not independently derived: on the matrix's own `fieldNotes.rows[].gap` criterion ("no shipped adapter surface delivering the invariant") a Claude Code client in a standard init'd tree *does* have that surface. A Claude Code adopter reading `doctor` is told "on this client the methodology is docs plus the CLI" — they actually get the arggon MCP tools, `arggon_start`/`branch`/`cleanup` included. That is the failure mode this review exists to catch, in the negative direction: an absence that is not an absence.
Fix (either way, then re-read the other three claude rows): either (a) keep `gap: true` and rewrite both mechanisms/notes to name only what is genuinely absent — bundle-scoped MCP registration, skills, agents, hooks, commands — and say plainly that the arggon MCP surface reaches this client through the shared generated `.mcp.json`; or (b) downgrade the two rows to `gap: false` naming `.mcp-json` as the mechanism (parity with the zcode rows). Whichever you pick, `fieldNotes.rows[].gap` must state the criterion it actually applies (bundle presence vs invariant delivery) — today the two disagree. The other three claude rows check out as written (`CLAUDE.md` → `@AGENTS.md` in `templates/docs/CLAUDE.md`; no session context hook; no per-agent permission/hook enforcement).

**F2 — blocking. The JSON contract doc and three code comments still document the package fallback that commit 38bd08b4 removed.** `ArggonManager/docs/json-output.md:196` — `matrix.present`: "A readable matrix file was found (tree copy or installed package)"; `:197` — `matrix.source`: "the tree's own committed copy first, the installed package's copy as fallback". Both are contradicted by the resolution paragraph 10 lines below (`:208`, tree-only, no fallback) and by `readCapabilityMatrix` (`cli/src/capability-matrix.ts` — `join(root, ...MATRIX_PATH)`, nothing else). Same stale claim in `cli/src/doctor.ts:640-641` and `:759-760` ("the installed package's shipped matrix is the fallback") and in the `MATRIX_PATH` JSDoc ("relative to the tree root or the installed package root"). The field table is the consumer-facing contract for the field this PR adds, so it is the worst place to leave a resolution rule that does not exist. Four edits.

**F3 — non-blocking, same pass.** The item body's first two Notes blocks still assert the reverted state: "committed, shipped in the pack" and a Files line listing `cli/src/pack-contents.test.ts` + `package.json` (`adapters/` in `files`) — neither file is in the diff, and `package.json` `files` is `["dist/**","templates/","skills/","opencode/","README.md","LICENSE",…]` with no `adapters/`. Also "19 tests" in the Files line vs **20** `it()` blocks in `cli/src/capability-matrix.test.ts`, and the same 19 in the PR body's Tests section vs 20 in the coordinator brief. The later worker comment corrects the substance; the stale bullets are what a reader lands on first.

**F4 — nit.** Committed gap notes are 201 and 206 chars (`same-rules`, `discipline-enforceable`) while the human renderer caps each value at `MAX_HUMAN_VALUE_CHARS` = 200 before escaping (`lib/src/sanitize.ts:25`, `clipHumanText`) — those two `gap:` lines render with a trailing `…` ("…plus the CLI…", "…carry it …"). Cosmetic today, and the schema test's `≤ 400` bound lets a future note cut actionable content. Either assert `note.length <= MAX_HUMAN_VALUE_CHARS` in the committed-file test or shorten those two.

**F5 — nit.** `opencode × discipline-enforceable` says "per-agent tool **allow-lists** in .opencode/agents/*.md"; the templates ship `permissions:` **deny** rules (`templates/docs/opencode/agents/arggon-reviewer.md`: `edit`/`subagent` deny + every mutating `arggon_*` deny; worker denies `subagent`). The two parenthetical claims are true; the noun is wrong.

**F6 — coordinator.** `task-matrix-reaches-adopters` has an empty `## Acceptance` (placeholder comment only). `AGENTS.md` requires a filed finding to carry context **and** an acceptance checklist; the context is good, the checklist is missing. Fill it before the item is picked up.

**F7 — observation, no action needed.** `agents` is capped at `MAX_MATRIX_AGENTS` = 20 with no `agentsTruncated` counterpart, so a hand-edited 25-agent file would print "x 20 agent(s)" with nothing saying a cut happened — unlike `gapRows`, which has `truncated`. Unreachable under the 16 KiB file ceiling in practice; noting for completeness.

## Verified by reading (what is right)

- **Invariants: verbatim, complete, and gated.** All three carriers carry the identical clause list (`ArggonManager/docs/agents.md:6`, `docs/engineering.md:6`, `docs/convention.md:6`, present on `main` via merged PR #592) and the matrix's five `statement` values match clause-for-clause, including the terminal `never-steal / never-reopen.`. The parity test is discriminating: it extracts each carrier's `> - **Invariants:**` line, splits on `;`, and `toEqual`s the clauses against the matrix statements — a carrier edit fails CI. 5 × 3 = 15 rows, one per cell, no duplicates, no strays, and every `mechanism` is namespaced (`/^(opencode|zcode|claude|docs \+ CLI floor):/`) and ≤ 400 chars — the "no rule logic in a data file" bar is enforced, not just asserted in prose.
- **Mechanism claims traced to the seams.** `opencode:tool.transform` registers the native namespace (`opencode/plugins/arggon/index.ts:4708`) and the context block is built from `arggon show <id> --meta --json` under `ITEM_BLOCK_MAX_BYTES = 1024` (plugin `:180`, `:846`, docstring `:44`). Worktree domain `create/list/remove` (plugin `:2062`) with `refresh` feature-detected (plugin `:3953`) — the row's "create/list/refresh/remove" is accurate. `opencode.jsonc` denies exactly `git commit --no-verify` and `git push --force|-f|+` (`templates/docs/opencode.jsonc:48-52`); reviewer cannot edit, worker cannot nest (agent frontmatter). Native `cleanup` really does take `release: <id>` and release a dropped claim (plugin `:4039-4046`, description `:4579`), so the claim-integrity row's cleanup clause is true. `hooks/gate.mjs` denies force-push and `commit --no-verify` globally (`:77-80`) with the reviewer backstop on the mutating `mcp__arggon__*` set and `arggon_comment` deliberately open (`:48-57`, `:173`, `:189`), and its fail-open posture is stated in the file's own header (`:26`) and repeated in the zcode mechanism prose. The zcode bundle's 12 commands, 3 agents and the `arggon mcp` registration all exist.
- **Zero gaps on opencode/zcode is otherwise defensible.** The one genuinely soft spot (zcode's fail-open gate) is disclosed in the mechanism string and the kernel remains the enforcement of record, and the documented platform gaps that do exist (no ZCode TUI panel; zcode cannot express per-tool denies) are adapter-surface gaps that do not map onto any of the five methodology invariants — out of this matrix's stated scope, not a hidden row. The five claude gaps are the right *shape*; F1 is about two of their notes being wrong, not about the split being invented.
- **Report-only is structural.** The reader imports only `node:fs`/`node:path`/`@arggondev/lib`'s sanitizer — no kernel call, no gating. `matrix` appears in exactly two source sites (`cli/src/cli.ts:358`, `cli/src/doctor.ts`); `validate` does not reference it, and doctor's `process.exitCode = 1` still lives only in the `catch` (`cli.ts:375-381`) — nothing keys off `matrix.gaps`.
- **The cap cannot mislead.** `gaps` counts every gap row in the file; `gapRows` is capped at 10; `truncated` plus the "N further gap row(s) not listed (cap 10)" line make the cut explicit; `invalid` is reported, never repaired. Tested with 13 rows.
- **Budgets hold by construction.** The diff touches no tool schema: `opencode/plugins/arggon/index.ts` and `index.bundle.ts` are untouched (so the `check:plugin` byte-identity claim is consistent), and `matrix` is a doctor *output* field, never an MCP/native tool input schema. `docs/json-output.md` §Compatibility sanctions additive fields within `schemaVersion: 1` with no existing field changed → ADR 0016 "additive" is the right classification. The 12,162 B / 16,253 B figures themselves are execution evidence (probe P4).
- **(5a) trade-off characterized correctly, not papered over.** `adapters/` is absent from `package.json` `files`, `version` is `0.5.0`, and `cli/version-guard.mjs` deliberately scopes its demand to publish-relevant fields (`files` is one) — reverting rather than smuggling a bump is right, and `task-matrix-reaches-adopters` names the real consequence (invisible to every adopter) plus the T2/T4/T5 sequencing trap. Only F6 (empty acceptance) is missing there.
- **(5b) the tree-only fix is real, and it is not a narrowed read that hides anything.** `runDoctor` resolves `root = location.repoRoot` — the **git** root, not the tracker dir — so a tree that commits `adapters/capability-matrix.json` is found wherever it sits. Every failure mode is reported, never silent: absent → `present: false` + "not found (expected adapters/capability-matrix.json in this tree)"; corrupt → `error: invalid JSON …` with `source` still set; oversized → rejected by `statSync` before the read. And the fix makes pack↔checkout parity a property of construction rather than of luck, which `cli/src/headless-ci.test.ts:449` ("packed-bin --json envelopes are byte-identical to the checkout CLI") pins end-to-end. The unit-level twin discriminates too: with the package fallback, `runDoctor({cwd: tempDir}).matrix.present` would be `true` in a checkout and the assertion `toBe(false)` would fail.

## Test discrimination (read, not run)

20 `it()` blocks. Genuinely load-bearing: the carriers-parity gate (fails on any carrier edit), the note-required gate (fails on a note-less gap row), the tree-only pin above, the cap-vs-honest-count pair, the hostile-note sanitizer (asserts JSON keeps the raw string while the human line is inert), and the two exit-0 assertions with 5 gaps present. One weak spot worth naming: "reports the gaps that are real: no shipped Claude Code adapter yet" pins the *current* gap set rather than deriving it from the seams — it encodes ADR 0020's conclusion and it cannot detect a wrongly-classified row, which is exactly how F1 slipped through. That is acceptable as a forcing function for the S6 story (it will fail when a claude bundle lands and the matrix must be updated), but it should not be read as an honesty proof.

## What I could not verify by reading

Whether `arggon doctor` renders acceptably end-to-end on a fixture (human + `--json`, initialized and not) — the blocking smoke bar in `engineering.md` §Smoke test requires a probe with expected-vs-observed, and that is the prover's to run. Same for the three budget numbers and for the 200-char note clip as rendered. Probes below.
