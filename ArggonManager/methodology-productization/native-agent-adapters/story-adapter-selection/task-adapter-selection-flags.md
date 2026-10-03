---
type: task
status: in_progress
id: task-adapter-selection-flags
title: init --agents/--no-agents + doctor --agents (plan T2)
assignee: Arggon
parent: story-adapter-selection
labels: []
created: "2026-10-02"
updated: "2026-10-03"
claimed_at: "2026-10-03T02:47:05.730Z"
depends_on: [task-methodology-carriers]
---
<!--
  Placement (v0): ArggonManager/methodology-productization/native-agent-adapters/story-adapter-selection/task-adapter-selection-flags.md
  Leaves live only under a story. id is the filename stem: task-adapter-selection-flags.
  CLI `arggon create task adapter-selection-flags` adds the task- prefix (do not pass it twice).
  parent MUST be the story id. Omit assignee when unassigned. Omit blocked_reason unless status is blocked.
-->

# init --agents/--no-agents + doctor --agents (plan T2)

## Context

Add `arggon init --agents <list>` / `--no-agents` (default: detected agents) and `arggon doctor --agents` (per-agent files present/stale/adopter-edited + gap rows)

## Acceptance

- [x] fixture matrix test over init flag combinations
- [x] `--json` reports written/skipped per artifact; adopter edits never overwritten
- [x] doctor output snapshot test
- [x] README + agents.md §init updated in same PR

## Notes


Implementation is on `feat/task-adapter-selection-flags` (PR opened from the worktree). Left `in_progress` for the coordinator's review/merge; the boxes above are ticked by the work that landed in that PR, and every gate was re-run green on its head.

### 2026-10-03 @Arggon
## Worker evidence — `init --agents/--no-agents` + `doctor --agents`

Worktree `/home/arggon/Projects/ArggonManager-task-adapter-selection-flags`, branch `feat/task-adapter-selection-flags` (rebased onto `origin/main` af9ca0f4, which carries the merged `task-capability-matrix`). Item left `in_progress` — the done flip is the coordinator's call.

### What landed

- `cli/src/adapters.ts` — the ONE registry mapping a template id to its agent seam (`agentForTemplate`), tree-only detection (`detectAgents`), `--agents` parsing that refuses an unknown name BY NAME, and the resolved selection (`select` / `none` / `detect`). `docs.ts` imports it (never the reverse, so there is no cycle) and re-exports `OPENCODE_CONFIG_CANDIDATES` from its old home.
- `planGenerateDocs` takes the resolved `agents` list; a destination whose seam is unselected gets an explicit `agent-not-selected` plan decision — no write, no state mutation, nothing deleted.
- `init --json` / `--dry-run --json`: additive `adapters` block (`scope`, `selection{mode,known,detected,selected,reason}`, `artifacts[{agent,path,outcome,reason}]` capped at `MAX_ADAPTER_ARTIFACTS`, `truncated`, honest `counts`). `--propose` reports `scope: "propose"` with zero counts.
- `doctor --agents`: per agent, every adapter file as `present` / `stale` / `adopter-edited` / `missing` / `unverified`, plus that agent's capability-matrix gap rows, read through the SHIPPED reader (`cli/src/capability-matrix.ts`) — extended with an additive `gapsByAgent` tally so a per-agent total is never derived from the capped detail list. `runDoctor` reads the matrix once; both blocks read that one read. Absent without the flag; no exit-code change; writes nothing.
- Docs in the same PR: README (flags + envelope + the `doctor --agents` report), `docs/agents.md` §init agent-seam rules, `docs/json-output.md` (the `adapters` block, the `agents` block, `matrix.gapsByAgent`, the new `agent-not-selected` plan decision).

### Commands run (all from the worktree, exit 0)

- `npm run build` — clean (lib + 3 tsconfigs).
- `npm test` — **120 files / 2247 tests passed** (was 2245 before the snapshot test; 8 tests in one file were red on the adopted work, see F1 below).
- `npm run lint` — clean.
- `npm run arggon -- validate --json` — `{"ok":true,"errors":[],"warnings":[]}`.
- `npm run check:plugin` — bundle byte-identical (41 modules, 457609 B). Never hand-edited.
- `npx prettier --check README.md ArggonManager/docs/agents.md ArggonManager/docs/json-output.md` — clean (`json-output.md` is on the prose-format byte-stability list).
- `npm run context:report` — verdict: all bounds pass.

### Budget numbers (from `npm run context:report`, which owns the native-catalog figure)

| surface | bytes | ~tok | bound | status |
| --- | --- | --- | --- | --- |
| generated AGENTS.md | 2,005 | 501 | <=2,048 B | pass |
| MCP tools/list (15 tools) | 16,253 | 4063 | <=16,384 B adv. | pass (+552 B / +3.5% vs baseline) |
| native arggon tools (15, 9 pinned) | 12,162 | 3041 | <=12,288 B adv. | pass |
| injected item block (max) | 252 | 63 | <=1,024 B | pass |
| fixed per-session total | 31,527 | 7882 | - | - |

`doctor --budget` prints no native-catalog line (it has no such surface); the 12,162 B native-tools figure comes from `context:report` alone. **These figures are unaffected by this diff**: `check:plugin` proves the plugin bundle is byte-identical to main, and the MCP schemas come from `cli/src/mcp-server.ts` + `lib/`, neither of which this branch touches — so the +552 B vs the 2026-09-15 baseline is earlier merged work on main, not this item.

### Two defects found in the adopted (uncommitted) work and fixed

1. **The flags did nothing on a fresh tree** (F1). `planInit` passed the resolved `agents` list to `planGenerateDocs` on the ALREADY-INITIALIZED path only; the fresh-scaffold path — the one every first run and every fixture test takes — omitted it, so `--no-agents` still wrote all 39 adapter artifacts. Expected: `--no-agents` writes 0. Observed: 18 opencode + 19 zcode + 2 claude files on disk. 8 of the 36 tests in `adapter-selection.test.ts` were red on adoption; all green after `cli/src/init.ts:376` gained `agents: adapters.selected`.
2. **`doctor --agents` advertised a protection init does not give** (F2). Classification compared the recorded checksum first, so the two derived vendored plugin copies (`.opencode/plugins/arggon/index.ts`, `tui.tsx`) came out `adopter-edited` — a status that reads "yours, never overwritten". init does not skip those: it **re-vendors** them from the committed bundle on a provenance mismatch (bug-stale-vendored-plugin-copy), because the shared checksum cannot describe one checkout. A present vendored copy is now decided ahead of the checksum compare, and the acknowledged-baseline check moved ahead of it too (an acked entry is never regenerated, so it must not read `stale`). Real-tree effect on this repo: opencode went 12 present / 6 adopter-edited -> **13 present / 5 adopter-edited**; the 5 remaining are genuine checksum divergences, the same ones the pre-existing `docs.modified: 12` bucket already names. The sharper derived-artifact verdict for that copy is untouched in the `opencode` block (`vendored plugin current` / `STALE` / `unverified`).

The F2 regression test was checked against the pre-fix order, not assumed to fail: with the guard moved back it fails with `expected 'adopter-edited' not to be 'adopter-edited'`; with the fix it passes. (Its first draft was vacuous — it rewrote `checksum: <hex>` while the recorded form is `sha256:<hex>`, so the replacement silently matched nothing — so it now asserts the replacement actually changed the convention file.)

### Manual probes (expected vs observed)

- `arggon init <tmp> --agents opencode` -> human: `- agent adapters (select): opencode — 18 written, 21 skipped`, plus one line per unselected agent (`claude: 2 file(s) left untouched`, `zcode: 19 file(s) left untouched`); on disk only the opencode seam, no `.zcode-marketplace/`, no `CLAUDE.md`/`.mcp.json`.
- `--json init --no-agents` -> `selection.mode: "none"`, `counts {total: 39, written: 0, skipped: 39}`, every row `outcome: "skipped"` with `… adapter not selected (--no-agents (docs + CLI only)) …`; the docs+CLI floor survives (`AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig`, `ArggonManager/.convention.yml`).
- `--json init . --agents opencode,cursor` -> non-zero exit, `error.code "INIT_FAILED"`, message `unknown agent "cursor" in --agents (known: claude, opencode, zcode)`; a full recursive file listing of the target is unchanged before/after, so a refused run leaves no partial scaffold.
- `doctor --agents` in the `--agents opencode` tree -> `agent opencode: 18 file(s) — 18 present`; `agent zcode: 19 file(s) — 19 missing … not detected in this tree`; `agent claude: 2 file(s) — 2 missing … not detected in this tree`.
- `doctor --agents` on this repo's tree -> `matrix: … 2 gap(s) (report-only, never blocking)` and the two claude gap rows (`discipline-enforceable`, `docs-travel-with-code`) attached under `agent claude:` with `2 capability gap(s)`; opencode and zcode report `0 capability gap(s)`. That matches the merged 2-gap matrix (the three claude `.mcp.json` -> `arggon mcp` rows are `gap: false`).
- No matrix in the tree -> every agent reports `0 capability gap(s)`, `gaps.matrixPresent: false`, a `note: no capability matrix — …` line, exit 0.
- Never-overwrite: after an adopter edit to `.opencode/agents/arggon-worker.md`, a plain re-run, `--force`, and a `--backup` regeneration all keep the adopter bytes; the row reports `outcome: "skipped"` with an `adopter-modified` reason. An unselected agent's edited file is not touched at all.
- `--dry-run --agents opencode,zcode` reports byte-identical `[path, outcome]` rows to the run it previews, and writes nothing.

### Scope notes for the reviewer

- The matrix JSON and the false-absence lint were **not** touched — that lint's scope is the gap CLAUSE only and its own follow-up item records the clause-scoped split as load-bearing, so this PR does not come near it. Per-agent gap rows come from the shipped reader; there is no second parse of the JSON anywhere in this diff.
- Tree-only detection and matrix resolution both read the examined tree, never the installed package, so `doctor --json` stays byte-identical between the packed bin and the checkout CLI (the pack-parity gate).
- The generated `.agents/skills/**` bundle is deliberately NOT an adapter artifact (agent-agnostic; the matrix lists it as a surface that can never be the missing thing for any client), so it is generated whatever `--agents` says — asserted by a test.
- Two sessions died before this one with the work uncommitted; it was adopted, rebased, finished and landed rather than restarted. No new work was found that belongs to another item. The one judgement call worth a second opinion: the fresh-scaffold default — a tree with NO agent marker selects every KNOWN agent rather than the empty set a literal reading of the spec gives — implemented and documented because narrowing there would silently delete the seams `init` has always shipped and break the generated AGENTS.md contract.

### handoff 2026-10-03 @Arggon — next: Coordinator: review + merge feat/task-adapter-selection-flags (PR open), then flip the item to done.
- branch: feat/task-adapter-selection-flags
- open questions: Second opinion wanted on the fresh-scaffold default (no marker -> every known agent, vs the empty set a literal spec reading gives); and on whether doctor --agents should classify acked-then-drifted …

### 2026-10-03 @Arggon
## Round 1 addressed — all 6 blocking + 5 should-fix (PR #606 updated)

Branch `feat/task-adapter-selection-flags`, worktree `/home/arggon/Projects/ArggonManager-task-adapter-selection-flags`. Item left `in_progress` for re-review.

### Blocking

| # | Fix | Regression test — and how it was proved non-vacuous |
| --- | --- | --- |
| F1 | `stale` now requires a state entry whose checksum matches; a present dest with **no provenance state** is adopter-owned → `adopter-edited` (what `docs.ts:1013` actually does with it) | pre-init adopter tree: asserts `adopter-edited`, `stale == 0`, and that a re-run really keeps the bytes |
| F2 | `present` = byte-equal to the current render ONLY. Added `acknowledged` + `acknowledged-drifted`, mirroring `docs.acknowledged`/`docs.acknowledgedDrifted`; docstring rewritten; **every** human label names the action init takes ("`adopted-edited` (yours; init skips it unless --backup)", "`stale` (arggon init would refresh it)"). An acked entry is never `present`, never `stale`, never `adopter-edited`. "Template moved on" stays orthogonal in `docs.outdated` | `Object.keys(counts)` pinned to all 8 counters, so a new status cannot vanish from the totals; plus the acknowledged test below |
| F2b | ordering kept (acked decided by its own checksum, ahead of the render compare) | acked-then-**edited** file — the only case where the two orders diverge. **Mutation-checked**: moving the branch back below the checksum compare now fails this test (it left the suite green before) |
| F3 | new `replaced` outcome + `counts.replaced` for `modified-backup`; `total = written + replaced + skipped` | `--backup` on an adopter-edited adapter file: `replaced`, reason carries `archived to backup/…`, archived bytes equal the adopter's edit, destination regenerated, `counts.replaced == 1` |
| F4 | re-init path already correct — now covered | delete a zcode dest → re-init `--agents opencode`: **stays missing**, opencode seam intact, row `skipped` with the deselection reason; `--no-agents` through the CLI: still missing; widen to `opencode,zcode`: materialized. **Mutation-checked**: deleting `init.ts:302` fails only this test |
| F5 | `resolveAgentSelection` hoisted above `applyProposals` | `--propose --agents cursor`: full recursive listing byte-identical, no `backup/`, no `.proposed-*`. **Mutation-checked** (resolution moved back after `applyProposals`) |
| F6 | both tokens recorded from commander's per-token `option:agents` / `option:no-agents` events; the combination is refused in **either** order; either token alone still works | `runCli` for both orders → `INIT_FAILED` + empty tree; `--agents opencode` alone → `mode: "select"`; `--no-agents` alone → `mode: "none"`. **Mutation-checked** (removing the CLI check) |

The three mutation checks were run by actually moving the reviewed code back and re-running, not asserted: F2b / F4 / F5 / F6 each turned the suite red on the dedicated test only.

### Should fix

- **`AGENTS.md` / `SKILL.md` seam surface — decision: DOCUMENTED CAVEAT, not a selection-aware render.** Reason (CORRECTED per the round-2 review — the original provenance argument was wrong and is retracted): the risk is not provenance breakage. `AGENTS.md` is not an adapter artifact, so it is never deselected, and a changed render against a matching recorded checksum is the ordinary `updated` decision every template upgrade takes, with the state entry refreshed. The real costs of a selection-aware render are smaller and are the actual reasons: `AGENTS.md` would flip between variants on every selection change (real diffs, and a hand edit to it could then read as adopter-modified), the 2,048 budget would become flag-dependent, and one tier-1 doc's bytes would depend on a flag for no product gain. The caveat keeps it selection-independent and inside budget: **2,005 → 2,031 B** (bound 2,048; 17 B headroom, CI-enforced exact-bytes). The caveat keeps `AGENTS.md` selection-independent and inside budget: **2,005 → 2,031 B** (bound 2,048; `npm run context:report` confirms `pass`). SKILL.md states that the plugin ships with the opencode seam and that without it the CLI is the complete surface.
- **`.mcp.json` gating** documented where it was implied only: `agents.md` §MCP server, §OpenCode V2, and `README.md` tier-1 list — it is part of the `claude` seam, so `--no-agents` omits it.
- **The false `--backup` test comment** is gone: the never-overwrite test now says `--backup` is deliberately absent (it regenerates) and points at the `replaced` test that covers it.
- **`printInitAdapters` "does not grow"** comment corrected — the summary line prints on every run, and it now shows the `replaced` count.
- **`--agents` sample** regenerated from a real `doctor --json --agents` run: it named **9** divergences, not 12, and the caption now says so (a subset of `docs.modified`'s 12; the rest are non-adapter destinations). Measured counts, including the new acked bucket.

### Spec §S2 amended (coordinator decision applied)

"Default: every detected agent" replaced with the two-part rule and its reason: a marker present → that agent; **no marker at all (a fresh scaffold) → every KNOWN agent**, because a literal reading makes a first `arggon init` detect nothing and ship no adapter — silently dropping the seams init has always generated and breaking the generated `AGENTS.md` contract and README's tier-1 list. Marker list included; `--json` reports which rule fired. The two S2 acceptance boxes this PR satisfies are ticked, each with a pointer to what satisfies it.

### Gates (all exit 0, re-run on the published head)

`npm run build` · `npm test` (**120 files / 2253 tests**, was 2247 — +6 new) · `npm run lint` · `arggon validate --json` (`ok:true`, 0/0) · `arggon spec validate --json` (`ok:true`) · `npm run check:plugin` (bundle byte-identical, 457,609 B) · `npx prettier --check` on all six touched docs.

`npm run context:report` → all bounds pass: AGENTS.md **2,031 B** (≤2,048) · MCP tools/list 16,253 B (≤16,384 adv.) · **native arggon tools 12,162 B** (≤12,288 adv.) · item block 252 B · fixed per-session total 31,553 B. The AGENTS.md figure moved **because of this PR's caveat** (+26 B, inside the bound); the MCP/native figures are unmoved — `check:plugin` proves the plugin bundle is unchanged by this diff and the MCP schemas come from `mcp-server.ts` + `lib/`, neither touched here.

### Probe evidence (also in the PR body)

Four reviewer-requested probes, each with expected/observed: both token orders (refusal, nothing written — was silent last-wins), `--propose --agents cursor` (recursive listing md5 identical before/after, 0 side files — used to write them first), `--agents ""` (`INIT_FAILED`, not a silent "all"), and the F1 no-state tree (`adopter-edited`, `stale: 0`, and init really keeps the adopter's bytes).

That last probe also corrected my own fixture: I had planned to strip a state entry by hand, but init **never records state for a file it did not write**, so the pre-init adopter tree reaches the no-state branch naturally — no surgery needed.

### Refusal to report (no force-push)

**The branch is not rebased onto `origin/main`, and I did not force-push.** I rebased (13 commits behind, one conflict in this item file — both appends kept: the reviewer's verdict then my note) and the push was **refused** as non-fast-forward, since a rebase of published history cannot fast-forward and force-pushing was not authorized. Rather than route around it, I restored the published history — the local branch is byte-identical to `origin/feat/task-adapter-selection-flags` and all three round-1 commits are on the PR.

The rebased tree is preserved verbatim as `backup/rebased-round1` (tag `rebased-round1-tip`) if you want it: its `cli/`, `templates/`, `skills/`, `README.md` and `ArggonManager/docs/` content is **byte-identical** to the published branch — only the base differs — so nothing about the fixes depends on it. The 13 stale commits are all `chore(tasks):` item-file commits touching none of this PR's files, so the review diff is unaffected. Per the repo's merge guidance this PR should **merge, not squash** (it carries tracker auto-commits).

Also noted for the record: `npm run build` must precede `npm test` — the pack-parity gate compares the packed bin against `dist`, so a stale `dist` shows up as a spurious `headless-ci` envelope mismatch. It cost me one false alarm; not a code defect.

### handoff 2026-10-03 @Arggon — next: Coordinator: re-review PR #606 (round-1 fixes pushed); decide merge-not-squash, then flip the item.
- branch: feat/task-adapter-selection-flags
- open questions: Branch deliberately NOT rebased (push refused, no force-push): rebased tree preserved at backup/rebased-round1, byte-identical content. Force-push it or merge as-is?

### 2026-10-03 @Reviewer

### 2026-10-03 @Reviewer
verdict: request-changes (classification honesty: `stale` claims a refresh init refuses; acked folded into `present`)

Reading only; no gate run by the reviewer. Evidence and probes are in the reviewer's report (`## Probes needed` lists the exact commands).

Verified by reading:
- F1 (fresh path) genuinely fixed: `cli/src/init.ts:376` carries the selection; both `planGenerateDocs` call sites (`:296` re-init, `:376` fresh) do, `generateDocs` keeps the `undefined` = "every agent" default, and `docs.ts` is the only writer of adapter dests — no third path missed. The matrix test discriminates (8 rows red without it).
- F2 genuinely fixed: `doctor.ts:613`/`:616` both precede the checksum compare at `:621`, matching init's own precedence in `docs.ts:962/1005/1017`. The vendored-plugin regression test cannot be vacuous (asserts the `sha256:` replacement actually changed the file). The acknowledged half has no test (F2b).
- Matrix: one read, tally before the detail cap, matrix JSON + its false-absence lint untouched, `gapsByAgent` additive within schemaVersion 1.
- Budgets: no template / `opencode/plugins/**` / `mcp-server.ts` / `lib/` change, so none of the three figures can move; native ownership is `smoke/context-report.ts:475` (bound `:84`), and `measure.ts` has no native row, as claimed.
- Unknown names refused by name; an empty `--agents ""` throws (no silent "all").

Blocking:
- F1 `stale` is reported for a present file with NO provenance state, documented as "init would refresh it" — init treats exactly that case as adopter-modified and never refreshes (`docs.ts:1013`). Operator is sent to a command that cannot work.
- F2 `present` must mean "byte-equal to the current render" only. Decision: acked gets its own status — `acknowledged` / `acknowledged-drifted`, mirroring `docs.acknowledged` / `docs.acknowledgedDrifted` — not `present` (false at `doctor.ts:502`) and not `adopter-edited` (a hand edit that did not happen, with no un-ack path). `arggon adopt --ack` acks every state entry, so this is the normal adopter state, and today one envelope says `present` while the `docs` block says `acknowledged` + outdated.
- F3 `modified-backup` (init --backup) is reported `skipped` with a reason that says "regenerated".
- F4 the re-init path's selection is untested: deleting `init.ts:302` keeps all 36 tests green.
- F5 `init --propose --agents <unknown>` writes the `.proposed-*` side files (`init.ts:1046`) before refusing at `:1050`, contradicting the documented "refused before anything is written".
- F6 `--agents` and `--no-agents` are not mutually exclusive at the CLI (commander 13.1.0 writes both to the same option key; last token wins silently), so the shipped "does not combine" error is unreachable from the CLI while README + json-output.md assert refusal.

Decisions handed down: the no-marker default (every KNOWN agent) is right and the SPEC §S2 sentence "Default: every detected agent" is the thing that must be amended in this PR — flag help, README, agents.md and tests are propagation, not the record. `doctor --agents` may keep the narrow `present` plus the added statuses; no label may imply a protection or a refresh init does not provide.

Should fix: the always-generated SKILL.md/AGENTS.md still assert the OpenCode plugin surface under `--no-agents` (decide: selection-aware render or a documented caveat); `.mcp.json` gating is undocumented in `agents.md:410/556` and README:205; a test comment claims `--backup` coverage the test lacks; `printInitAdapters`' "does not grow" comment is wrong; the new `--agents` sample says the rows name 12 `docs.modified` entries (they name 8).

### 2026-10-03 @Reviewer

### 2026-10-03 @Reviewer
verdict: approve (round 1: all six blocking findings closed and verified; five non-blocking doc/test nits)

Reading only; no gate run by the reviewer. Round-1 verdict: request-changes (F1–F6 blocking, F11 sample number).

Blocking, re-verified by reading the branch:
- F1 `doctor.ts:657` — `stale` now requires state-backed + checksum match + render diff; a present file with NO state entry is `adopter-edited` (what `docs.ts:1013` does). Test builds the pre-init adopter tree, asserts `stale == 0`, and asserts a re-run really keeps the bytes. Fires on this repo too: `.opencode/agents/arggon-prover.md` has no `x-generated` entry.
- F2 `present` = byte-equal to the current render only; `acknowledged` / `acknowledged-drifted` added and decided by the acked baseline's own checksum, mirroring `docs.*`. `AdapterFileStatus` docstring rewritten to name the action init takes, `--backup` exception included; `Object.keys(counts)` pinned to all eight counters. No status promises a protection or refresh init does not provide.
- F2b acked-then-EDITED test — the only case where the two orders diverge; also cross-checks the `docs` buckets, so the convention edit is proven to parse.
- F3 `outcomeForDecision`: `modified-backup` -> `replaced`; `total = written + replaced + skipped`; archive path in the reason; `replaced` present in `--json` and in the human line.
- F4 re-init test: deleted zcode dest stays missing under `--agents opencode` and `--no-agents`, widening materializes it; removing `init.ts:302` turns it red.
- F5 selection resolved before `planProposals`/`applyProposals`; full recursive listing asserted unchanged.
- F6 both tokens recorded from commander's `option:agents` / `option:no-agents`; refused in either order, inside the action's try, before any write; either token alone still works.
- Discrimination spot-check: each new test provably fails against the reviewed code (re-derived by reading, not re-run).

Design judgements:
- The AGENTS.md/SKILL.md caveat is accepted; the provenance reason recorded for it is wrong (a selection-dependent render would be an ordinary `updated` decision, state refreshed) — correct the sentence in the item note. 2,031/2,048 (17 B) is accepted: the bound is CI-enforced exact-bytes, so the next editor fails loudly.
- Spec §S2 amended with the two-part rule AND its reason; both S2 acceptance boxes ticked with pointers.
- Merge, not squash (docs/agents.md §0: tracker auto-commits) — and note: `6423ed49` on main comments THIS item's file, so the merge conflicts on it. Resolve the item file as a union in a normal merge commit (no force-push); then prune the worktree/branch. `backup/rebased-round1` is a valid recovery path.

Should-fix: all five closed (.mcp.json gating in agents.md:410/:556 + README:205; the false --backup test comment; printInitAdapters' "does not grow"; the sample's 9-vs-12 caption). The regenerated sample's per-agent counts were reproduced independently from this tree's own state file and are correct.

Non-blocking, fix here or file as items: README:292-294 still shows the pre-round-2 human line; json-output.md:236 has a duplicated half-merged `adopter-edited` clause that keeps "never overwrites it" next to the new `--backup` wording; json-output.md:237 omits `acknowledged`/`acknowledged-drifted` from the `counts` row; the sample caption calls all 9 rows `docs.modified` (8 are; the 9th is the no-provenance-state case); the matrix assertion at adapter-selection.test.ts:274 omits `replaced`. Informational, still open: runAdapterReport re-reads the convention file the docs block already read.

Merge recommendation: merge commit; no squash, no force-push.
