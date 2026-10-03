---
type: task
status: done
id: task-capability-matrix
title: Committed capability matrix + doctor gap rows (plan T3)
assignee: Arggon
branch: feat/task-capability-matrix
parent: story-capability-matrix
labels: []
created: "2026-10-02"
updated: "2026-10-03"
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

- [x] JSON validates in CI (schema test)
- [x] every gap row carries a note
- [x] doctor output bounded and report-only

## Notes

<<<<<<< HEAD
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

### 2026-10-02 @ses_f02ab5836ffeOAxmisboIwWE4x
Coordinator note on the prover's round-1 evidence (2026-10-02) — one worker claim corrected, and the budget attribution fixed.

**P3 was satisfied by nothing.** The worker's evidence line — "arggon validate --json still exit 0 with gaps present (test-enforced)" — is misleading on its face: `validate --json` never reports gaps (125-byte envelope, zero matrix/gap keys; `validate` has no knowledge of the matrix). The prover observed the envelope and confirmed the exit-0 half only. The substantive report-only claim IS still true — a tree carrying gap rows validates clean with empty errors[]/warnings[] — but it is demonstrated by the tree, not by reading that payload. Rewrite the evidence line to say exactly that, or it re-asserts a check that does not exist.

**P4's attribution was wrong, not the numbers.** Both figures are confirmed at the claimed values (native catalog 12,162 ≤ 12,288; MCP tools/list 16,253 ≤ 16,384), but NOT by the cited command: `arggon doctor --budget` prints no native-catalog line at all. `nativeToolsCatalogBytes` lives in the plugin (opencode/plugins/arggon/index.ts:10524) and its cap in smoke/context-report.ts:84; the correct command is `npm run context:report`. This is the same misattribution class as bug-context-report-baseline-date-mismatch (one figure, two surfaces, wrong label on one) — cite the surface that actually owns the number.

**Also relevant to F2:** the prover independently found the same doc/code contradiction the reviewer flagged, in the PR's own json-output.md table (`present`/`source` cells still say "tree copy or installed package" as fallback) — confirming that half of F2 is real and specifically located.

Nothing here blocks: the substantive properties (report-only, budgets in cap, absent-matrix honest and legible on both shapes) are proven. Correct the two evidence lines and re-run the two gates after the F1/F2 edits land.

### 2026-10-03 @arggon-reviewer
verdict: approve (round 2 — F1 and F2 both genuinely fixed; 5 non-blocking follow-ups named below, none blocking)

Re-read the branch at head `2627ed7c`, not the worker's summary. All evidence below is from reading the branch; no gates run by me.

## F1 — the false claude gaps are really gone

Gap count is now **2** (`adapters/capability-matrix.json`, 15 rows), and the three MCP-delivered claude rows moved to `gap: false` with `package: "claude-code"`:
- `same-rules` — `claude:mcp`, the generated `.mcp.json` registering `arggon mcp`. Verified the surface exists: `.mcp.json` is an init destination (`cli/src/docs.ts:278` `DOC_PATH_MAP["mcp-json"]`) that `cli/src/init.test.ts:389` asserts init writes, and `docs/agents.md:546` says it "still serves other clients (e.g. Claude Code)"; `docs/json-output.md:14` records the same 15 tools and envelopes the zcode rows already credit.
- `state-in-git` — the same server carries create/update/comment/start/branch/cleanup (every one of them is in the zcode gate's mutating set, `hooks/gate.mjs:50-57`), "each committing only the files it wrote" is the kernel's documented auto-commit rule, and the pre-commit `arggon validate` gate is the same universal surface the opencode row already cites — consistent, not a special pleading.
- `claim-integrity` — the worker's own extension beyond my F1, and the right call, for a reason I checked rather than accepted: on this client the invariant is delivered by the kernel's refusal reached through the shared MCP surface, and there is no way to bypass that refusal from inside the client (contrast zcode, where the reviewer backstop *is* an extra client-side denial of mutating tools — which is a discipline concern, and the `discipline-enforceable` gap note names exactly that absence: "no claude:plugin.hooks.PreToolUse gate and no permission DSL"). The row also discloses its own weakness in the file ("no client-side backstop exists, so the kernel is the only enforcement here"), so a reader of the matrix cannot be misled. **Honest non-gap: yes.**

The two remaining gaps are absences I could verify are real:
- `discipline-enforceable` — `git ls-files templates | grep -i claude` returns exactly one file, `templates/docs/CLAUDE.md`; `ls templates/docs` has no `.claude/`, no settings, no hooks; `PreToolUse`/`SessionStart`/`UserPromptSubmit` appear only under `templates/docs/zcode/arggon/hooks/`; no code writes a `.claude` path (`grep '"\.claude' cli/src lib/src` → nothing). "No permission DSL, no hook gate" is true.
- `docs-travel-with-code` — no claude session context hook ships anywhere; `CLAUDE.md` → `@AGENTS.md` is the only context path, and the note now says so instead of implying nothing travels.

**`fieldNotes.rows[].gap` criterion — sound, and right in general.** "A surface `arggon init` ships to every client can never be the missing thing" is the correct test for a *capability* matrix: a coverage report must not call a surface the adopter's tree actually has "missing", and a gap must name something the client genuinely cannot do. The bundle-presence criterion it replaced was a statement about our packaging, not about the client's capability. One phrasing nit (non-blocking, listed below): the parenthesis folds the ZCode plugin manifest into "ships to every client", and the manifest is one client's bundle.

**Tests discriminate — verified by evaluating the assertions against both data versions, not by running them.** Current data: the false-absence lint flags nothing, the client-scoped converse passes on all 13 non-gap rows, no gap note exceeds `MAX_HUMAN_VALUE_CHARS`. Round-1 data restored: the lint flags `same-rules/claude` for claiming `arggon mcp` missing, two notes exceed 200 chars, and the seam-derived claude test fails on all three rows' flags + `package`. So the worker's "restoring the round-1 text fails 3 tests" reconstructs exactly (lint + seam-derived + note bound). Two things I checked specifically, as asked:
- *Clause-scoped lint is not a false-positive machine.* The split at `/, so | therefore | meanwhile | but /` is load-bearing: today's `discipline-enforceable` note reads "…have no Claude Code equivalent, so the kernel, pre-commit and CI carry it alone" — `pre-commit` sits in the enforcement half, and because the character class `[^.:;]*` does not exclude a comma, linting the whole note would have falsely flagged that honest sentence. The head-only scan avoids it. ✓
- *The converse is a real gate, not decoration.* Every non-gap row must match `/^(opencode|zcode|claude):/` and carry a package equal to its agent id (claude → `claude-code`) — the exact shape that hid a gap in round 1 ("not a gap" justified by the floor alone) now fails CI. Every gap note must name a client-native capability (`hook|permission|session context|bundle`), so vagueness fails too. ✓
- *Note bound is the renderer's, not a magic number.* The test imports `MAX_HUMAN_VALUE_CHARS` from `@arggondev/lib` (`lib/src/sanitize.ts:25` = 200) and commits to 196/187-char notes — both render in full, no `…`. Matrix file is 10,072 B ≤ 16,384 B.

## F2 — all four sites plus the extras are clean

Verified each by reading the current text: `docs/json-output.md` field table now says "found in the examined tree" / "relative to the examined tree" for `matrix.present`/`matrix.source`; the `MATRIX_PATH` JSDoc says "relative to the root of the examined tree"; both `doctor.ts` probe comments are now *negative* statements ("never a package fallback: an additive field must depend only on the examined tree"); the `DoctorResult.matrix` docstring no longer claims the block is absent-from-the-tree-signal, and `json-output.md`'s fifth site now says both report shapes probe the same tree root and report the absence with its reason — which matches the code (`readCapabilityMatrix({root: opts.cwd})` vs `({root})`). A grep of the whole PR diff for "installed package / package fallback / shipped in the pack / 5 gap / 19 tests / allow-list" returns only (a) the resolution paragraph's correct "with no fallback to the installed package", (b) the round-1-response text naming the first cut's error, and (c) the append-only historical worker sections — no live claim survives.

## Coordinator's two evidence lines — stated accurately now, not dropped

- P3: the test now asserts exit 0 **and** that the `validate` envelope carries no key matching `/matrix|gap/i` **and** `errors: []`/`warnings: []`, with the comment spelling out why that is the honest statement. That is exactly the right shape: if a future change ever leaked a gap into that payload, the test fails. ✓
- P4: the corrected attribution matches the code I read — native catalog owned by `nativeToolsCatalogBytes()` (`opencode/plugins/arggon/index.ts:4629`) with the cap at `smoke/context-report.ts:83` (`NATIVE_TOOLS_BUDGET_BYTES = 12_288`) and the owning command `npm run context:report` (`package.json:33`). The MCP half stays on `doctor --budget` and that is right: `MCP_TOOLS_BUDGET_BYTES = 16_384` lives at `cli/src/measure.ts:48` and `smoke/context-report.ts:16` documents it as reached through `arggon doctor --budget --json`. ✓

## Non-blocking items — verified cleared

F3: the `## Notes` block now says "committed to this repo; NOT in the npm pack — see `task-matrix-reaches-adopters`", states the 2-gap derivation, and points at the tree-only read; the dated worker sections are left as history, and the newest section corrects each stale line by name (pack shipping, five claude gaps, note clipping, the noun, P3, P4) rather than rewriting history — correct convention for an append-only comment log. F4: 196/187-char notes + renderer-derived bound. F5: the row now reads "per-agent `permissions` deny rules in the agent frontmatter", and I confirmed the substance (`templates/docs/opencode/agents/arggon-reviewer.md` denies `edit`, `subagent`, and all ten mutating `arggon_*` actions plus the MCP spellings). F6: `task-matrix-reaches-adopters` now has six real acceptance bullets — and its last one is honest: "the matrix's own gap rows are re-derived from the seam this path delivers (a Claude Code adopter tree that now carries the matrix still has no hook gate and no session context hook — do not flip those rows just because the file is visible)". That is precisely the anti-pattern guard I wanted. F7 left as-is with the stated reason; agreed.

## Non-blocking follow-ups (recommend filing under `story-capability-matrix`; none block merge)

1. `derivation`'s parenthetical — "ADR 0020's prose (which describes intent, not delivery)" — is slightly unfair to the record. ADR 0020 §Context and its constraints make a delivery claim ("Claude Code has only a `CLAUDE.md` pointer"; "today it remains docs + CLAUDE.md"), and the generated `.mcp.json` — long predating this PR — already complicated it. The precise statement is "derived from the shipped seams; ADR 0020 models the adapter-bundle state and does not account for the `.mcp.json` floor every client gets". Wording-only, but this is the sentence that justifies the whole matrix's provenance.
2. The same drift, in the ADR: it now reads as stale against a 2-gap matrix. A one-line reconciliation (or an explicit "superseded on this point by the S3 matrix" note) is the cheap half of docs-travel-with-code; ADR 0016 impact line included.
3. Tighten `fieldNotes.rows[].gap`: "ships to every client" followed by a parenthesis that includes the ZCode plugin manifest leaves a future row free to call "the zcode manifest registration" a claude gap. "A surface that reaches every client (the `arggon mcp` server, however it is registered)" closes it.
4. Know what the lint is: it catches "claims a universal surface is missing". It would NOT have caught round-1's `state-in-git` note, which invented an absence without naming one — the seam-derived positive test is what covers that row. Worth one line in the test comment so nobody later reads the lint as a general honesty gate.
5. README: `## The methodology` (`README.md:62-74`) links the three carriers + the adapters epic + the spec but not the matrix it now has. Spec S1 assigned that pointer to T1 (`task-methodology-carriers`, acceptance only says "links every carrier in one hop"), so this is not this item's debt — but one bullet here closes spec S1 properly now that the asset exists.

## Remaining unverified (probe-dependent)

The gap set changed 5 → 2, so the human `doctor` line the smoke bar covers is a different string than round 1's. Probes below.

## Recommendation: MERGE

F1 and F2 are fixed in substance, not cosmetically; the gates that lock the fixes in discriminate against the round-1 data; the item's acceptance checklist is complete and its body no longer asserts anything false. Nothing above blocks.
=======
- `adapters/capability-matrix.json` (committed, shipped in the pack): 5 methodology
  invariants (the carriers' `**Invariants:**` header block, mirrored by test) x 3
  agents (opencode, zcode, claude) = 15 rows, each with `mechanism`, `package`,
  `gap` and `note`. DATA only, no rule logic; the kernel stays the enforcement of
  record on every row.
- Current gaps: all 5 claude rows (ADR 0020, "today it remains docs + CLAUDE.md";
  each note names the missing native mechanism and what enforces it meanwhile).
  opencode and zcode have zero gap rows (shipped seams).
- `arggon doctor` prints one `matrix:` line plus one `gap:` line per gap row
  (cap `MAX_MATRIX_GAP_ROWS` = 10, notes display-sanitized), additive `matrix`
  block in `--json`. Report-only: exit code and every gate unchanged.
- Budgets after: native tools catalog 12,162 B (cap 12,288), live MCP `tools/list`
  16,253 B (cap 16,384), generated AGENTS.md 2,022 B (cap 2,048) — identical to
  the pre-change numbers (nothing on the tool-schema surfaces moved).
>>>>>>> f4d28aa4 (feat(matrix): committed capability matrix + report-only doctor gap rows)
